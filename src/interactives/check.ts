/**
 * Evaluating `check`, `feedback[].if` and task goals against an interactive's state (§9.3). Pure,
 * so the player, the debug hook and tests share it.
 */
import type { FeedbackRule } from '../content/schema';
import { evalBoolean, evalNumber, near, type Scope } from '../engine/expr';
import { renderTemplate } from '../engine/template';
import { makeResolveCtx, type InteractiveModel } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModel = InteractiveModel<any, any, any, any>;

/** Parse and resolve a raw config over a scope (templates and expressions filled in). */
export function resolveConfig(model: AnyModel, raw: unknown, scope: Scope, solution?: unknown): unknown {
  const config = model.resolveConfig(
    model.configSchema.parse(raw),
    makeResolveCtx(scope, evalNumber, renderTemplate),
  );
  return model.withSolution && solution !== undefined
    ? model.withSolution(config, model.solutionSchema.parse(solution))
    : config;
}

/** Params + derived, then the interactive's variables (they win a clash), then `near`. */
export function fullScope(model: AnyModel, state: unknown, config: unknown, scope: Scope): Scope {
  return { ...scope, ...model.checkScope(state, config), near };
}

export function safeBool(expr: string, scope: Scope): boolean {
  try {
    return evalBoolean(expr, scope);
  } catch {
    return false;
  }
}

export interface CheckResult {
  passed: boolean;
  /** Built-in message ("Short circuit!") or the first authored feedback rule that fires. */
  feedback?: string;
  misconception?: string;
}

/** A challenge or puzzle check: built-in feedback first, then the goal, then authored feedback. */
export function runCheck(
  model: AnyModel,
  state: unknown,
  config: unknown,
  scope: Scope,
  check: { expr: string },
  feedback: FeedbackRule[] = [],
): CheckResult {
  const builtIn = model.builtInFeedback?.(state, config) ?? null;
  if (builtIn) return { passed: false, feedback: builtIn };
  const full = fullScope(model, state, config, scope);
  if (safeBool(check.expr, full)) return { passed: true };
  for (const f of feedback)
    if (safeBool(f.if, full))
      return { passed: false, feedback: renderTemplate(f.say, full), misconception: f.misconception };
  return { passed: false, feedback: 'Not yet — compare what you have with the goal.' };
}

/** Solution state for "Show solution" and the debug hook, merged with the current state when the model can. */
export function solvedState(model: AnyModel, current: unknown, solution: unknown, config: unknown): unknown {
  const sol = model.solutionSchema.parse(solution);
  const solved = model.solutionState(sol, config);
  return model.mergeSolution ? model.mergeSolution(current ?? model.initialState(config), solved) : solved;
}

/** Explore tasks apply their solution to the current state (§9.3). */
export function applyTaskSolution(
  model: AnyModel,
  current: unknown,
  solution: unknown,
  config: unknown,
): unknown {
  const sol = model.solutionSchema.parse(solution);
  return model.applySolution ? model.applySolution(current, sol, config) : model.solutionState(sol, config);
}
