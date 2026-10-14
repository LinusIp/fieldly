import { z } from 'zod';
import { evalNumber, type Scope } from '../../engine/expr';
import { formatNumber } from '../../engine/format';
import type { CheckScope, InteractiveModel, ResolveCtx } from '../types';
import { solveCircuit, type ElementKind, type Netlist, type NetElement, type SolveResult } from './solver';

/*
 * circuit-builder (§9.4). Two ways to use it:
 * - **Preset** (`preset` netlist; view/explore modes and hotspot questions): the layout is fixed and
 *   only `controls` change values (`locked` is implied).
 * - **Build** (`battery`/`batteries` + `palette`; challenges): the learner places parts on a snap
 *   grid. B1 sits on the left edge: + at (0, 0), − at (0, rows).
 * Netlist lines: "<label> <node+> <node−> [valueExpr]". Prefixes: B battery, R resistor, L bulb,
 * C capacitor, S switch, A ammeter, M voltmeter (W wire, in layouts). Node 0 is B1's − terminal.
 */

const numOrExpr = z.union([z.number(), z.string().min(1)]);
const partKind = z.enum(['resistor', 'bulb', 'capacitor', 'switch', 'ammeter', 'voltmeter', 'wire']);
const BatterySchema = z.strictObject({ voltage: numOrExpr, internalResistance: numOrExpr.optional() });

export const configSchema = z
  .strictObject({
    locked: z.boolean().optional(),
    preset: z.array(z.string().min(1)).min(1).optional(),
    controls: z
      .array(
        z.strictObject({
          element: z.string().min(1),
          param: z.enum(['voltage', 'resistance', 'closed']),
          min: z.number().optional(),
          max: z.number().optional(),
          step: z.number().positive().optional(),
          initial: numOrExpr.optional(),
        }),
      )
      .optional(),
    hideReadings: z.boolean().optional(),
    batteries: z.array(BatterySchema).min(1).optional(),
    battery: BatterySchema.optional(),
    palette: z
      .array(
        z.strictObject({
          kind: partKind,
          resistance: numOrExpr.optional(),
          capacitance: numOrExpr.optional(),
          count: z.union([z.number().int().min(1), z.literal('unlimited')]),
        }),
      )
      .optional(),
    meters: z
      .strictObject({ ammeterResistance: numOrExpr.optional(), voltmeterResistance: numOrExpr.optional() })
      .optional(),
    grid: z
      .strictObject({ cols: z.number().int().min(2).max(12), rows: z.number().int().min(2).max(8) })
      .optional(),
  })
  .superRefine((c, ctx) => {
    const add = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (!c.preset && !c.battery && !c.batteries)
      add('give a preset netlist, or a battery (or batteries) to build with');
    if (c.battery && c.batteries) add('use battery or batteries, not both');
    if (c.controls && !c.preset) add('controls need a preset');
    if (c.preset && c.palette) add('a preset circuit is fixed; it has no palette');
  });

/** A netlist (build mode, challenges) or control values keyed by element label (explore tasks). */
export const solutionSchema = z.union([
  z.strictObject({ netlist: z.array(z.string().min(1)).min(1) }),
  z.record(z.string().regex(/^[BRLS]\d+$/), z.union([z.number(), z.string().min(1)])),
]);

export type RawConfig = z.infer<typeof configSchema>;
export type Solution = z.infer<typeof solutionSchema>;
export type Point = [number, number];
export type ControlParam = 'voltage' | 'resistance' | 'closed';

export interface Control {
  element: string;
  param: ControlParam;
  min: number;
  max: number;
  step: number;
  initial: number;
}

export interface PaletteEntry {
  kind: ElementKind;
  resistance?: number;
  capacitance?: number;
  count: number;
}

export interface Config {
  mode: 'preset' | 'build';
  /** Preset parts with their values (preset mode). */
  preset: NetElement[];
  controls: Control[];
  hideReadings: boolean;
  /** Build mode batteries: B1 on the grid edge, B2… placeable. */
  batteries: { voltage: number; internalResistance: number }[];
  palette: PaletteEntry[];
  meters: { ammeterResistance?: number; voltmeterResistance?: number };
  cols: number;
  rows: number;
  vars: Scope;
}

export interface GridElement {
  id: string;
  kind: ElementKind;
  label: string;
  a: Point;
  b: Point;
  resistance?: number;
  capacitance?: number;
  voltage?: number;
  closed?: boolean;
  locked?: boolean;
}

export interface State {
  /** Placed parts (build mode). */
  elements: GridElement[];
  /** Control values keyed by element label (preset mode). */
  values: Record<string, number>;
  /** A solution netlist that has no grid layout; the view lists it instead. */
  netlist?: string[];
}

export const PREFIX: Record<ElementKind, string> = {
  battery: 'B',
  resistor: 'R',
  bulb: 'L',
  capacitor: 'C',
  wire: 'W',
  switch: 'S',
  ammeter: 'A',
  voltmeter: 'M',
};

export const KIND_NAME: Record<ElementKind, string> = {
  battery: 'battery',
  resistor: 'resistor',
  bulb: 'bulb',
  capacitor: 'capacitor',
  wire: 'wire',
  switch: 'switch',
  ammeter: 'ammeter',
  voltmeter: 'voltmeter',
};

const KIND_OF_PREFIX = new Map<string, ElementKind>(
  Object.entries(PREFIX).map(([k, p]) => [p, k as ElementKind]),
);

export function kindOfLabel(label: string): ElementKind {
  const k = KIND_OF_PREFIX.get(label[0]);
  if (!k || !/^[A-Z]\d+$/.test(label)) throw new Error(`unknown element "${label}"`);
  return k;
}

export const PARAM_OF: Partial<Record<ElementKind, ControlParam>> = {
  battery: 'voltage',
  resistor: 'resistance',
  bulb: 'resistance',
  switch: 'closed',
};

export const pkey = (p: Point) => `${p[0]},${p[1]}`;

export function nextLabel(elements: GridElement[], k: ElementKind): string {
  const used = new Set(elements.map((e) => e.label));
  for (let i = 1; ; i++) if (!used.has(`${PREFIX[k]}${i}`)) return `${PREFIX[k]}${i}`;
}

/** Parse one netlist line. `value` overrides are applied by the caller. */
function parseLine(line: string, vars: Scope): NetElement & { rawValue?: string } {
  const [label, a, b, ...rest] = line.trim().split(/\s+/);
  if (!label || !a || !b) throw new Error(`bad netlist line "${line}"`);
  const kind = kindOfLabel(label);
  const value = rest.join(' ');
  const el: NetElement & { rawValue?: string } = { label, kind, a, b, rawValue: value || undefined };
  if (!value) return el;
  if (kind === 'switch') el.closed = !/^(open|0|false)$/i.test(value);
  else {
    const v = evalNumber(value, vars);
    if (kind === 'battery') el.voltage = v;
    else if (kind === 'capacitor') el.capacitance = v;
    else if (kind === 'resistor' || kind === 'bulb') el.resistance = v;
  }
  return el;
}

export function resolveConfig(raw: RawConfig, ctx: ResolveCtx): Config {
  const vars = ctx.scope;
  const preset = (raw.preset ?? []).map((l) => {
    const el = parseLine(l, vars);
    if (el.kind === 'switch' && el.closed === undefined) el.closed = true;
    return el;
  });
  const labels = new Set<string>();
  for (const e of preset) {
    if (labels.has(e.label)) throw new Error(`duplicate element "${e.label}" in the preset`);
    labels.add(e.label);
  }
  if (raw.preset && !preset.some((e) => e.label === 'B1')) throw new Error('a preset needs a battery B1');
  const controls: Control[] = (raw.controls ?? []).map((c) => {
    const el = preset.find((e) => e.label === c.element);
    if (!el) throw new Error(`control refers to unknown element "${c.element}"`);
    if (PARAM_OF[el.kind] !== c.param) throw new Error(`${c.element} has no "${c.param}" control`);
    const current =
      c.param === 'voltage' ? el.voltage : c.param === 'resistance' ? el.resistance : el.closed ? 1 : 0;
    const initial = c.initial !== undefined ? ctx.num(c.initial) : (current ?? c.min ?? 0);
    return {
      element: c.element,
      param: c.param,
      min: c.param === 'closed' ? 0 : (c.min ?? 0),
      max: c.param === 'closed' ? 1 : (c.max ?? Math.max(initial * 2, 1)),
      step: c.param === 'closed' ? 1 : (c.step ?? 1),
      initial,
    };
  });
  const bats = raw.batteries ?? (raw.battery ? [raw.battery] : []);
  return {
    mode: raw.preset ? 'preset' : 'build',
    preset,
    controls,
    hideReadings: raw.hideReadings ?? false,
    batteries: bats.map((b) => ({
      voltage: ctx.num(b.voltage),
      internalResistance: b.internalResistance !== undefined ? ctx.num(b.internalResistance) : 0,
    })),
    palette: (raw.palette ?? [])
      .filter((p) => p.kind !== 'wire')
      .map((p) => ({
        kind: p.kind,
        resistance: p.resistance !== undefined ? ctx.num(p.resistance) : undefined,
        capacitance: p.capacitance !== undefined ? ctx.num(p.capacitance) : undefined,
        count: p.count === 'unlimited' ? Infinity : p.count,
      })),
    meters: {
      ammeterResistance:
        raw.meters?.ammeterResistance !== undefined ? ctx.num(raw.meters.ammeterResistance) : undefined,
      voltmeterResistance:
        raw.meters?.voltmeterResistance !== undefined ? ctx.num(raw.meters.voltmeterResistance) : undefined,
    },
    cols: raw.grid?.cols ?? 6,
    rows: raw.grid?.rows ?? 4,
    vars,
  };
}

/** Values a control or preset part currently has. */
export function controlValue(state: State, config: Config, label: string): number | undefined {
  if (label in state.values) return state.values[label];
  return config.controls.find((c) => c.element === label)?.initial;
}

function withValue(e: NetElement, v: number): NetElement {
  if (e.kind === 'battery') return { ...e, voltage: v };
  if (e.kind === 'switch') return { ...e, closed: v >= 0.5 };
  return { ...e, resistance: v };
}

/** The circuit to solve for a state. */
export function toNetlist(state: State, config: Config): Netlist {
  const meters = config.meters;
  if (config.mode === 'preset') {
    const elements = config.preset.map((e) => {
      const v = controlValue(state, config, e.label);
      return v === undefined ? e : withValue(e, v);
    });
    return { elements, meters };
  }
  const b1 = config.batteries[0];
  const battery: NetElement = {
    label: 'B1',
    kind: 'battery',
    a: '0,0',
    b: `0,${config.rows}`,
    voltage: b1.voltage,
    internalResistance: b1.internalResistance,
  };
  const elements = state.elements.map((e): NetElement => ({
    label: e.label,
    kind: e.kind,
    a: pkey(e.a),
    b: pkey(e.b),
    resistance: e.resistance,
    capacitance: e.capacitance,
    voltage: e.voltage,
    internalResistance:
      e.kind === 'battery' ? config.batteries[Number(e.label.slice(1)) - 1]?.internalResistance : undefined,
    closed: e.closed,
  }));
  return { elements: [battery, ...elements], meters };
}

/** Build-mode netlist (a solution): values come from the batteries and palette, in order. */
export function parseBuildNetlist(lines: string[], config: Config): Netlist {
  const els = lines.map((l) => parseLine(l, config.vars));
  const labels = new Set<string>();
  const used = new Map<ElementKind, number>();
  const pools = new Map<ElementKind, PaletteEntry[]>();
  for (const p of config.palette) pools.set(p.kind, [...(pools.get(p.kind) ?? []), p]);
  for (const e of els) {
    if (labels.has(e.label)) throw new Error(`duplicate element "${e.label}"`);
    labels.add(e.label);
    if (e.kind === 'wire') continue;
    const n = (used.get(e.kind) ?? 0) + 1;
    used.set(e.kind, n);
    if (e.kind === 'battery') {
      const bt = config.batteries[n - 1];
      if (!bt)
        throw new Error(`the solution uses more batteries than the ${config.batteries.length} available`);
      if (e.voltage === undefined) e.voltage = bt.voltage;
      e.internalResistance = bt.internalResistance;
      continue;
    }
    // The n-th part of a kind takes the palette entries' values in order.
    let left = n;
    let entry: PaletteEntry | undefined;
    for (const p of pools.get(e.kind) ?? []) {
      if (left <= p.count) {
        entry = p;
        break;
      }
      left -= p.count;
    }
    if (!entry) throw new Error(`the solution uses more ${KIND_NAME[e.kind]}s than the palette allows`);
    if ((e.kind === 'resistor' || e.kind === 'bulb') && e.resistance === undefined)
      e.resistance = entry.resistance;
    if (e.kind === 'capacitor' && e.capacitance === undefined) e.capacitance = entry.capacitance;
    if (e.kind === 'switch' && e.closed === undefined) e.closed = true;
  }
  if (!els.some((e) => e.label === 'B1')) throw new Error('the netlist needs B1');
  return { elements: els.map(({ rawValue: _r, ...e }) => e), meters: config.meters };
}

export function scopeFromResult(r: SolveResult, net: Netlist, config: Config): CheckScope {
  const s: CheckScope = { I: r.I, Req: r.Req, Ptot: r.Ptot, n: r.n, isShort: r.isShort, isOpen: r.isOpen };
  // Parts that could be placed but aren't yet read 0, so rules like "P_L2 > 0" still evaluate.
  const totals = new Map<ElementKind, number>();
  for (const p of config.palette)
    if (Number.isFinite(p.count)) totals.set(p.kind, (totals.get(p.kind) ?? 0) + p.count);
  for (const [k, n] of totals)
    for (let i = 1; i <= n; i++) for (const q of ['I', 'V', 'P', 'Is', 'Vs']) s[`${q}_${PREFIX[k]}${i}`] = 0;
  for (const e of net.elements) {
    const x = r.elements[e.label];
    if (!x) continue;
    s[`I_${e.label}`] = x.I;
    s[`V_${e.label}`] = x.V;
    s[`P_${e.label}`] = x.P;
    s[`Is_${e.label}`] = x.Is;
    s[`Vs_${e.label}`] = x.Vs;
    if (e.resistance !== undefined) s[`R_${e.label}`] = e.resistance;
    if (e.kind === 'switch') s[`closed_${e.label}`] = e.closed ? 1 : 0;
  }
  return s;
}

export function checkScope(state: State, config: Config): CheckScope {
  const net = toNetlist(state, config);
  return scopeFromResult(solveCircuit(net), net, config);
}

/** Control values from a solution record (explore tasks): B → voltage, R/L → resistance, S → closed. */
function resolveValues(sol: Record<string, number | string>, config: Config): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [label, v] of Object.entries(sol)) {
    if (config.mode !== 'preset' || !config.preset.some((e) => e.label === label))
      throw new Error(`solution sets "${label}", which isn't in the preset`);
    out[label] = typeof v === 'number' ? v : evalNumber(v, config.vars);
  }
  return out;
}

export function applySolution(state: State, solution: Solution, config: Config): State {
  if ('netlist' in solution && Array.isArray(solution.netlist)) return solutionState(solution, config);
  return {
    ...state,
    values: { ...state.values, ...resolveValues(solution as Record<string, number | string>, config) },
  };
}

export function solutionScope(solution: Solution, config: Config): CheckScope {
  if ('netlist' in solution && Array.isArray(solution.netlist)) {
    if (config.mode !== 'build') throw new Error('a netlist solution needs a build-mode circuit');
    const net = parseBuildNetlist(solution.netlist, config);
    return scopeFromResult(solveCircuit(net), net, config);
  }
  return checkScope(applySolution(initialState(config), solution, config), config);
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
 * Lay a netlist out on the grid: B1's + node is the top rail, its − node the bottom rail, every
 * other node a horizontal rail on its own row, and each other element sits vertically in its own
 * column. Returns null when nothing fits without unintended crossings.
 */
export function layoutNetlist(net: Netlist, config: Pick<Config, 'cols' | 'rows'>): GridElement[] | null {
  const b1 = net.elements.find((e) => e.label === 'B1');
  if (!b1) return null;
  const plus = b1.a;
  const minus = b1.b;
  const els = net.elements.filter((e) => e !== b1);
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
        out.push({ id: `w${wireN}`, kind: 'wire', label: `W${wireN}`, a, b, locked: true });
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
            const top: Point = [x, y];
            const bottom: Point = [x, y + 1];
            const aIsTop = ya < yb;
            out.push({
              id: `el-${e.label}`,
              kind: e.kind,
              label: e.label,
              a: aIsTop ? top : bottom,
              b: aIsTop ? bottom : top,
              resistance: e.resistance,
              capacitance: e.capacitance,
              voltage: e.voltage,
              closed: e.closed,
              locked: true,
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
  if (!('netlist' in solution) || !Array.isArray(solution.netlist))
    return applySolution(initialState(config), solution, config);
  const net = parseBuildNetlist(solution.netlist, config);
  const laid = layoutNetlist(net, config);
  if (laid) {
    const state: State = { elements: laid.map((e) => ({ ...e, locked: false })), values: {} };
    // Only trust the layout if it behaves exactly like the netlist.
    const a = solveCircuit(net);
    const b = solveCircuit(toNetlist(state, config));
    if (Math.abs(a.I - b.I) <= 1e-9 * Math.max(1, Math.abs(a.I)) || (a.isOpen && b.isOpen)) return state;
  }
  return { elements: [], values: {}, netlist: solution.netlist };
}

export function initialState(config: Config): State {
  return { elements: [], values: Object.fromEntries(config.controls.map((c) => [c.element, c.initial])) };
}

/** Element labels in a preset (hotspot targets). */
export function elementIds(config: Config): string[] {
  return config.preset.map((e) => e.label);
}

export function builtInFeedback(state: State, config: Config): string | null {
  const r = solveCircuit(toNetlist(state, config));
  if (r.isShort) return 'Short circuit! A zero-resistance path connects a battery’s terminals directly.';
  if (r.isOpen) return 'No complete loop — current needs a closed path from + back to −.';
  if (r.warnings.includes('ammeter-loop'))
    return 'Two ammeters form a loop on their own; their readings are undefined.';
  return null;
}

function valueText(e: NetElement): string {
  if (e.kind === 'resistor' || e.kind === 'bulb') return ` (${formatNumber(e.resistance ?? 0)} Ω)`;
  if (e.kind === 'battery') return ` (${formatNumber(e.voltage ?? 0)} V)`;
  if (e.kind === 'switch') return e.closed ? ' (closed)' : ' (open)';
  return '';
}

export function describeState(state: State, config: Config): string {
  const net = toNetlist(state, config);
  const r = solveCircuit(net);
  const parts = net.elements.filter((e) => e.kind !== 'wire');
  const status = r.isShort
    ? 'Short circuit.'
    : r.isOpen
      ? 'No complete loop; no current flows.'
      : `Battery current ${formatNumber(r.I)} A.`;
  const meters = config.hideReadings
    ? []
    : net.elements
        .filter((e) => e.kind === 'ammeter' || e.kind === 'voltmeter')
        .map((e) => {
          const x = r.elements[e.label];
          return e.kind === 'ammeter'
            ? `${e.label} reads ${formatNumber(x?.I ?? 0)} A`
            : `${e.label} reads ${formatNumber(x?.V ?? 0)} V`;
        });
  return [
    `Circuit: ${parts.map((e) => `${KIND_NAME[e.kind]} ${e.label}${valueText(e)}`).join('; ')}`,
    config.hideReadings ? '' : status,
    ...meters,
  ]
    .filter(Boolean)
    .join('. ');
}

export const circuitLogic: InteractiveModel<RawConfig, Config, State, Solution> = {
  type: 'circuit-builder',
  configSchema: configSchema as unknown as z.ZodType<RawConfig>,
  solutionSchema: solutionSchema as unknown as z.ZodType<Solution>,
  modes: ['view', 'explore', 'challenge', 'sandbox'],
  resolveConfig,
  initialState,
  checkScope,
  builtInFeedback,
  solutionScope,
  solutionState,
  applySolution,
  describeState,
};
