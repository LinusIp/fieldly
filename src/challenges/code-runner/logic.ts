import { z } from 'zod';
import type { ChallengeLogic, CheckScope, ResolveCtx } from '../types';
import type { Comparator } from './compare';
import { generators } from './generators';

/*
 * code-runner (§9.2): the student writes a function; visible tests show their results, hidden
 * tests show pass/fail only, and an optional performance test (a named generator plus a time
 * limit) rejects brute force. Code runs in a Web Worker (JS) or Pyodide (Python).
 */

export type Lang = 'python' | 'javascript';
export const LANGS: Lang[] = ['python', 'javascript'];

const perLang = z.strictObject({ python: z.string(), javascript: z.string() });

export const configSchema = z.strictObject({
  /** Function name per language, e.g. { python: "two_sum", javascript: "twoSum" }. */
  entry: perLang,
  starter: perLang,
  tests: z
    .array(
      z.strictObject({
        args: z.array(z.unknown()),
        expected: z.unknown(),
        hidden: z.boolean().optional(),
        name: z.string().optional(),
      }),
    )
    .min(1),
  comparator: z.enum(['exact', 'unordered', 'float']),
  perf: z
    .strictObject({
      generator: z.string().refine((g) => g in generators, { message: 'unknown performance generator' }),
      params: z.record(z.string(), z.number()),
      timeLimitMs: z.number().positive(),
    })
    .optional(),
  timeoutMs: z.number().positive().optional(),
});

export const solutionSchema = perLang;

export type RawConfig = z.infer<typeof configSchema>;
export type Solution = z.infer<typeof solutionSchema>;

export interface Config extends RawConfig {
  timeoutMs: number;
}

export interface TestOutcome {
  name: string;
  hidden: boolean;
  ok: boolean;
  /** Shown for visible tests only. */
  args?: string;
  got?: string;
  expected?: string;
  error?: string;
}

export interface RunResults {
  lang: Lang;
  /** The code the results belong to; edits make the results stale. */
  code: string;
  passed: number;
  total: number;
  perfPassed: boolean | null;
  perfMs: number | null;
  timeMs: number;
  tests: TestOutcome[];
  error?: string;
}

export interface State {
  lang: Lang;
  code: Record<Lang, string>;
  results?: RunResults;
}

export function resolveConfig(raw: RawConfig, _ctx: ResolveCtx): Config {
  return { ...raw, timeoutMs: raw.timeoutMs ?? 4000 };
}

export function initialState(config: Config): State {
  return { lang: 'python', code: { python: config.starter.python, javascript: config.starter.javascript } };
}

export function checkScope(state: State, config: Config): CheckScope {
  const r = state.results;
  const fresh = r && r.lang === state.lang && r.code === state.code[state.lang];
  return {
    passed: fresh ? r.passed : 0,
    total: config.tests.length,
    perfPassed: fresh ? (r.perfPassed ?? true) : false,
    timeMs: fresh ? r.timeMs : 0,
  };
}

/**
 * The validator proves separately (scripts/code-check.ts) that the reference solutions pass every
 * test and the performance limit in both languages; here we report what a passing run looks like.
 */
export function solutionScope(_solution: Solution, config: Config): CheckScope {
  return { passed: config.tests.length, total: config.tests.length, perfPassed: true, timeMs: 0 };
}

export function solutionState(solution: Solution, _config: Config): State {
  return { lang: 'python', code: { python: solution.python, javascript: solution.javascript } };
}

/** Show the solution in the language the student was using. */
export function mergeSolution(current: State, solved: State): State {
  return { ...solved, lang: current.lang };
}

export function describeState(state: State, config: Config): string {
  const r = state.results;
  const lines = state.code[state.lang].split('\n').length;
  if (!r)
    return `${state.lang === 'python' ? 'Python' : 'JavaScript'} editor, ${lines} lines. Tests not run yet.`;
  const perf =
    r.perfPassed === null ? '' : r.perfPassed ? ' Performance test passed.' : ' Performance test failed.';
  return `${r.passed} of ${config.tests.length} tests passed.${perf}${r.error ? ` Error: ${r.error}` : ''}`;
}

export function comparatorOf(config: Config): Comparator {
  return config.comparator;
}

export const codeRunnerLogic: ChallengeLogic<RawConfig, Config, State, Solution> = {
  type: 'code-runner',
  configSchema,
  solutionSchema,
  resolveConfig,
  initialState,
  checkScope,
  solutionScope,
  solutionState,
  mergeSolution,
  describeState,
};
