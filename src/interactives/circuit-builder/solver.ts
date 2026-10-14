/**
 * DC steady-state circuit solver: Modified Nodal Analysis (§9.4 circuit-builder).
 * - Wires and closed switches merge their terminals into one node (union-find), so loops of wires
 *   never make the system singular.
 * - Batteries are voltage sources (− terminal of B1 is ground); internal resistance adds a node.
 * - Ideal ammeters are zero-volt sources (their current is solved for); ideal voltmeters and
 *   capacitors are open. Non-ideal meters are resistors.
 * - A tiny conductance from every node to ground keeps floating parts solvable.
 */

export type ElementKind =
  'battery' | 'resistor' | 'bulb' | 'capacitor' | 'wire' | 'switch' | 'ammeter' | 'voltmeter';

export interface NetElement {
  label: string;
  kind: ElementKind;
  /** First node (the + terminal for a battery). */
  a: string;
  b: string;
  resistance?: number;
  voltage?: number;
  internalResistance?: number;
  capacitance?: number;
  closed?: boolean;
}

export interface Netlist {
  elements: NetElement[];
  meters?: { ammeterResistance?: number; voltmeterResistance?: number };
}

export interface ElementResult {
  /** Magnitudes. NaN when undefined (an ammeter in a loop of ammeters). */
  I: number;
  V: number;
  P: number;
  /** Signed, positive from the first node (a) to the second (b). */
  Is: number;
  Vs: number;
}

export interface SolveResult {
  /** Current out of B1's + terminal (A). */
  I: number;
  /** B1 terminal voltage ÷ I. */
  Req: number;
  /** Total power delivered by all batteries. */
  Ptot: number;
  /** Resistors + bulbs placed. */
  n: number;
  isShort: boolean;
  isOpen: boolean;
  elements: Record<string, ElementResult>;
  nodeV: Map<string, number>;
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
const G_MIN = 1e-9;

/** Solve A x = b with partial pivoting; returns null when singular. */
export function gaussSolve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-12) return null;
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

const isWireLike = (e: NetElement) => e.kind === 'wire' || (e.kind === 'switch' && !!e.closed);

/** Resistance an element presents, or null when it is open or a voltage source. */
function resistanceOf(e: NetElement, net: Netlist): number | null {
  if (e.kind === 'resistor' || e.kind === 'bulb') return Math.max(e.resistance ?? 0, EPS);
  if (e.kind === 'ammeter' && net.meters?.ammeterResistance) return net.meters.ammeterResistance;
  if (e.kind === 'voltmeter' && net.meters?.voltmeterResistance) return net.meters.voltmeterResistance;
  return null;
}

const idealAmmeter = (e: NetElement, net: Netlist) => e.kind === 'ammeter' && !net.meters?.ammeterResistance;

export function solveCircuit(net: Netlist, opts: { ammetersAsWires?: boolean } = {}): SolveResult {
  const warnings: string[] = [];
  const els = net.elements;
  const batteries = els.filter((e) => e.kind === 'battery');
  const b1 = batteries.find((e) => e.label === 'B1') ?? batteries[0];

  const uf = new UnionFind();
  for (const e of els) {
    uf.find(e.a);
    uf.find(e.b);
    if (isWireLike(e) || (opts.ammetersAsWires && e.kind === 'ammeter')) uf.union(e.a, e.b);
  }
  const nodeOf = (k: string) => uf.find(k);
  const ground = b1 ? nodeOf(b1.b) : nodeOf(els[0]?.a ?? '0');

  // Short: a battery's terminals joined by zero-resistance parts (wires, switches, ideal ammeters).
  const ufA = new UnionFind();
  for (const e of els) {
    ufA.find(e.a);
    ufA.find(e.b);
    if (isWireLike(e) || idealAmmeter(e, net)) ufA.union(e.a, e.b);
  }
  const shorted = batteries.filter((bt) => ufA.find(bt.a) === ufA.find(bt.b));
  const isShort = shorted.some((bt) => !(bt.internalResistance && bt.internalResistance > 0));

  // Open: no conducting path from B1's + back to its − (other batteries count as paths).
  const adj = new Map<string, Set<string>>();
  const link = (x: string, y: string) => {
    if (!adj.has(x)) adj.set(x, new Set());
    if (!adj.has(y)) adj.set(y, new Set());
    adj.get(x)!.add(y);
    adj.get(y)!.add(x);
  };
  for (const e of els) {
    if (e === b1) continue;
    if (resistanceOf(e, net) !== null || idealAmmeter(e, net) || e.kind === 'battery')
      link(nodeOf(e.a), nodeOf(e.b));
  }
  let isOpen = false;
  if (b1 && !isShort) {
    const start = nodeOf(b1.a);
    const goal = nodeOf(b1.b);
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const x = stack.pop()!;
      for (const y of adj.get(x) ?? [])
        if (!seen.has(y)) {
          seen.add(y);
          stack.push(y);
        }
    }
    isOpen = start !== goal && !seen.has(goal);
  }
  const n = els.filter((e) => e.kind === 'resistor' || e.kind === 'bulb').length;

  const zeroResult = (): SolveResult => {
    const elements: Record<string, ElementResult> = {};
    for (const e of els) elements[e.label] = { I: 0, V: 0, P: 0, Is: 0, Vs: 0 };
    return {
      I: isShort ? Infinity : 0,
      Req: isShort ? 0 : Infinity,
      Ptot: isShort ? Infinity : 0,
      n,
      isShort,
      isOpen,
      elements,
      nodeV: new Map(),
      nodeOf,
      warnings,
    };
  };
  if (isShort) return zeroResult();

  // ── MNA ──────────────────────────────────────────────────────────────────
  const nodes = [...new Set(els.flatMap((e) => [nodeOf(e.a), nodeOf(e.b)]))].filter((x) => x !== ground);
  const idx = new Map(nodes.map((x, i) => [x, i]));
  const internal = new Map<string, number>(); // battery label → internal node index
  for (const bt of batteries)
    if (bt.internalResistance && bt.internalResistance > 0) {
      internal.set(bt.label, nodes.length);
      nodes.push(`__int_${bt.label}`);
    }
  const sources: { el: NetElement; plus: number; minus: number; volts: number }[] = [];
  const vi = (node: string) => (node === ground ? -1 : idx.get(node)!);
  for (const bt of batteries) {
    const plus = internal.has(bt.label) ? internal.get(bt.label)! : vi(nodeOf(bt.a));
    sources.push({ el: bt, plus, minus: vi(nodeOf(bt.b)), volts: bt.voltage ?? 0 });
  }
  if (!opts.ammetersAsWires)
    for (const e of els)
      if (idealAmmeter(e, net))
        sources.push({ el: e, plus: vi(nodeOf(e.a)), minus: vi(nodeOf(e.b)), volts: 0 });
  const nV = nodes.length;
  const size = nV + sources.length;
  const A = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const rhs = new Array<number>(size).fill(0);
  const stampG = (i: number, j: number, g: number) => {
    if (i >= 0) A[i][i] += g;
    if (j >= 0) A[j][j] += g;
    if (i >= 0 && j >= 0) {
      A[i][j] -= g;
      A[j][i] -= g;
    }
  };
  for (let i = 0; i < nV; i++) A[i][i] += G_MIN;
  for (const e of els) {
    const R = resistanceOf(e, net);
    if (R !== null) stampG(vi(nodeOf(e.a)), vi(nodeOf(e.b)), 1 / R);
  }
  for (const bt of batteries)
    if (internal.has(bt.label)) stampG(internal.get(bt.label)!, vi(nodeOf(bt.a)), 1 / bt.internalResistance!);
  sources.forEach((s, k) => {
    const row = nV + k;
    // Current variable: flows from the + node through the source to the − node.
    if (s.plus >= 0) {
      A[s.plus][row] += 1;
      A[row][s.plus] += 1;
    }
    if (s.minus >= 0) {
      A[s.minus][row] -= 1;
      A[row][s.minus] -= 1;
    }
    rhs[row] = s.volts;
  });

  const x = gaussSolve(A, rhs);
  if (!x) {
    if (!opts.ammetersAsWires && els.some((e) => idealAmmeter(e, net))) {
      // Ammeters in a loop of their own: readings are undefined; solve with them as wires.
      const r = solveCircuit(net, { ammetersAsWires: true });
      for (const e of els)
        if (idealAmmeter(e, net)) r.elements[e.label] = { I: NaN, V: 0, P: 0, Is: NaN, Vs: 0 };
      r.warnings.push('ammeter-loop');
      return r;
    }
    warnings.push('conflicting-sources');
    return { ...zeroResult(), isShort: true, I: Infinity, Req: 0, Ptot: Infinity };
  }

  const nodeV = new Map<string, number>([[ground, 0]]);
  for (const [node, i] of idx) nodeV.set(node, x[i]);
  const vOf = (k: string) => nodeV.get(nodeOf(k)) ?? 0;
  const srcCurrent = new Map(sources.map((s, k) => [s.el.label, x[nV + k]]));

  const elements: Record<string, ElementResult> = {};
  let Ptot = 0;
  for (const e of els) {
    const vs = vOf(e.a) - vOf(e.b);
    const R = resistanceOf(e, net);
    if (e.kind === 'battery') {
      // MNA source current flows + → − inside the battery; the battery delivers its negative.
      const out = -(srcCurrent.get(e.label) ?? 0);
      const emf = e.voltage ?? 0;
      const vt = emf - out * (e.internalResistance ?? 0);
      Ptot += emf * out;
      elements[e.label] = { I: Math.abs(out), V: Math.abs(vt), P: Math.abs(vt * out), Is: -out, Vs: vt };
    } else if (R !== null) {
      const i = vs / R;
      elements[e.label] = { I: Math.abs(i), V: Math.abs(vs), P: Math.abs(vs * i), Is: i, Vs: vs };
    } else if (srcCurrent.has(e.label)) {
      const i = srcCurrent.get(e.label)!;
      elements[e.label] = { I: Math.abs(i), V: 0, P: 0, Is: i, Vs: 0 };
    } else if (e.kind === 'voltmeter' || e.kind === 'capacitor' || (e.kind === 'switch' && !e.closed)) {
      elements[e.label] = { I: 0, V: Math.abs(vs), P: 0, Is: 0, Vs: vs };
    } else elements[e.label] = { I: 0, V: 0, P: 0, Is: 0, Vs: 0 };
  }
  const b1r = b1 ? elements[b1.label] : undefined;
  const I = isOpen || !b1r ? 0 : -b1r.Is;
  return {
    I,
    Req: Math.abs(I) > 1e-9 ? b1r!.V / I : Infinity,
    Ptot: isOpen ? 0 : Ptot,
    n,
    isShort: false,
    isOpen,
    elements,
    nodeV,
    nodeOf,
    warnings,
  };
}
