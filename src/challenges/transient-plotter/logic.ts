import { z } from 'zod';
import { evalNumber, type Scope } from '../../engine/expr';
import { formatNumber } from '../../engine/format';
import type { ChallengeLogic, CheckScope, ResolveCtx } from '../types';

/*
 * RC / RL transients (§9.2 transient-plotter). The student adjusts sliders for R, C (or L)
 * and V; the curve is plotted live.
 *   rc-charge:    capacitor voltage  Vc(t) = V (1 − e^(−t/τ)),  τ = RC
 *   rc-discharge: capacitor voltage  Vc(t) = V e^(−t/τ)
 *   rl-rise:      current            I(t)  = (V/R)(1 − e^(−t/τ)), τ = L/R
 *   rl-decay:     current            I(t)  = (V/R) e^(−t/τ)
 */

const numOrExpr = z.union([z.number(), z.string().min(1)]);
const varName = z.enum(['R', 'C', 'L', 'V']);

export const configSchema = z.strictObject({
  mode: z.enum(['rc-charge', 'rc-discharge', 'rl-rise', 'rl-decay']),
  values: z.strictObject({
    R: numOrExpr.optional(),
    C: numOrExpr.optional(),
    L: numOrExpr.optional(),
    V: numOrExpr,
  }),
  sliders: z
    .array(
      z.strictObject({
        name: varName,
        min: numOrExpr,
        max: numOrExpr,
        step: numOrExpr,
        initial: numOrExpr.optional(),
      }),
    )
    .min(1),
  tMax: numOrExpr,
  /** Times marked on the plot with the value read off there. */
  markers: z.array(numOrExpr).optional(),
  /** A target point drawn on the plot, e.g. "63% at 2 s". */
  target: z.strictObject({ t: numOrExpr, frac: numOrExpr }).optional(),
});

export const solutionSchema = z.record(varName, numOrExpr);

export type RawConfig = z.infer<typeof configSchema>;
export type Solution = z.infer<typeof solutionSchema>;
export type VarName = z.infer<typeof varName>;

export interface Slider {
  name: VarName;
  min: number;
  max: number;
  step: number;
  initial: number;
}

export interface Config {
  mode: RawConfig['mode'];
  fixed: Partial<Record<VarName, number>>;
  sliders: Slider[];
  tMax: number;
  markers: number[];
  target?: { t: number; frac: number };
  vars: Scope;
}

export interface State {
  values: Partial<Record<VarName, number>>;
}

export const UNITS: Record<VarName, string> = { R: 'Ω', C: 'F', L: 'H', V: 'V' };

export function resolveConfig(raw: RawConfig, ctx: ResolveCtx): Config {
  const fixed: Partial<Record<VarName, number>> = {};
  for (const [k, v] of Object.entries(raw.values)) if (v !== undefined) fixed[k as VarName] = ctx.num(v);
  const sliders = raw.sliders.map((s) => {
    const min = ctx.num(s.min);
    const max = ctx.num(s.max);
    const step = ctx.num(s.step);
    const initial = s.initial !== undefined ? ctx.num(s.initial) : (fixed[s.name] ?? min);
    return { name: s.name, min, max, step, initial };
  });
  return {
    mode: raw.mode,
    fixed,
    sliders,
    tMax: ctx.num(raw.tMax),
    markers: (raw.markers ?? []).map((m) => ctx.num(m)),
    target: raw.target ? { t: ctx.num(raw.target.t), frac: ctx.num(raw.target.frac) } : undefined,
    vars: ctx.scope,
  };
}

export function currentValues(state: State, config: Config): Record<VarName, number> {
  const v = { R: NaN, C: NaN, L: NaN, V: NaN, ...config.fixed } as Record<VarName, number>;
  for (const s of config.sliders) v[s.name] = state.values[s.name] ?? s.initial;
  return v;
}

export function isRC(mode: Config['mode']): boolean {
  return mode === 'rc-charge' || mode === 'rc-discharge';
}

export function rising(mode: Config['mode']): boolean {
  return mode === 'rc-charge' || mode === 'rl-rise';
}

export function tauOf(v: Record<VarName, number>, mode: Config['mode']): number {
  return isRC(mode) ? v.R * v.C : v.L / v.R;
}

/** Fraction of the final (rising) or initial (decaying) value at time t. */
export function fracAt(t: number, tau: number, mode: Config['mode']): number {
  const e = Math.exp(-t / tau);
  return rising(mode) ? 1 - e : e;
}

/** The plotted quantity: capacitor voltage (RC) or current (RL). */
export function yAt(t: number, v: Record<VarName, number>, mode: Config['mode']): number {
  const f = fracAt(t, tauOf(v, mode), mode);
  return isRC(mode) ? v.V * f : (v.V / v.R) * f;
}

function scopeFor(v: Record<VarName, number>, config: Config): CheckScope {
  const tau = tauOf(v, config.mode);
  const mode = config.mode;
  const s: CheckScope = {
    tau,
    frac_at: (t: number) => fracAt(t, tau, mode),
    y_at: (t: number) => yAt(t, v, mode),
    // Capacitor voltage for RC; inductor voltage for RL.
    V_at: (t: number) =>
      isRC(mode) ? yAt(t, v, mode) : rising(mode) ? v.V * Math.exp(-t / tau) : -v.V * Math.exp(-t / tau),
    I_at: (t: number) =>
      isRC(mode) ? (rising(mode) ? 1 : -1) * (v.V / v.R) * Math.exp(-t / tau) : yAt(t, v, mode),
  };
  for (const k of ['R', 'C', 'L', 'V'] as VarName[]) if (Number.isFinite(v[k])) s[k] = v[k];
  for (const sl of config.sliders) s[`slider_${sl.name}`] = v[sl.name];
  return s;
}

export function checkScope(state: State, config: Config): CheckScope {
  return scopeFor(currentValues(state, config), config);
}

export function solutionState(solution: Solution, config: Config): State {
  const values: Partial<Record<VarName, number>> = {};
  for (const [k, v] of Object.entries(solution))
    values[k as VarName] = typeof v === 'number' ? v : evalNumber(v, config.vars);
  return { values };
}

export function solutionScope(solution: Solution, config: Config): CheckScope {
  return checkScope(solutionState(solution, config), config);
}

export function initialState(config: Config): State {
  return { values: Object.fromEntries(config.sliders.map((s) => [s.name, s.initial])) };
}

export function describeState(state: State, config: Config): string {
  const v = currentValues(state, config);
  const tau = tauOf(v, config.mode);
  const parts = config.sliders.map((s) => `${s.name} = ${formatNumber(v[s.name])} ${UNITS[s.name]}`);
  const what = isRC(config.mode) ? 'capacitor voltage' : 'current';
  const marks = config.markers.map(
    (t) =>
      `at ${formatNumber(t)} s the ${what} is ${Math.round(fracAt(t, tau, config.mode) * 100)}% of ${rising(config.mode) ? 'its final' : 'its starting'} value`,
  );
  return [`${parts.join(', ')}`, `time constant ${formatNumber(tau)} s`, ...marks].join('; ') + '.';
}

export const transientLogic: ChallengeLogic<RawConfig, Config, State, Solution> = {
  type: 'transient-plotter',
  configSchema,
  solutionSchema,
  resolveConfig,
  initialState,
  checkScope,
  solutionScope,
  solutionState,
  describeState,
};
