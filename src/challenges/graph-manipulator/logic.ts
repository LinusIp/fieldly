import { z } from 'zod';
import { evalNumber, math, type Scope } from '../../engine/expr';
import { formatNumber } from '../../engine/format';
import { derivativeAt, integrate, maxAbsOn, type RealFn } from '../../engine/numeric';
import type { ChallengeLogic, CheckScope, ResolveCtx } from '../types';

/*
 * graph-manipulator (§9.2): a plot of y = f(x), a parametric curve (x(t), y(t)) or a polar curve
 * r(θ), with sliders for named controls. In function mode a control can also be dragged along the
 * curve, and overlays show a tangent, a secant, a shaded area, the derivative, an accumulation
 * function, an ε-band, a target curve and data points.
 */

const numOrExpr = z.union([z.number(), z.string().min(1)]);
const name = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/);

export const configSchema = z
  .strictObject({
    mode: z.enum(['function', 'parametric', 'polar']).default('function'),
    /** function mode: y = f(x); may use the controls and lesson params. */
    f: z.string().min(1).optional(),
    /** parametric mode: x(t), y(t). */
    x: z.string().min(1).optional(),
    y: z.string().min(1).optional(),
    /** polar mode: r(t), t = θ. */
    r: z.string().min(1).optional(),
    /** Parameter range for parametric / polar curves. */
    t: z.tuple([numOrExpr, numOrExpr]).optional(),
    view: z.strictObject({ x: z.tuple([numOrExpr, numOrExpr]), y: z.tuple([numOrExpr, numOrExpr]) }),
    controls: z
      .array(
        z.strictObject({
          name,
          label: z.string().optional(),
          min: numOrExpr,
          max: numOrExpr,
          step: numOrExpr,
          initial: numOrExpr.optional(),
          /** function mode: also draw a handle at (value, f(value)) that can be dragged. */
          drag: z.boolean().optional(),
        }),
      )
      .min(1),
    overlays: z
      .strictObject({
        /** Tangent line at each x (a control name or an expression). */
        tangent: z.union([numOrExpr, z.array(numOrExpr).min(1)]).optional(),
        /** Secant from x0 to x0 + h (control names or expressions). */
        secant: z.strictObject({ at: numOrExpr, h: numOrExpr }).optional(),
        /** Shaded signed area between a and b (control names or expressions). */
        area: z.strictObject({ a: numOrExpr, b: numOrExpr }).optional(),
        derivative: z.boolean().optional(),
        /** A(x) = ∫ from `from` to x of f; `at` (a control or expression) is where A is reported. */
        accumulation: z.strictObject({ from: numOrExpr, at: numOrExpr.optional() }).optional(),
        /** Horizontal band y = L ± ε, with an optional vertical line at x = a and strip a ± dx (an ε–δ box). */
        band: z
          .strictObject({ y: numOrExpr, eps: numOrExpr, x: numOrExpr.optional(), dx: numOrExpr.optional() })
          .optional(),
        /** A target curve (same mode as the plot) for matching challenges. */
        target: z
          .strictObject({
            f: z.string().optional(),
            x: z.string().optional(),
            y: z.string().optional(),
            r: z.string().optional(),
          })
          .optional(),
        /** Data points for fitting (sse). */
        data: z.array(z.tuple([z.number(), z.number()])).optional(),
      })
      .optional(),
  })
  .superRefine((c, ctx) => {
    const need = (ok: boolean, msg: string) => ok || ctx.addIssue({ code: 'custom', message: msg });
    if (c.mode === 'function') need(!!c.f, 'function mode needs f');
    if (c.mode === 'parametric') need(!!c.x && !!c.y && !!c.t, 'parametric mode needs x, y and t');
    if (c.mode === 'polar') need(!!c.r && !!c.t, 'polar mode needs r and t');
    if (c.mode !== 'function') {
      const o = c.overlays ?? {};
      need(
        !o.tangent && !o.secant && !o.area && !o.derivative && !o.accumulation && !o.band && !o.data,
        'tangent, secant, area, derivative, accumulation, band and data overlays need function mode',
      );
      need(!c.controls.some((k) => k.drag), 'draggable controls need function mode');
    }
    const o = c.overlays ?? {};
    if (o.target) {
      const t = o.target;
      if (c.mode === 'function') need(!!t.f, 'target needs f in function mode');
      if (c.mode === 'parametric') need(!!t.x && !!t.y, 'target needs x and y in parametric mode');
      if (c.mode === 'polar') need(!!t.r, 'target needs r in polar mode');
    }
  });

/** Values for every control (numbers or expressions over the lesson params). */
export const solutionSchema = z.record(z.string(), numOrExpr);

export type RawConfig = z.infer<typeof configSchema>;
export type Solution = z.infer<typeof solutionSchema>;

export interface Control {
  name: string;
  label: string;
  min: number;
  max: number;
  step: number;
  initial: number;
  drag: boolean;
}

export interface Config {
  mode: RawConfig['mode'];
  f?: string;
  x?: string;
  y?: string;
  r?: string;
  t: [number, number];
  /** Plot window; entries may be expressions in the controls (e.g. a zoom width), so it is resolved per state. */
  view: { x: [number | string, number | string]; y: [number | string, number | string] };
  controls: Control[];
  /** Overlay positions may name controls, so they are resolved per state (see `model`). */
  tangents: (number | string)[];
  secant?: { at: number | string; h: number | string };
  /** Area bounds stay raw so they can name controls; resolved per state. */
  area?: { a: number | string; b: number | string };
  derivative: boolean;
  accumulation?: { from: number; at?: number | string };
  /** May name controls (e.g. a guessed limit L), so it is resolved per state. */
  band?: { y: number | string; eps: number | string; x?: number | string; dx?: number | string };
  target?: { f?: string; x?: string; y?: string; r?: string };
  data: [number, number][];
  vars: Scope;
}

export interface State {
  values: Record<string, number>;
}

export function resolveConfig(raw: RawConfig, ctx: ResolveCtx): Config {
  const o = raw.overlays ?? {};
  const controls = raw.controls.map((k) => {
    const min = ctx.num(k.min);
    return {
      name: k.name,
      label: k.label ?? k.name,
      min,
      max: ctx.num(k.max),
      step: ctx.num(k.step),
      initial: k.initial !== undefined ? ctx.num(k.initial) : min,
      drag: k.drag ?? false,
    };
  });
  return {
    mode: raw.mode,
    f: raw.f,
    x: raw.x,
    y: raw.y,
    r: raw.r,
    t: raw.t ? [ctx.num(raw.t[0]), ctx.num(raw.t[1])] : [0, 1],
    view: raw.view,
    controls,
    tangents: o.tangent === undefined ? [] : Array.isArray(o.tangent) ? o.tangent : [o.tangent],
    secant: o.secant,
    area: o.area,
    derivative: o.derivative ?? false,
    accumulation: o.accumulation ? { from: ctx.num(o.accumulation.from), at: o.accumulation.at } : undefined,
    band: o.band,
    target: o.target,
    data: o.data ?? [],
    vars: ctx.scope,
  };
}

export function currentValues(state: State, config: Config): Record<string, number> {
  const v: Record<string, number> = {};
  for (const k of config.controls) v[k.name] = state.values[k.name] ?? k.initial;
  return v;
}

/** Compile an expression in one variable over the params and current control values. */
function fn1(expr: string, variable: string, scope: Scope): RealFn {
  const code = math.compile(expr);
  return (u: number) => {
    try {
      const r = code.evaluate({ ...scope, [variable]: u });
      return typeof r === 'number' ? r : NaN;
    } catch {
      return NaN;
    }
  };
}

/** Everything the plot and the checks need, for one set of control values. */
export function model(config: Config, values: Record<string, number>) {
  const scope: Scope = { ...config.vars, ...values };
  const f = config.f ? fn1(config.f, 'x', scope) : undefined;
  const fp: RealFn | undefined = f ? (x) => derivativeAt(f, x) : undefined;
  const num = (v: number | string) => (typeof v === 'number' ? v : evalNumber(v, scope));
  const area = config.area ? { a: num(config.area.a), b: num(config.area.b) } : undefined;
  const A: RealFn | undefined =
    f && config.accumulation ? (x) => integrate(f, config.accumulation!.from, x, 1e-8) : undefined;
  const curve = (which: { f?: string; x?: string; y?: string; r?: string }) => {
    if (config.mode === 'function') {
      const g = fn1(which.f!, 'x', scope);
      return (u: number): [number, number] => [u, g(u)];
    }
    if (config.mode === 'parametric') {
      const gx = fn1(which.x!, 't', scope);
      const gy = fn1(which.y!, 't', scope);
      return (u: number): [number, number] => [gx(u), gy(u)];
    }
    const gr = fn1(which.r!, 't', scope);
    return (u: number): [number, number] => {
      const rr = gr(u);
      return [rr * Math.cos(u), rr * Math.sin(u)];
    };
  };
  const main = curve(config);
  const target = config.target ? curve(config.target) : undefined;
  const view = {
    x: [num(config.view.x[0]), num(config.view.x[1])] as [number, number],
    y: [num(config.view.y[0]), num(config.view.y[1])] as [number, number],
  };
  const band = config.band
    ? {
        y: num(config.band.y),
        eps: num(config.band.eps),
        x: config.band.x !== undefined ? num(config.band.x) : undefined,
        dx: config.band.dx !== undefined ? num(config.band.dx) : undefined,
      }
    : undefined;
  const tangents = config.tangents.map(num);
  const secant = config.secant ? { at: num(config.secant.at), h: num(config.secant.h) } : undefined;
  const accAt = config.accumulation?.at !== undefined ? num(config.accumulation.at) : undefined;
  /** The point the readouts (f(x₀), slopes, A(x₀)) refer to. */
  const x0 =
    tangents[0] ??
    secant?.at ??
    accAt ??
    (config.controls.some((k) => k.name === 'x0') ? values.x0 : undefined);
  return { scope, f, fp, A, area, main, target, view, band, tangents, secant, x0 };
}

/** Parameter range sampled for the plot and for matchError. */
export function domain(config: Config, m: ReturnType<typeof model>): [number, number] {
  return config.mode === 'function' ? m.view.x : config.t;
}

/** Largest distance between the curve and the target at matching parameter values. */
export function matchError(config: Config, m: ReturnType<typeof model>): number {
  if (!m.target) return NaN;
  const [lo, hi] = domain(config, m);
  let worst = 0;
  for (let i = 0; i <= 400; i++) {
    const u = lo + ((hi - lo) * i) / 400;
    const [x1, y1] = m.main(u);
    const [x2, y2] = m.target(u);
    const d = Math.hypot(x1 - x2, y1 - y2);
    if (Number.isFinite(d) && d > worst) worst = d;
  }
  return worst;
}

function scopeFor(values: Record<string, number>, config: Config): CheckScope {
  const m = model(config, values);
  const s: CheckScope = { ...values };
  if (m.f && m.fp) {
    const f = m.f;
    const fp = m.fp;
    s.f = (x: number) => f(x);
    s.fp = (x: number) => fp(x);
    /** max |f(x) − c| on [lo, hi], skipping points where f is undefined. */
    s.maxDev = (lo: number, hi: number, c: number) => maxAbsOn((x) => f(x) - c, lo, hi);
    if (m.x0 !== undefined) {
      const x0 = m.x0;
      s.x0 = x0;
      s.fx0 = f(x0);
      s.fpx0 = fp(x0);
      if (m.secant) {
        const { at, h } = m.secant;
        s.secantSlope = (f(at + h) - f(at)) / h;
      }
      if (m.A) s.Ax0 = m.A(x0);
    }
    if (m.A) {
      const A = m.A;
      s.A = (x: number) => A(x);
    }
    if (m.area) {
      s.a = m.area.a;
      s.b = m.area.b;
      s.area = integrate(f, m.area.a, m.area.b, 1e-9);
    }
    if (config.data.length) s.sse = config.data.reduce((acc, [x, y]) => acc + (y - f(x)) ** 2, 0);
  }
  if (m.target) s.matchError = matchError(config, m);
  return s;
}

export function checkScope(state: State, config: Config): CheckScope {
  return scopeFor(currentValues(state, config), config);
}

export function solutionState(solution: Solution, config: Config): State {
  const values: Record<string, number> = {};
  for (const [k, v] of Object.entries(solution))
    values[k] = typeof v === 'number' ? v : evalNumber(v, config.vars);
  return { values };
}

export function solutionScope(solution: Solution, config: Config): CheckScope {
  return checkScope(solutionState(solution, config), config);
}

export function initialState(config: Config): State {
  return { values: Object.fromEntries(config.controls.map((k) => [k.name, k.initial])) };
}

export function describeState(state: State, config: Config): string {
  const values = currentValues(state, config);
  const s = scopeFor(values, config);
  const parts = [config.controls.map((k) => `${k.label} = ${formatNumber(values[k.name])}`).join(', ')];
  const n = (k: string) => (typeof s[k] === 'number' ? formatNumber(s[k] as number) : null);
  if (n('fx0') !== null && (config.tangents.length || config.secant || config.accumulation))
    parts.push(`f(x₀) = ${n('fx0')}`);
  if (config.tangents.length) parts.push(`tangent slope ${n('fpx0')}`);
  if (config.secant) parts.push(`secant slope ${n('secantSlope')}`);
  if (config.accumulation && n('Ax0') !== null) parts.push(`A(x₀) = ${n('Ax0')}`);
  if (config.area) parts.push(`signed area ${n('area')}`);
  if (config.data.length) parts.push(`sum of squared errors ${n('sse')}`);
  if (config.target) parts.push(`largest gap to the target ${n('matchError')}`);
  return parts.join('; ') + '.';
}

export const graphLogic: ChallengeLogic<RawConfig, Config, State, Solution> = {
  type: 'graph-manipulator',
  configSchema: configSchema as unknown as z.ZodType<RawConfig>,
  solutionSchema,
  resolveConfig,
  initialState,
  checkScope,
  solutionScope,
  solutionState,
  describeState,
};
