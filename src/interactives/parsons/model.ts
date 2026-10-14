import { z } from 'zod';
import { hashString } from '../../widgets/common';
import { mulberry32 } from '../../engine/params';
import type { ChallengeLogic, CheckScope, ResolveCtx } from '../types';

/*
 * parsons (§9.2): drag lines into order. Lines can be code (with Python indentation) or proof
 * steps; distractor lines must be left out.
 */

export const configSchema = z.strictObject({
  language: z.enum(['python', 'javascript', 'text']),
  /** Whether indentation matters (Python). */
  indent: z.boolean().default(false),
  lines: z.array(z.strictObject({ id: z.string().min(1), text: z.string().min(1) })).min(2),
  distractors: z.array(z.strictObject({ id: z.string().min(1), text: z.string().min(1) })).default([]),
});

export const solutionSchema = z.strictObject({
  order: z
    .array(z.strictObject({ id: z.string().min(1), indent: z.number().int().min(0).max(6).default(0) }))
    .min(2),
});

export type RawConfig = z.input<typeof configSchema>;
export type Config = z.output<typeof configSchema>;
export type Solution = z.output<typeof solutionSchema>;

export interface Placed {
  id: string;
  indent: number;
}

export interface State {
  pool: string[];
  answer: Placed[];
}

export function resolveConfig(raw: RawConfig, ctx: ResolveCtx): Config {
  const c = configSchema.parse(raw);
  return {
    ...c,
    lines: c.lines.map((l) => ({ ...l, text: ctx.text(l.text) })),
    distractors: c.distractors.map((l) => ({ ...l, text: ctx.text(l.text) })),
  };
}

/** Lines start in a deterministic shuffled order. */
export function initialState(config: Config): State {
  const ids = [...config.lines, ...config.distractors].map((l) => l.id);
  const rng = mulberry32(hashString(ids.join('|')));
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return { pool: ids, answer: [] };
}

function scope(answer: Placed[], config: Config, solution: Placed[]): CheckScope {
  const distractorIds = new Set(config.distractors.map((d) => d.id));
  const usedDistractors = answer.filter((p) => distractorIds.has(p.id)).length;
  const orderCorrect = answer.length === solution.length && answer.every((p, i) => p.id === solution[i].id);
  const indentCorrect =
    !config.indent || (orderCorrect && answer.every((p, i) => p.indent === solution[i].indent));
  // Longest prefix in the right place — a progress measure for feedback.
  let prefix = 0;
  while (prefix < answer.length && prefix < solution.length && answer[prefix].id === solution[prefix].id)
    prefix++;
  return {
    orderCorrect,
    indentCorrect,
    usedDistractors,
    placed: answer.length,
    total: solution.length,
    correctPrefix: prefix,
  };
}

/** The solution is needed to score a state, so the config carries it after resolution. */
export interface ConfigWithSolution extends Config {
  solution?: Placed[];
}

export function checkScope(state: State, config: ConfigWithSolution): CheckScope {
  return scope(state.answer, config, config.solution ?? []);
}

export function solutionScope(solution: Solution, config: Config): CheckScope {
  const order = solution.order.map((o) => ({ id: o.id, indent: o.indent ?? 0 }));
  return scope(order, config, order);
}

export function solutionState(solution: Solution, config: Config): State {
  const answer = solution.order.map((o) => ({ id: o.id, indent: o.indent ?? 0 }));
  const used = new Set(answer.map((a) => a.id));
  return {
    pool: [...config.lines, ...config.distractors].map((l) => l.id).filter((id) => !used.has(id)),
    answer,
  };
}

export function describeState(state: State, config: Config): string {
  const text = new Map([...config.lines, ...config.distractors].map((l) => [l.id, l.text]));
  if (state.answer.length === 0) return `No lines placed yet. ${state.pool.length} lines available.`;
  return `Your solution, ${state.answer.length} lines: ${state.answer
    .map((p, i) => `${i + 1}. ${config.indent ? `(indent ${p.indent}) ` : ''}${text.get(p.id)}`)
    .join('; ')}. ${state.pool.length} lines unused.`;
}

export function withSolution(config: ConfigWithSolution, solution: Solution): ConfigWithSolution {
  return { ...config, solution: solution.order.map((o) => ({ id: o.id, indent: o.indent ?? 0 })) };
}

export const parsonsLogic: ChallengeLogic<RawConfig, ConfigWithSolution, State, Solution> = {
  type: 'parsons',
  configSchema: configSchema as unknown as z.ZodType<RawConfig>,
  solutionSchema: solutionSchema as unknown as z.ZodType<Solution>,
  resolveConfig,
  withSolution,
  initialState,
  checkScope,
  solutionScope,
  solutionState,
  describeState,
};
