import { z } from 'zod';
import { evalNumber, type Scope } from '../../engine/expr';
import { formatNumber } from '../../engine/format';
import type { ChallengeLogic, CheckScope } from '../types';
import { solveCircuit, type ElementKind, type Netlist, type NetElement, type SolveResult } from './solver';

/*
 * Grid model. Points are (x, y) with 0 ≤ x ≤ cols, 0 ≤ y ≤ rows. Every element occupies one
 * segment between two neighbouring points. The battery is fixed down column 0: + at (0, 0),
 * − at (0, rows). Points (0, 1)…(0, rows − 1) are inside the battery and take no connections.
 */

const numOrExpr = z.union([z.number(), z.string().min(1)]);
const kind = z.enum(['resistor', 'bulb', 'wire', 'switch', 'ammeter', 'voltmeter']);
const point = z.tuple([z.number().int().min(0), z.number().int().min(0)]);

export const configSchema = z.strictObject({
  battery: z.strictObject({ voltage: numOrExpr, internalResistance: numOrExpr.optional() }),
  palette: z
    .array(
      z.strictObject({
        kind,
        resistance: numOrExpr.optional(),
        count: z.union([z.number().int().min(1), z.literal('unlimited')]),
      }),
    )
    .min(1),
  grid: z.strictObject({ cols: z.number().int().min(2).max(12), rows: z.number().int().min(2).max(8) }),
  constraints: z.strictObject({ maxElements: z.number().int().min(1) }).optional(),
  preset: z
    .array(
      z.strictObject({
        kind,
        a: point,
        b: point,
        resistance: numOrExpr.optional(),
        closed: z.boolean().optional(),
        label: z.string().optional(),
        locked: z.boolean().optional(),
      }),
    )
    .optional(),
});

/**
 * Either a netlist (node 0 = battery −), laid out automatically for display, or — for challenges
 * that start from a preset circuit — grid edits applied to the preset.
 */
export const solutionSchema = z.union([
  z.strictObject({ netlist: z.array(z.string().min(1)).min(1) }),
  z.strictObject({
    grid: z.strictObject({
      remove: z.array(z.tuple([point, point])).optional(),
      add: z
        .array(
          z.strictObject({
            kind,
            a: point,
            b: point,
            resistance: numOrExpr.optional(),
            closed: z.boolean().optional(),
          }),
        )
        .min(1),
    }),
  }),
]);

export type RawConfig = z.infer<typeof configSchema>;
export type Solution = z.infer<typeof solutionSchema>;
export type Point = [number, number];

export interface PaletteEntry {
  kind: ElementKind;
  resistance?: number;
  count: number;
}

export interface Config {
  battery: { voltage: number; internalResistance: number };
  palette: PaletteEntry[];
  cols: number;
  rows: number;
  maxElements?: number;
  preset: GridElement[];
  vars: Scope;
}

export interface GridElement {
  id: string;
  kind: ElementKind;
  label: string;
  a: Point;
  b: Point;
  resistance?: number;
  closed?: boolean;
  locked?: boolean;
  palette?: number;
}

export interface State {
  elements: GridElement[];
  /** Set by solutionState when no grid layout fits; the component then shows the netlist. */
  netlist?: string[];
  /** Misconceptions from feedback rules hit so far (for the summary). */
  misconceptions?: string[];
}

export const PREFIX: Record<ElementKind, string> = {
  resistor: 'R',
  bulb: 'L',
  wire: 'W',
  switch: 'S',
  ammeter: 'A',
  voltmeter: 'V',
};

export const KIND_NAME: Record<ElementKind, string> = {
  resistor: 'resistor',
  bulb: 'bulb',
  wire: 'wire',
  switch: 'switch',
  ammeter: 'ammeter',
  voltmeter: 'voltmeter',
};

export const pkey = (p: Point) => `${p[0]},${p[1]}`;

export function nextLabel(elements: GridElement[], k: ElementKind): string {
  const used = new Set(elements.map((e) => e.label));
  for (let i = 1; ; i++) if (!used.has(`${PREFIX[k]}${i}`)) return `${PREFIX[k]}${i}`;
}

export function resolveConfig(
  raw: RawConfig,
  ctx: { num(v: number | string): number; scope: Scope },
): Config {
  const cols = raw.grid.cols;
  const rows = raw.grid.rows;
  const preset: GridElement[] = [];
  for (const [i, p] of (raw.preset ?? []).entries()) {
    const el: GridElement = {
      id: `preset-${i}`,
      kind: p.kind,
      label: p.label ?? nextLabel(preset, p.kind),
      a: p.a as Point,
      b: p.b as Point,
      resistance: p.resistance !== undefined ? ctx.num(p.resistance) : undefined,
      closed: p.kind === 'switch' ? (p.closed ?? false) : undefined,
      locked: p.locked ?? true,
    };
    preset.push(el);
  }
  return {
    battery: {
      voltage: ctx.num(raw.battery.voltage),
      internalResistance:
        raw.battery.internalResistance !== undefined ? ctx.num(raw.battery.internalResistance) : 0,
    },
    palette: raw.palette.map((p) => ({
      kind: p.kind,
      resistance: p.resistance !== undefined ? ctx.num(p.resistance) : undefined,
      count: p.count === 'unlimited' ? Infinity : p.count,
    })),
    cols,
    rows,
    maxElements: raw.constraints?.maxElements,
    preset,
    vars: ctx.scope,
  };
}

/** Segment validity: neighbouring points, inside the grid, not on the battery's column. */
export function validSegment(config: Config, a: Point, b: Point): boolean {
  const inside = (p: Point) => p[0] >= 0 && p[0] <= config.cols && p[1] >= 0 && p[1] <= config.rows;
  if (!inside(a) || !inside(b)) return false;
  const dx = Math.abs(a[0] - b[0]);
  const dy = Math.abs(a[1] - b[1]);
  if (dx + dy !== 1) return false;
  if (a[0] === 0 && b[0] === 0) return false; // battery column
  const body = (p: Point) => p[0] === 0 && p[1] > 0 && p[1] < config.rows;
  return !body(a) && !body(b);
}

export function segKey(a: Point, b: Point): string {
  const [p, q] = pkey(a) < pkey(b) ? [a, b] : [b, a];
  return `${pkey(p)}|${pkey(q)}`;
}

export function toNetlist(state: State, config: Config): Netlist {
  return {
    battery: {
      p: '0,0',
      n: `0,${config.rows}`,
      voltage: config.battery.voltage,
      internalResistance: config.battery.internalResistance,
    },
    elements: state.elements.map((e): NetElement => ({
      label: e.label,
      kind: e.kind,
      a: pkey(e.a),
      b: pkey(e.b),
      resistance: e.resistance,
      closed: e.closed,
    })),
  };
}

export function scopeFromResult(r: SolveResult, config?: Config): CheckScope {
  const s: CheckScope = {
    I: r.I,
    Req: r.Req,
    Ptot: r.Ptot,
    n: r.n,
    isShort: r.isShort,
    isOpen: r.isOpen,
  };
  // Parts that could be placed but aren't yet read 0, so rules like "P_L2 > 0" still evaluate.
  if (config) {
    const totals = new Map<ElementKind, number>();
    for (const p of config.palette)
      if (Number.isFinite(p.count)) totals.set(p.kind, (totals.get(p.kind) ?? 0) + p.count);
    for (const [k, n] of totals)
      for (let i = 1; i <= n; i++) {
        const label = `${PREFIX[k]}${i}`;
        s[`I_${label}`] = 0;
        s[`V_${label}`] = 0;
        s[`P_${label}`] = 0;
      }
  }
  for (const [label, el] of Object.entries(r.elements)) {
    s[`I_${label}`] = el.I;
    s[`V_${label}`] = el.V;
    s[`P_${label}`] = el.P;
  }
  return s;
}

const KIND_BY_PREFIX: [string, ElementKind][] = [
  ['R', 'resistor'],
  ['L', 'bulb'],
  ['W', 'wire'],
  ['S', 'switch'],
  ['A', 'ammeter'],
  ['V', 'voltmeter'],
];

export interface ParsedNetlist {
  net: Netlist;
  /** Battery nodes as written. */
  plus: string;
  minus: string;
}

/** Parse "<label> <node+> <node−> [valueExpr]" lines; node "0" is the battery's − terminal. */
export function parseNetlist(lines: string[], config: Config): ParsedNetlist {
  let plus: string | undefined;
  let minus: string | undefined;
  const elements: NetElement[] = [];
  for (const line of lines) {
    const [label, a, b, ...rest] = line.trim().split(/\s+/);
    if (!label || !a || !b) throw new Error(`bad netlist line "${line}"`);
    const value = rest.join(' ');
    if (label.startsWith('B')) {
      if (plus !== undefined) throw new Error('netlist has more than one battery');
      plus = a;
      minus = b;
      continue;
    }
    const k = KIND_BY_PREFIX.find(([p]) => label.startsWith(p))?.[1];
    if (!k) throw new Error(`unknown element "${label}"`);
    const el: NetElement = { label, kind: k, a, b };
    if (k === 'resistor' || k === 'bulb') {
      el.resistance = value
        ? evalNumber(value, config.vars)
        : config.palette.find((p) => p.kind === k)?.resistance;
      if (el.resistance === undefined) throw new Error(`no resistance for ${label}`);
    }
    if (k === 'switch') el.closed = value !== 'open';
    elements.push(el);
  }
  if (plus === undefined || minus === undefined) throw new Error('netlist has no battery (B1)');
  return {
    net: {
      battery: {
        p: plus,
        n: minus,
        voltage: config.battery.voltage,
        internalResistance: config.battery.internalResistance,
      },
      elements,
    },
    plus,
    minus,
  };
}

export function checkScope(state: State, config: Config): CheckScope {
  return scopeFromResult(solveCircuit(toNetlist(state, config)), config);
}

/** Apply grid edits to the preset; throws if an edit is invalid. */
export function applyGridSolution(grid: Extract<Solution, { grid: unknown }>['grid'], config: Config): State {
  const removeKeys = new Set((grid.remove ?? []).map(([a, b]) => segKey(a as Point, b as Point)));
  const elements = config.preset.filter((e) => !removeKeys.has(segKey(e.a, e.b)));
  const taken = new Set(elements.map((e) => segKey(e.a, e.b)));
  for (const add of grid.add) {
    const a = add.a as Point;
    const b = add.b as Point;
    if (!validSegment(config, a, b)) throw new Error(`grid solution: invalid segment ${pkey(a)}–${pkey(b)}`);
    const key = segKey(a, b);
    if (taken.has(key)) throw new Error(`grid solution: segment ${pkey(a)}–${pkey(b)} is occupied`);
    taken.add(key);
    const resistance =
      add.resistance !== undefined
        ? typeof add.resistance === 'number'
          ? add.resistance
          : evalNumber(add.resistance, config.vars)
        : config.palette.find((p) => p.kind === add.kind)?.resistance;
    elements.push({
      id: `sol:${key}`,
      kind: add.kind,
      label: nextLabel(elements, add.kind),
      a,
      b,
      resistance,
      closed: add.kind === 'switch' ? (add.closed ?? true) : undefined,
    });
  }
  return { elements };
}

export function solutionScope(solution: Solution, config: Config): CheckScope {
  if ('grid' in solution) return checkScope(applyGridSolution(solution.grid, config), config);
  return scopeFromResult(solveCircuit(parseNetlist(solution.netlist, config).net), config);
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  const out: T[][] = [];
  xs.forEach((x, i) => {
    for (const p of permutations([...xs.slice(0, i), ...xs.slice(i + 1)])) out.push([x, ...p]);
  });
  return out;
}

/**
 * Lay a netlist out on the grid: each node is a horizontal rail on its own row (battery + on
 * the top row, − on the bottom row) and each element sits vertically in its own column.
 * Returns null when nothing fits without unintended crossings.
 */
export function layoutNetlist(parsed: ParsedNetlist, config: Config): GridElement[] | null {
  const { net, plus, minus } = parsed;
  const els = net.elements;
  if (els.length > config.cols) return null;
  const others = [...new Set(els.flatMap((e) => [e.a, e.b]))].filter((n) => n !== plus && n !== minus);
  const freeRows = Array.from({ length: config.rows - 1 }, (_, i) => i + 1);
  if (others.length > freeRows.length) return null;

  const rowChoices = permutations(freeRows).map((p) => p.slice(0, others.length));
  const seen = new Set<string>();
  const orders = permutations(els.map((_, i) => i)).slice(0, 5040);
  for (const rows of rowChoices) {
    const k = rows.join(',');
    if (seen.has(k)) continue;
    seen.add(k);
    const rowOf = new Map<string, number>([
      [plus, 0],
      [minus, config.rows],
      ...others.map((n, i) => [n, rows[i]] as [string, number]),
    ]);
    for (const order of orders) {
      const colOf = new Map<number, number>(order.map((ei, c) => [ei, c + 1]));
      // Rail spans.
      const span = new Map<string, [number, number]>();
      const extend = (node: string, x: number) => {
        const s = span.get(node);
        span.set(node, s ? [Math.min(s[0], x), Math.max(s[1], x)] : [x, x]);
      };
      extend(plus, 0);
      extend(minus, 0);
      els.forEach((e, i) => {
        extend(e.a, colOf.get(i)!);
        extend(e.b, colOf.get(i)!);
      });
      let ok = true;
      els.forEach((e, i) => {
        if (!ok) return;
        const x = colOf.get(i)!;
        const ya = rowOf.get(e.a)!;
        const yb = rowOf.get(e.b)!;
        if (ya === yb) {
          ok = false;
          return;
        }
        const [lo, hi] = ya < yb ? [ya, yb] : [yb, ya];
        for (const [node, [x0, x1]] of span) {
          const y = rowOf.get(node)!;
          if (y > lo && y < hi && x >= x0 && x <= x1) ok = false;
        }
      });
      if (!ok) continue;

      const out: GridElement[] = [];
      let wireN = 0;
      const wire = (a: Point, b: Point) => {
        wireN++;
        out.push({ id: `sol-w${wireN}`, kind: 'wire', label: `W${wireN}`, a, b });
      };
      for (const [node, [x0, x1]] of span) {
        const y = rowOf.get(node)!;
        for (let x = x0; x < x1; x++) wire([x, y], [x + 1, y]);
      }
      els.forEach((e, i) => {
        const x = colOf.get(i)!;
        const ya = rowOf.get(e.a)!;
        const yb = rowOf.get(e.b)!;
        const [lo, hi] = ya < yb ? [ya, yb] : [yb, ya];
        const mid = lo + Math.floor((hi - lo - 1) / 2);
        for (let y = lo; y < hi; y++) {
          if (y === mid) {
            // Keep the element's a→b orientation for meters and current direction.
            const top: Point = [x, y];
            const bottom: Point = [x, y + 1];
            const aIsTop = ya < yb;
            out.push({
              id: `sol-${e.label}`,
              kind: e.kind,
              label: e.label,
              a: aIsTop ? top : bottom,
              b: aIsTop ? bottom : top,
              resistance: e.resistance,
              closed: e.closed,
            });
          } else wire([x, y], [x, y + 1]);
        }
      });
      return out;
    }
  }
  return null;
}

export function solutionState(solution: Solution, config: Config): State {
  if ('grid' in solution) return applyGridSolution(solution.grid, config);
  const parsed = parseNetlist(solution.netlist, config);
  const laid = layoutNetlist(parsed, config);
  if (laid) {
    const state: State = { elements: [...config.preset, ...laid] };
    // Only trust the layout if it behaves exactly like the netlist.
    const a = solveCircuit(parsed.net);
    const b = solveCircuit(toNetlist(state, config));
    if (Math.abs(a.I - b.I) <= 1e-9 * Math.max(1, Math.abs(a.I)) || (a.isOpen && b.isOpen)) return state;
  }
  return { elements: [...config.preset], netlist: solution.netlist };
}

export function initialState(config: Config): State {
  return { elements: [...config.preset] };
}

export function builtInFeedback(state: State, config: Config): string | null {
  const r = solveCircuit(toNetlist(state, config));
  if (r.isShort) return 'Short circuit! A zero-resistance path connects the battery terminals directly.';
  if (r.isOpen)
    return state.elements.some((e) => e.kind === 'voltmeter')
      ? 'No complete loop — current needs a closed path from + back to −. (A voltmeter in the path acts like a break.)'
      : 'No complete loop — current needs a closed path from + back to −.';
  if (r.warnings.includes('ammeter-loop'))
    return 'Two ammeters form a loop on their own; their readings are undefined.';
  return null;
}

function where(p: Point): string {
  return `column ${p[0]}, row ${p[1]}`;
}

export function describeElement(e: GridElement): string {
  const value =
    e.kind === 'resistor' || e.kind === 'bulb'
      ? ` (${formatNumber(e.resistance ?? 0)} Ω)`
      : e.kind === 'switch'
        ? e.closed
          ? ' (closed)'
          : ' (open)'
        : '';
  return `${KIND_NAME[e.kind]} ${e.label}${value} from ${where(e.a)} to ${where(e.b)}`;
}

export function describeState(state: State, config: Config): string {
  const parts = state.elements.filter((e) => e.kind !== 'wire');
  const wires = state.elements.length - parts.length;
  const r = solveCircuit(toNetlist(state, config));
  const status = r.isShort
    ? 'Short circuit.'
    : r.isOpen
      ? 'No complete loop; no current flows.'
      : `Battery current ${formatNumber(r.I)} A, equivalent resistance ${formatNumber(r.Req)} Ω.`;
  const meters = state.elements
    .filter((e) => e.kind === 'ammeter' || e.kind === 'voltmeter')
    .map((e) => {
      const x = r.elements[e.label];
      return e.kind === 'ammeter'
        ? `${e.label} reads ${formatNumber(x?.I ?? 0)} A`
        : `${e.label} reads ${formatNumber(x?.V ?? 0)} V`;
    });
  return [
    `Circuit with a ${formatNumber(config.battery.voltage)} V battery`,
    parts.length ? `${parts.map(describeElement).join('; ')}` : 'no components placed',
    `${wires} wire segment${wires === 1 ? '' : 's'}`,
    status,
    ...meters,
  ].join('. ');
}

export const circuitLogic: ChallengeLogic<RawConfig, Config, State, Solution> = {
  type: 'circuit-builder',
  configSchema,
  solutionSchema,
  resolveConfig,
  initialState,
  checkScope,
  builtInFeedback,
  solutionScope,
  solutionState,
  describeState,
};
