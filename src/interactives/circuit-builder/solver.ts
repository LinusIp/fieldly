/**
 * DC circuit solver: Modified Nodal Analysis (§9.2 circuit-builder).
 * - Wires and closed switches merge their terminals into one node (union-find).
 * - Ammeters are zero-volt sources, so their current is solved for; voltmeters are open circuits.
 * - A zero-resistance path across the battery is a short circuit; no resistive loop is an open circuit.
 */

export type ElementKind = 'resistor' | 'bulb' | 'wire' | 'switch' | 'ammeter' | 'voltmeter';

export interface NetElement {
  label: string;
  kind: ElementKind;
  a: string;
  b: string;
  resistance?: number;
  closed?: boolean;
}

export interface Netlist {
  battery: { p: string; n: string; voltage: number; internalResistance?: number };
  elements: NetElement[];
}

export interface ElementResult {
  /** Current through the element (A), ≥ 0; NaN when undefined (e.g. a floating voltmeter). */
  I: number;
  /** Voltage across the element (V), ≥ 0. */
  V: number;
  /** Power dissipated (W). */
  P: number;
  /** Direction of conventional current: +1 from a to b, −1 from b to a, 0 none. */
  dir: number;
}

export interface SolveResult {
  I: number;
  Req: number;
  Ptot: number;
  n: number;
  isShort: boolean;
  isOpen: boolean;
  elements: Record<string, ElementResult>;
  /** Node voltages relative to the battery's negative terminal; undefined for floating nodes. */
  nodeV: Map<string, number>;
  /** Canonical node id of every terminal key. */
  nodeOf: (key: string) => string;
  warnings: string[];
}

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    let p = this.parent.get(x);
    if (p === undefined) {
      this.parent.set(x, x);
      return x;
    }
    if (p === x) return x;
    p = this.find(p);
    this.parent.set(x, p);
    return p;
  }
  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

const EPS = 1e-12;

/** Solve A x = b in place with partial pivoting; returns null when singular. */
export function gaussSolve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-10) return null;
    [A[col], A[piv]] = [A[piv], A[col]];
    [b[col], b[piv]] = [b[piv], b[col]];
    for (let r = col + 1; r < n; r++) {
      const f = A[r][col] / A[col][col];
      if (f === 0) continue;
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let c = r + 1; c < n; c++) s -= A[r][c] * x[c];
    x[r] = s / A[r][r];
  }
  return x;
}

function conducts(e: NetElement): boolean {
  return e.kind === 'resistor' || e.kind === 'bulb';
}

function shorts(e: NetElement, ammetersAsWires: boolean): boolean {
  return (
    e.kind === 'wire' || (e.kind === 'switch' && !!e.closed) || (ammetersAsWires && e.kind === 'ammeter')
  );
}

export function solveCircuit(net: Netlist): SolveResult {
  const { voltage: V } = net.battery;
  const rInt = net.battery.internalResistance ?? 0;
  const warnings: string[] = [];

  // Zero-resistance connections, with and without ammeters.
  const uf = new UnionFind();
  const ufA = new UnionFind();
  for (const e of net.elements) {
    uf.find(e.a);
    uf.find(e.b);
    if (shorts(e, false)) uf.union(e.a, e.b);
    if (shorts(e, true)) ufA.union(e.a, e.b);
  }
  uf.find(net.battery.p);
  uf.find(net.battery.n);
  const nodeOf = (k: string) => uf.find(k);
  const P = nodeOf(net.battery.p);
  const N = nodeOf(net.battery.n);
  const isShort = ufA.find(net.battery.p) === ufA.find(net.battery.n);

  // Active component: nodes reachable from the battery through resistive elements and ammeters.
  const adj = new Map<string, string[]>();
  const link = (x: string, y: string) => {
    if (!adj.has(x)) adj.set(x, []);
    if (!adj.has(y)) adj.set(y, []);
    adj.get(x)!.push(y);
    adj.get(y)!.push(x);
  };
  for (const e of net.elements) {
    if (conducts(e) || e.kind === 'ammeter') link(nodeOf(e.a), nodeOf(e.b));
  }
  // The battery itself is not a path: reachability from P must find N through the circuit.
  const reach = new Set<string>([P]);
  const stack = [P];
  while (stack.length) {
    const x = stack.pop()!;
    for (const y of adj.get(x) ?? [])
      if (!reach.has(y)) {
        reach.add(y);
        stack.push(y);
      }
  }
  const isOpen = !isShort && !reach.has(N);

  const elements: Record<string, ElementResult> = {};
  const nodeV = new Map<string, number>();
  const zero = (): ElementResult => ({ I: 0, V: 0, P: 0, dir: 0 });
  const nUsed = net.elements.filter(
    (e) =>
      e.kind === 'resistor' &&
      reach.has(nodeOf(e.a)) &&
      reach.has(nodeOf(e.b)) &&
      nodeOf(e.a) !== nodeOf(e.b),
  ).length;

  if (isShort || isOpen) {
    for (const e of net.elements) elements[e.label] = zero();
    if (isOpen) {
      // Voltmeters across the gap still read the battery voltage where they connect P and N sides.
      for (const x of reach) nodeV.set(x, V);
      // Everything connected to the negative terminal sits at 0 V.
      const low = new Set<string>([N]);
      const st = [N];
      while (st.length) {
        const y = st.pop()!;
        for (const z of adj.get(y) ?? [])
          if (!low.has(z)) {
            low.add(z);
            st.push(z);
          }
      }
      for (const y of low) nodeV.set(y, 0);
      for (const e of net.elements)
        if (e.kind === 'voltmeter') {
          const va = nodeV.get(nodeOf(e.a));
          const vb = nodeV.get(nodeOf(e.b));
          elements[e.label] = {
            I: 0,
            V: va !== undefined && vb !== undefined ? Math.abs(va - vb) : NaN,
            P: 0,
            dir: 0,
          };
        }
    }
    const I = isShort ? (rInt > 0 ? V / rInt : Infinity) : 0;
    return {
      I,
      Req: isShort ? 0 : Infinity,
      Ptot: V * I,
      n: nUsed,
      isShort,
      isOpen,
      elements,
      nodeV,
      nodeOf,
      warnings,
    };
  }

  // Nodes of the active component (N is ground).
  const nodes = [...reach].filter((x) => x !== N);
  const idx = new Map(nodes.map((x, i) => [x, i]));
  // Internal battery node when there is internal resistance.
  const INTERNAL = '__battery_internal__';
  if (rInt > 0) {
    idx.set(INTERNAL, nodes.length);
    nodes.push(INTERNAL);
  }
  const ammeters = net.elements.filter(
    (e) => e.kind === 'ammeter' && reach.has(nodeOf(e.a)) && nodeOf(e.a) !== nodeOf(e.b),
  );
  const nV = nodes.length;
  const m = 1 + ammeters.length;
  const size = nV + m;
  const A = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const b = new Array<number>(size).fill(0);
  const vi = (node: string) => (node === N ? -1 : idx.get(node)!);
  const stamp = (x: string, y: string, g: number) => {
    const i = vi(x);
    const j = vi(y);
    if (i >= 0) A[i][i] += g;
    if (j >= 0) A[j][j] += g;
    if (i >= 0 && j >= 0) {
      A[i][j] -= g;
      A[j][i] -= g;
    }
  };
  const stampSource = (k: number, plus: string, minus: string, volts: number) => {
    const row = nV + k;
    const i = vi(plus);
    const j = vi(minus);
    // Current variable flows from plus through the source to minus (inside the source).
    if (i >= 0) {
      A[i][row] += 1;
      A[row][i] += 1;
    }
    if (j >= 0) {
      A[j][row] -= 1;
      A[row][j] -= 1;
    }
    b[row] = volts;
  };

  for (const e of net.elements) {
    if (!conducts(e)) continue;
    const a = nodeOf(e.a);
    const c = nodeOf(e.b);
    if (!reach.has(a) || a === c) continue;
    const R = Math.max(e.resistance ?? 0, EPS);
    stamp(a, c, 1 / R);
  }
  // Battery: ideal source from N (−) to the + side, then internal resistance to P.
  const plusSide = rInt > 0 ? INTERNAL : P;
  stampSource(0, plusSide, N, V);
  if (rInt > 0) stamp(INTERNAL, P, 1 / rInt);
  ammeters.forEach((e, k) => stampSource(k + 1, nodeOf(e.a), nodeOf(e.b), 0));

  const x = gaussSolve(A, b);
  if (!x) {
    warnings.push('singular');
    // Ammeters in a closed loop with each other: solve again with them as plain wires.
    if (ammeters.length) {
      const asWires: Netlist = {
        ...net,
        elements: net.elements.map((e) => (e.kind === 'ammeter' ? { ...e, kind: 'wire' as const } : e)),
      };
      const r = solveCircuit(asWires);
      for (const e of ammeters) r.elements[e.label] = { I: NaN, V: 0, P: 0, dir: 0 };
      r.warnings.push('ammeter-loop');
      return r;
    }
    for (const e of net.elements) elements[e.label] = zero();
    return {
      I: Infinity,
      Req: 0,
      Ptot: Infinity,
      n: nUsed,
      isShort: true,
      isOpen: false,
      elements,
      nodeV,
      nodeOf,
      warnings,
    };
  }

  nodeV.set(N, 0);
  for (const [node, i] of idx) if (node !== INTERNAL) nodeV.set(node, x[i]);
  // MNA source current is the current entering the + terminal from outside; the battery
  // delivers the opposite of that.
  const I = -x[nV];
  const ammeterI = new Map(ammeters.map((e, k) => [e.label, x[nV + k + 1]]));

  for (const e of net.elements) {
    const va = nodeV.get(nodeOf(e.a));
    const vb = nodeV.get(nodeOf(e.b));
    if (conducts(e)) {
      if (va === undefined || vb === undefined) {
        elements[e.label] = zero();
        continue;
      }
      const dv = va - vb;
      const R = Math.max(e.resistance ?? 0, EPS);
      const i = dv / R;
      elements[e.label] = { I: Math.abs(i), V: Math.abs(dv), P: (dv * dv) / R, dir: Math.sign(i) };
    } else if (e.kind === 'voltmeter') {
      elements[e.label] = {
        I: 0,
        V: va !== undefined && vb !== undefined ? Math.abs(va - vb) : NaN,
        P: 0,
        dir: 0,
      };
    } else if (e.kind === 'ammeter') {
      const i = ammeterI.get(e.label);
      // An ammeter bypassed by a wire (both ends on one node) reads 0.
      elements[e.label] = { I: i === undefined ? 0 : Math.abs(i), V: 0, P: 0, dir: i ? Math.sign(i) : 0 };
    } else {
      elements[e.label] = zero();
    }
  }

  const Vterm = V - I * rInt;
  return {
    I,
    Req: I > EPS ? Vterm / I : Infinity,
    Ptot: V * I,
    n: nUsed,
    isShort: false,
    isOpen: false,
    elements,
    nodeV,
    nodeOf,
    warnings,
  };
}
