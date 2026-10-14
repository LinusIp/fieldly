import type { FC } from 'react';
import type { ZodType } from 'zod';
import type { Scope } from '../engine/expr';

/** Values an interactive exposes to `check`, `feedback[].if` and `verify` expressions. Functions are
 *  allowed (e.g. `V_at(t)` in the transient plotter) because mathjs can call them. */
export type CheckScope = Record<string, number | boolean | ((...args: number[]) => number)>;

export type InteractiveMode = 'view' | 'explore' | 'challenge' | 'sandbox';

/** Helpers for turning raw config (expression strings, templates) into a resolved config. */
export interface ResolveCtx {
  scope: Scope;
  /** Evaluate a number or a mathjs expression string. */
  num(v: number | string): number;
  /** Render `{{ }}` templates in a string. */
  text(s: string): string;
}

/**
 * The React-free half of an interactive (§9.3 `model.ts`). The validator imports only this, so it
 * runs in Node; the app lazy-loads the full module (model + view) per type.
 */
export interface InteractiveModel<Raw = unknown, Config = unknown, State = unknown, Solution = unknown> {
  type: string;
  configSchema: ZodType<Raw>;
  solutionSchema: ZodType<Solution>;
  /** Modes the view supports (§9.3). Defaults to ['explore', 'challenge']. */
  modes?: InteractiveMode[];
  resolveConfig(raw: Raw, ctx: ResolveCtx): Config;
  /** Optional: give the resolved config access to the solution (e.g. the correct Parsons order). */
  withSolution?(config: Config, solution: Solution): Config;
  initialState(config: Config): State;
  checkScope(state: State, config: Config): CheckScope;
  builtInFeedback?(state: State, config: Config): string | null;
  solutionScope(solution: Solution, config: Config): CheckScope;
  /** State that displays the solution (used by "Show solution" and the debug hook). */
  solutionState(solution: Solution, config: Config): State;
  /** Apply a solution to the current state (explore tasks, §9.3). Defaults to `solutionState`. */
  applySolution?(state: State, solution: Solution, config: Config): State;
  /** Optional: combine the current state with the solution state (e.g. keep the chosen language). */
  mergeSolution?(current: State, solved: State): State;
  describeState(state: State, config: Config): string;
}

export interface InteractiveViewProps<Config, State> {
  mode: InteractiveMode;
  config: Config;
  state: State;
  disabled: boolean;
  onStateChange(state: State): void;
  reducedMotion: boolean;
  /** When true the view renders `state` (the solution) read-only. */
  showingSolution?: boolean;
  /** Hotspot mode: tappable element ids, and the tap handler. */
  targets?: string[];
  onTap?(id: string): void;
  /** The student's preferred code language (settings). */
  codeLang?: 'python' | 'javascript';
}

export interface InteractiveModule<
  Raw = unknown,
  Config = unknown,
  State = unknown,
  Solution = unknown,
> extends InteractiveModel<Raw, Config, State, Solution> {
  Component: FC<InteractiveViewProps<Config, State>>;
  /** The view is a stand-in until the full one is built (§14 Phase 2); hosts offer "Do it for me". */
  placeholder?: boolean;
  /** Optional async work before a check (e.g. running the student's code); returns the new state. */
  beforeCheck?(state: State, config: Config, ctx: { codeLang: 'python' | 'javascript' }): Promise<State>;
}

/** Apply a solution, falling back to the solution's own state. */
export function applySolution<R, C, S, Sol>(
  m: InteractiveModel<R, C, S, Sol>,
  state: S,
  solution: Sol,
  config: C,
): S {
  return m.applySolution ? m.applySolution(state, solution, config) : m.solutionState(solution, config);
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

// Back-compat aliases while the models are migrated (§9.3 names).
export type ChallengeLogic<R = unknown, C = unknown, S = unknown, Sol = unknown> = InteractiveModel<
  R,
  C,
  S,
  Sol
>;
export type ChallengeModule<R = unknown, C = unknown, S = unknown, Sol = unknown> = InteractiveModule<
  R,
  C,
  S,
  Sol
>;
export type ChallengeComponentProps<C, S> = InteractiveViewProps<C, S>;
