import type { FC } from 'react';
import type { ZodType } from 'zod';
import type { Scope } from '../engine/expr';

/** Values a challenge exposes to `check.expr` and `feedback[].if`. Functions are allowed
 *  (e.g. `V_at(t)` in the transient plotter) because mathjs can call them. */
export type CheckScope = Record<string, number | boolean | ((...args: number[]) => number)>;

/** Helpers for turning raw config (expression strings, templates) into a resolved config. */
export interface ResolveCtx {
  scope: Scope;
  /** Evaluate a number or a mathjs expression string. */
  num(v: number | string): number;
  /** Render `{{ }}` templates in a string. */
  text(s: string): string;
}

/**
 * The React-free half of a challenge type. The validator imports only this, so it can run
 * in Node; the app lazy-loads the full module (logic + Component) per type.
 */
export interface ChallengeLogic<Raw = unknown, Config = unknown, State = unknown, Solution = unknown> {
  type: string;
  configSchema: ZodType<Raw>;
  solutionSchema: ZodType<Solution>;
  resolveConfig(raw: Raw, ctx: ResolveCtx): Config;
  initialState(config: Config): State;
  checkScope(state: State, config: Config): CheckScope;
  builtInFeedback?(state: State, config: Config): string | null;
  solutionScope(solution: Solution, config: Config): CheckScope;
  /** State that displays the solution (used by "Show solution" and the debug hook). */
  solutionState(solution: Solution, config: Config): State;
  describeState(state: State, config: Config): string;
}

export interface ChallengeComponentProps<Config, State> {
  config: Config;
  state: State;
  disabled: boolean;
  onStateChange(state: State): void;
  reducedMotion: boolean;
  /** When true the component renders `state` (the solution) read-only. */
  showingSolution?: boolean;
}

export interface ChallengeModule<
  Raw = unknown,
  Config = unknown,
  State = unknown,
  Solution = unknown,
> extends ChallengeLogic<Raw, Config, State, Solution> {
  Component: FC<ChallengeComponentProps<Config, State>>;
}

/** Build a ResolveCtx over a scope. */
export function makeResolveCtx(
  scope: Scope,
  evalNumber: (e: string, s: Scope) => number,
  render: (t: string, s: Scope) => string,
): ResolveCtx {
  return {
    scope,
    num: (v) => (typeof v === 'number' ? v : evalNumber(v, scope)),
    text: (s) => render(s, scope),
  };
}
