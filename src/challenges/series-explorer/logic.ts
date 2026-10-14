import { z } from 'zod';
import { evalNumber, math, type Scope } from '../../engine/expr';
import { formatNumber } from '../../engine/format';
import { maxAbsOn, type RealFn } from '../../engine/numeric';
import type { ChallengeLogic, CheckScope, ResolveCtx } from '../types';

/*
 * series-explorer (§9.2).
 *   series: terms a(n) for n = n0, n0 + 1, … and partial sums S_N, with an N slider.
 *   taylor: f and its Taylor polynomial T_d about `center`, with a degree slider. Coefficients
 *           come from symbolic derivatives (mathjs) evaluated at the center.
 */

const numOrExpr = z.union([z.number(), z.string().min(1)]);

export const configSchema = z.discriminatedUnion('mode', [
  z.strictObject({
    mode: z.literal('series'),
    /** a(n), an expression in n. */
    term: z.string().min(1),
    n0: z.number().int().optional(),
    NMax: numOrExpr,
    initial: numOrExpr.optional(),
    /** The sum of the series, when known. */
    limit: numOrExpr.optional(),
  }),
  z.strictObject({
    mode: z.literal('taylor'),
    /** f(x). */
    f: z.string().min(1),
    center: numOrExpr.optional(),
    degreeMax: z.number().int().min(1).max(20),
    initial: numOrExpr.optional(),
    /** Interval for maxErrorOnInterval (and the shaded band on the plot). */
    interval: z.tuple([numOrExpr, numOrExpr]),
    /** Optional point where `error` = |f(x) − T(x)| is reported. */
    at: numOrExpr.optional(),
    view: z.strictObject({ x: z.tuple([numOrExpr, numOrExpr]), y: z.tuple([numOrExpr, numOrExpr]) }),
  }),
]);

export const solutionSchema = z.union([
  z.strictObject({ N: numOrExpr }),
  z.strictObject({ degree: numOrExpr }),
]);

export type RawConfig = z.infer<typeof configSchema>;
export type Solution = z.infer<typeof solutionSchema>;

export interface SeriesConfig {
  mode: 'series';
  term: string;
  n0: number;
  NMax: number;
  initial: number;
  limit?: number;
  /** a(n0) … a(NMax), computed once. */
  terms: number[];
  vars: Scope;
}

export interface TaylorConfig {
  mode: 'taylor';
  f: string;
  center: number;
  degreeMax: number;
  initial: number;
  interval: [number, number];
  at?: number;
  view: { x: [number, number]; y: [number, number] };
  /** Taylor coefficients c_0 … c_degreeMax. */
  coeffs: number[];
  vars: Scope;
}

export type Config = SeriesConfig | TaylorConfig;

export interface State {
  /** N in series mode, the degree in taylor mode. */
  k: number;
}

function fnIn(expr: string, variable: string, vars: Scope): RealFn {
  const code = math.compile(expr);
  return (u: number) => {
    try {
      const r = code.evaluate({ ...vars, [variable]: u });
      return typeof r === 'number' ? r : NaN;
    } catch {
      return NaN;
    }
  };
}

/** c_k = f⁽ᵏ⁾(center) / k!, from repeated symbolic differentiation. */
export function taylorCoefficients(f: string, center: number, degree: number, vars: Scope): number[] {
  const out: number[] = [];
  let node = math.parse(f);
  let fact = 1;
  for (let k = 0; k <= degree; k++) {
    if (k > 0) {
      node = math.derivative(node, 'x');
      fact *= k;
    }
    const v = node.evaluate({ ...vars, x: center });
    if (typeof v !== 'number' || !Number.isFinite(v))
      throw new Error(`Taylor coefficient ${k} of "${f}" at x = ${center} is not a finite number`);
    out.push(v / fact);
  }
  return out;
}

export function resolveConfig(raw: RawConfig, ctx: ResolveCtx): Config {
  if (raw.mode === 'series') {
    const n0 = raw.n0 ?? 1;
    const NMax = ctx.num(raw.NMax);
    const a = fnIn(raw.term, 'n', ctx.scope);
    const terms = Array.from({ length: Math.max(0, NMax - n0 + 1) }, (_, i) => a(n0 + i));
    return {
      mode: 'series',
      term: raw.term,
      n0,
      NMax,
      initial: raw.initial !== undefined ? ctx.num(raw.initial) : n0,
      limit: raw.limit !== undefined ? ctx.num(raw.limit) : undefined,
      terms,
      vars: ctx.scope,
    };
  }
  const center = raw.center !== undefined ? ctx.num(raw.center) : 0;
  return {
    mode: 'taylor',
    f: raw.f,
    center,
    degreeMax: raw.degreeMax,
    initial: raw.initial !== undefined ? ctx.num(raw.initial) : 0,
    interval: [ctx.num(raw.interval[0]), ctx.num(raw.interval[1])],
    at: raw.at !== undefined ? ctx.num(raw.at) : undefined,
    view: {
      x: [ctx.num(raw.view.x[0]), ctx.num(raw.view.x[1])],
      y: [ctx.num(raw.view.y[0]), ctx.num(raw.view.y[1])],
    },
    coeffs: taylorCoefficients(raw.f, center, raw.degreeMax, ctx.scope),
    vars: ctx.scope,
  };
}

/** Partial sum S_N = a(n0) + … + a(N). */
export function partialSum(config: SeriesConfig, N: number): number {
  let s = 0;
  for (let n = config.n0; n <= N; n++) s += config.terms[n - config.n0];
  return s;
}

export function fOf(config: TaylorConfig): RealFn {
  return fnIn(config.f, 'x', config.vars);
}

export function taylorPoly(config: TaylorConfig, degree: number): RealFn {
  return (x: number) => {
    let s = 0;
    const d = x - config.center;
    for (let k = degree; k >= 0; k--) s = s * d + config.coeffs[k];
    return s;
  };
}

function clampK(k: number, config: Config): number {
  const [lo, hi] = config.mode === 'series' ? [config.n0, config.NMax] : [0, config.degreeMax];
  return Math.min(hi, Math.max(lo, Math.round(k)));
}

export function checkScope(state: State, config: Config): CheckScope {
  const k = clampK(state.k, config);
  if (config.mode === 'series') {
    const SN = partialSum(config, k);
    const s: CheckScope = { N: k, SN, aN: config.terms[k - config.n0] };
    if (config.limit !== undefined) {
      s.limit = config.limit;
      s.error = Math.abs(config.limit - SN);
    }
    s.S = (N: number) => partialSum(config, clampK(N, config));
    return s;
  }
  const f = fOf(config);
  const T = taylorPoly(config, k);
  const s: CheckScope = {
    degree: k,
    maxErrorOnInterval: maxAbsOn((x) => f(x) - T(x), config.interval[0], config.interval[1]),
    T: (x: number) => T(x),
  };
  if (config.at !== undefined) s.error = Math.abs(f(config.at) - T(config.at));
  return s;
}

export function initialState(config: Config): State {
  return { k: clampK(config.initial, config) };
}

export function solutionState(solution: Solution, config: Config): State {
  const v = 'N' in solution ? solution.N : solution.degree;
  return { k: clampK(typeof v === 'number' ? v : evalNumber(v, config.vars), config) };
}

export function solutionScope(solution: Solution, config: Config): CheckScope {
  return checkScope(solutionState(solution, config), config);
}

export function describeState(state: State, config: Config): string {
  const s = checkScope(state, config);
  const n = (v: unknown) => formatNumber(v as number, { sig: 6 });
  if (config.mode === 'series') {
    const lim =
      config.limit !== undefined
        ? `; the series sums to ${n(s.limit)}, error ${formatNumber(s.error as number)}`
        : '';
    return `N = ${s.N}: partial sum ${n(s.SN)}, last term ${n(s.aN)}${lim}.`;
  }
  const at =
    config.at !== undefined
      ? `; error at x = ${formatNumber(config.at)} is ${formatNumber(s.error as number)}`
      : '';
  return (
    `Taylor polynomial of degree ${s.degree} about ${formatNumber(config.center)}; largest error on ` +
    `[${formatNumber(config.interval[0])}, ${formatNumber(config.interval[1])}] is ${formatNumber(s.maxErrorOnInterval as number)}${at}.`
  );
}

export const seriesLogic: ChallengeLogic<RawConfig, Config, State, Solution> = {
  type: 'series-explorer',
  configSchema,
  solutionSchema,
  resolveConfig,
  initialState,
  checkScope,
  solutionScope,
  solutionState,
  describeState,
};
