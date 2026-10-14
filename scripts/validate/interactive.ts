/** Interactive checks (§9.3, §13.2): configs, explore tasks, challenges and puzzle levels. */
import type { ChallengeVariant, Question, Task } from '../../src/content/schema';
import { evalBoolean, evaluate, evalNumber, type Scope } from '../../src/engine/expr';
import { renderTemplate } from '../../src/engine/template';
import { interactiveModels } from '../../src/interactives/models';
import {
  applySolution,
  makeResolveCtx,
  type CheckScope,
  type InteractiveModel,
} from '../../src/interactives/types';
import { runCodeChecks } from '../code-check';
import { symbolsIn, type Reporter } from './util';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModel = InteractiveModel<any, any, any, any>;

interface Resolved {
  model: AnyModel;
  config: unknown;
}

function modelOf(type: string): AnyModel | undefined {
  return interactiveModels[type];
}

/** Parse and resolve an interactive config for one scope; reports and returns null on failure. */
export function resolveRef(
  type: string,
  rawConfig: unknown,
  scope: Scope,
  rep: Reporter,
  where: string,
): Resolved | null {
  const model = modelOf(type);
  if (!model) {
    rep.errorOnce(`${where}:type`, `no "${type}" interactive exists yet`, where);
    return null;
  }
  const parsed = model.configSchema.safeParse(rawConfig);
  if (!parsed.success) {
    rep.errorOnce(
      `${where}:cfg`,
      `config: ${parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ')}`,
      where,
    );
    return null;
  }
  try {
    return {
      model,
      config: model.resolveConfig(parsed.data, makeResolveCtx(scope, evalNumber, renderTemplate)),
    };
  } catch (e) {
    rep.errorOnce(`${where}:resolve:${(e as Error).message}`, `config: ${(e as Error).message}`, where);
    return null;
  }
}

/** Validate an `{ type, mode?, config }` reference (hotspot surfaces, concept visuals). */
export function validateInteractiveRef(ref: unknown, scope: Scope, rep: Reporter, where: string): void {
  const r = ref as { type?: string; config?: unknown };
  if (!r || typeof r.type !== 'string') {
    rep.errorOnce(`${where}:ref`, 'interactive reference needs a type', where);
    return;
  }
  const res = resolveRef(r.type, r.config, scope, rep, where);
  if (res) {
    try {
      res.model.checkScope(res.model.initialState(res.config), res.config);
    } catch (e) {
      rep.errorOnce(`${where}:init`, `initial state: ${(e as Error).message}`, where);
    }
  }
}

/** The check scope of an interactive reference in its initial state (for hotspot `verify`). */
export function initialScopeOf(ref: unknown, scope: Scope): CheckScope | null {
  const r = ref as { type: string; config: unknown };
  const model = modelOf(r.type);
  if (!model) return null;
  const parsed = model.configSchema.safeParse(r.config);
  if (!parsed.success) return null;
  const config = model.resolveConfig(parsed.data, makeResolveCtx(scope, evalNumber, renderTemplate));
  return model.checkScope(model.initialState(config), config);
}

/** Error if an expression uses a name that both the params and the interactive define (§7.5). */
function checkClash(expr: string, params: Scope, isc: CheckScope, rep: Reporter, where: string): void {
  for (const name of symbolsIn(expr))
    if (name in params && name in isc)
      rep.errorOnce(
        `${where}:clash:${name}`,
        `"${expr}" uses "${name}", which is both a param and an interactive variable`,
        where,
      );
}

function evalCheck(expr: string, params: Scope, isc: CheckScope): boolean {
  return evalBoolean(expr, { ...params, ...isc });
}

/**
 * Explore/hook tasks: starting from the initial state, each goal is false before its solution is
 * applied and true after, in order (§9.3). `onQuestion` validates predict/ask questions.
 */
export function validateTasks(
  ref: { type: string; config: unknown },
  tasks: Task[],
  scope: Scope,
  rep: Reporter,
  where: string,
  onQuestion: (q: Question, w: string) => void,
): void {
  const res = resolveRef(ref.type, ref.config, scope, rep, where);
  if (!res) return;
  const { model, config } = res;
  let state: unknown;
  try {
    state = model.initialState(config);
  } catch (e) {
    rep.errorOnce(`${where}:init`, `initial state: ${(e as Error).message}`, where);
    return;
  }
  const tag = JSON.stringify(scope);
  tasks.forEach((task, ti) => {
    const w = `${where}.tasks[${ti}]`;
    if ('predict' in task) return onQuestion(task.predict, w);
    if ('ask' in task) return onQuestion(task.ask, w);
    const sol = model.solutionSchema.safeParse(task.solution);
    if (!sol.success) {
      rep.errorOnce(`${w}:sol`, `solution does not match the ${ref.type} solution format`, w);
      return;
    }
    try {
      const before = model.checkScope(state, config);
      checkClash(task.check.expr, scope, before, rep, w);
      if (evalCheck(task.check.expr, scope, before))
        rep.errorOnce(
          `${w}:pre`,
          `goal "${task.goal}" is already met before its solution (params ${tag})`,
          w,
        );
      state = applySolution(model, state, sol.data, config);
      if (!evalCheck(task.check.expr, scope, model.checkScope(state, config)))
        rep.errorOnce(`${w}:post`, `goal "${task.goal}" is not met by its solution (params ${tag})`, w);
    } catch (e) {
      rep.errorOnce(`${w}:x`, `${(e as Error).message} (params ${tag})`, w);
    }
  });
}

/**
 * One interactive-backed challenge variant or puzzle level, for one scope: the solution satisfies
 * the check, no feedback rule fires on it, built-in feedback stays quiet, and the starting state
 * doesn't already pass (warning).
 */
export function validateInteractiveVariant(
  type: string,
  v: ChallengeVariant,
  scope: Scope,
  rep: Reporter,
  where: string,
): void {
  if (!v.check) {
    rep.errorOnce(`${where}:check`, 'interactive challenges need a check expression', where);
    return;
  }
  const res = resolveRef(type, v.config, scope, rep, where);
  if (!res) return;
  const { model } = res;
  const sol = model.solutionSchema.safeParse(v.solution);
  if (!sol.success) {
    rep.errorOnce(`${where}:sol`, `solution does not match the ${type} solution format`, where);
    return;
  }
  const tag = JSON.stringify(scope);
  try {
    const config = model.withSolution ? model.withSolution(res.config, sol.data) : res.config;
    const solScope = model.solutionScope(sol.data, config);
    for (const e of [v.check.expr, ...(v.feedback ?? []).map((f) => f.if)])
      checkClash(e, scope, solScope, rep, where);
    if (!evalCheck(v.check.expr, scope, solScope))
      rep.errorOnce(
        `${where}:solves`,
        `solution does not pass check "${v.check.expr}" (params ${tag})`,
        where,
      );
    (v.feedback ?? []).forEach((f, i) => {
      const r = evaluate(f.if, { ...scope, ...solScope });
      if (typeof r !== 'boolean')
        rep.errorOnce(`${where}:fb${i}`, `feedback[${i}].if "${f.if}" is not boolean`, where);
      else if (r)
        rep.errorOnce(`${where}:fbs${i}`, `feedback[${i}] fires on the solution (params ${tag})`, where);
    });
    const solvedState = model.solutionState(sol.data, config);
    const built = model.builtInFeedback?.(solvedState, config);
    if (built) rep.errorOnce(`${where}:builtin`, `the solution triggers "${built}" (params ${tag})`, where);
    if (type !== 'code-runner') {
      const init = model.checkScope(model.initialState(config), config);
      if (evalCheck(v.check.expr, scope, init))
        rep.warnOnce(`${where}:initial`, 'the starting state already passes the check', where);
    }
  } catch (e) {
    rep.errorOnce(
      `${where}:x:${(e as Error).message}`,
      `challenge: ${(e as Error).message} (params ${tag})`,
      where,
    );
  }
}

/** Code-runner reference solutions run against their tests (JS now, Python batched). */
export function validateCodeVariant(v: ChallengeVariant, rep: Reporter, where: string): void {
  const model = modelOf('code-runner');
  if (!model) return;
  const cfg = model.configSchema.safeParse(v.config);
  const sol = model.solutionSchema.safeParse(v.solution);
  if (!cfg.success || !sol.success) return;
  runCodeChecks(cfg.data, sol.data, (issue) => {
    if (issue.level === 'error') rep.error(issue.message, where);
    else rep.warn(issue.message, where);
  });
}
