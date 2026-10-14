import { z } from 'zod';
import type { ChallengeLogic, CheckScope, ResolveCtx } from '../types';
import { ALGORITHMS, traceFor, type AlgorithmId } from './algorithms';
import type { Trace } from './trace';

/*
 * algorithm-stepper (§9.2): the student performs the next operation of an algorithm by
 * clicking; each action is checked against the reference trace.
 */

const algorithmIds = Object.keys(ALGORITHMS) as [AlgorithmId, ...AlgorithmId[]];

export const configSchema = z.strictObject({
  algorithm: z.enum(algorithmIds),
  /** Algorithm input. Numbers may be mathjs expressions over the params (strings). */
  input: z.record(z.string(), z.unknown()),
});

/** The solution is the reference trace itself; nothing needs to be authored. */
export const solutionSchema = z.strictObject({ followTrace: z.literal(true) });

export type RawConfig = z.infer<typeof configSchema>;
export type Solution = z.infer<typeof solutionSchema>;

export interface Config {
  algorithm: AlgorithmId;
  input: Record<string, unknown>;
  trace: Trace;
}

export interface State {
  /** Index of the next step to perform. */
  step: number;
  mistakes: number;
  /** Explanation for the last wrong choice (cleared on a correct one). */
  lastWrong?: string;
  lastNote?: string;
}

/** Evaluate expression strings inside the input, except where the algorithm expects text. */
function resolveValue(v: unknown, ctx: ResolveCtx, keepText: boolean): unknown {
  if (Array.isArray(v)) return v.map((x) => resolveValue(x, ctx, keepText));
  if (typeof v === 'string' && !keepText) return ctx.num(v);
  return v;
}

const TEXT_FIELDS: Partial<Record<AlgorithmId, string[]>> = {
  brackets: ['text'],
  'circular-buffer': ['ops'],
  'list-reverse': ['values'],
};

export function resolveConfig(raw: RawConfig, ctx: ResolveCtx): Config {
  const keep = TEXT_FIELDS[raw.algorithm] ?? [];
  const input = Object.fromEntries(
    Object.entries(raw.input).map(([k, v]) => [k, resolveValue(v, ctx, keep.includes(k))]),
  );
  const parsed = ALGORITHMS[raw.algorithm].input.parse(input);
  return { algorithm: raw.algorithm, input: parsed, trace: traceFor(raw.algorithm, parsed) };
}

export function initialState(): State {
  return { step: 0, mistakes: 0 };
}

export function checkScope(state: State, config: Config): CheckScope {
  const total = config.trace.steps.length;
  return {
    stepsCorrect: Math.min(state.step, total),
    totalSteps: total,
    mistakes: state.mistakes,
    done: state.step >= total,
  };
}

export function solutionScope(_s: Solution, config: Config): CheckScope {
  const total = config.trace.steps.length;
  return { stepsCorrect: total, totalSteps: total, mistakes: 0, done: true };
}

export function solutionState(_s: Solution, config: Config): State {
  return { step: config.trace.steps.length, mistakes: 0 };
}

export function describeState(state: State, config: Config): string {
  const total = config.trace.steps.length;
  if (state.step >= total) return `Done. ${config.trace.summary} Mistakes: ${state.mistakes}.`;
  const s = config.trace.steps[state.step];
  return `Step ${state.step + 1} of ${total}. ${s.prompt}${state.lastWrong ? ` Last choice was wrong: ${state.lastWrong}` : ''}`;
}

export const stepperLogic: ChallengeLogic<RawConfig, Config, State, Solution> = {
  type: 'algorithm-stepper',
  configSchema,
  solutionSchema,
  resolveConfig,
  initialState,
  checkScope,
  solutionScope,
  solutionState,
  describeState,
};
