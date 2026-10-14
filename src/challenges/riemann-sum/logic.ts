import { z } from 'zod';
import { evalNumber, math, type Scope } from '../../engine/expr';
import { formatNumber } from '../../engine/format';
import { integrate, type RealFn } from '../../engine/numeric';
import type { ChallengeLogic, CheckScope, ResolveCtx } from '../types';

/*
 * riemann-sum (§9.2): approximate ∫ₐᵇ f with n subintervals and a rule. Simpson's rule pairs
 * subintervals, so it uses an even n (an odd choice is rounded up and reported as such).
 * Check expressions compare `rule` with the constants left, right, midpoint, trapezoid, simpson.
 */

export const RULES = ['left', 'right', 'midpoint', 'trapezoid', 'simpson'] as const;
export type Rule = (typeof RULES)[number];
const ruleSchema = z.enum(RULES);
const numOrExpr = z.union([z.number(), z.string().min(1)]);

export const configSchema = z.strictObject({
  f: z.string().min(1),
  a: numOrExpr,
  b: numOrExpr,
  rules: z.array(ruleSchema).min(1).optional(),
  nMax: numOrExpr.optional(),
  initial: z.strictObject({ n: numOrExpr.optional(), rule: ruleSchema.optional() }).optional(),
  /** Exact value of the integral if known in closed form; otherwise it is computed numerically. */
  exact: numOrExpr.optional(),
  /** y-range of the plot; defaults to the range of f on [a, b] plus 0. */
  y: z.tuple([numOrExpr, numOrExpr]).optional(),
});

export const solutionSchema = z.strictObject({ n: numOrExpr, rule: ruleSchema });

export type RawConfig = z.infer<typeof configSchema>;
export type Solution = z.infer<typeof solutionSchema>;

export interface Config {
  f: string;
  a: number;
  b: number;
  rules: Rule[];
  nMax: number;
  initial: { n: number; rule: Rule };
  exact: number;
  y: [number, number];
  vars: Scope;
}

export interface State {
  n: number;
  rule: Rule;
}

export function fnOf(config: Pick<Config, 'f' | 'vars'>): RealFn {
  const code = math.compile(config.f);
  return (x: number) => {
    try {
      const r = code.evaluate({ ...config.vars, x });
      return typeof r === 'number' ? r : NaN;
    } catch {
      return NaN;
    }
  };
}

/** The n actually used: Simpson needs an even number of subintervals. */
export function effectiveN(n: number, rule: Rule): number {
  const k = Math.max(1, Math.round(n));
  return rule === 'simpson' && k % 2 === 1 ? k + 1 : k;
}

export function approximate(f: RealFn, a: number, b: number, n: number, rule: Rule): number {
  const h = (b - a) / n;
  let s = 0;
  switch (rule) {
    case 'left':
      for (let i = 0; i < n; i++) s += f(a + i * h);
      return s * h;
    case 'right':
      for (let i = 1; i <= n; i++) s += f(a + i * h);
      return s * h;
    case 'midpoint':
      for (let i = 0; i < n; i++) s += f(a + (i + 0.5) * h);
      return s * h;
    case 'trapezoid':
      s = (f(a) + f(b)) / 2;
      for (let i = 1; i < n; i++) s += f(a + i * h);
      return s * h;
    case 'simpson':
      s = f(a) + f(b);
      for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
      return (s * h) / 3;
  }
}

export function resolveConfig(raw: RawConfig, ctx: ResolveCtx): Config {
  const a = ctx.num(raw.a);
  const b = ctx.num(raw.b);
  const rules = raw.rules ?? [...RULES];
  const f = fnOf({ f: raw.f, vars: ctx.scope });
  const exact = raw.exact !== undefined ? ctx.num(raw.exact) : integrate(f, a, b, 1e-12);
  let y: [number, number];
  if (raw.y) y = [ctx.num(raw.y[0]), ctx.num(raw.y[1])];
  else {
    let lo = 0;
    let hi = 0;
    for (let i = 0; i <= 200; i++) {
      const v = f(a + ((b - a) * i) / 200);
      if (Number.isFinite(v)) [lo, hi] = [Math.min(lo, v), Math.max(hi, v)];
    }
    const pad = (hi - lo || 1) * 0.1;
    y = [lo - (lo < 0 ? pad : 0), hi + pad];
  }
  const initialRule = raw.initial?.rule ?? rules[0];
  return {
    f: raw.f,
    a,
    b,
    rules,
    nMax: raw.nMax !== undefined ? ctx.num(raw.nMax) : 100,
    initial: { n: raw.initial?.n !== undefined ? ctx.num(raw.initial.n) : 1, rule: initialRule },
    exact,
    y,
    vars: ctx.scope,
  };
}

export function initialState(config: Config): State {
  return { n: effectiveN(config.initial.n, config.initial.rule), rule: config.initial.rule };
}

export function checkScope(state: State, config: Config): CheckScope {
  const n = effectiveN(state.n, state.rule);
  const approx = approximate(fnOf(config), config.a, config.b, n, state.rule);
  const s: CheckScope = {
    n,
    rule: RULES.indexOf(state.rule),
    approx,
    exact: config.exact,
    error: Math.abs(approx - config.exact),
  };
  RULES.forEach((r, i) => (s[r] = i));
  return s;
}

export function solutionState(solution: Solution, config: Config): State {
  const n = typeof solution.n === 'number' ? solution.n : evalNumber(solution.n, config.vars);
  return { n: effectiveN(n, solution.rule), rule: solution.rule };
}

export function solutionScope(solution: Solution, config: Config): CheckScope {
  return checkScope(solutionState(solution, config), config);
}

export const RULE_NAMES: Record<Rule, string> = {
  left: 'left endpoints',
  right: 'right endpoints',
  midpoint: 'midpoints',
  trapezoid: 'trapezoids',
  simpson: "Simpson's rule",
};

export function describeState(state: State, config: Config): string {
  const s = checkScope(state, config);
  return (
    `${RULE_NAMES[state.rule]}, n = ${s.n}: approximation ${formatNumber(s.approx as number, { sig: 6 })}, ` +
    `exact ${formatNumber(config.exact, { sig: 6 })}, error ${formatNumber(s.error as number)}.`
  );
}

export const riemannLogic: ChallengeLogic<RawConfig, Config, State, Solution> = {
  type: 'riemann-sum',
  configSchema,
  solutionSchema,
  resolveConfig,
  initialState,
  checkScope,
  solutionScope,
  solutionState,
  describeState,
};
