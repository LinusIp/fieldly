import { z } from 'zod';
import { evalNumber, type Scope } from '../../engine/expr';
import { formatNumber } from '../../engine/format';
import { commonFields, exprString, numOrExpr, parseNumber } from '../common';
import type { Grade, WidgetModel } from '../types';

/**
 * `estimate` (§9.2): drag a slider or type a guess. Never "wrong": the score comes from how close
 * the guess is (default bands: within 10% → 1.0, within 25% → 0.6, else 0.3). One attempt.
 */

export const EstimateSchema = z.strictObject({
  ...commonFields,
  kind: z.literal('estimate'),
  answer: z.strictObject({ expr: exprString, unit: z.string().optional() }),
  range: z.tuple([numOrExpr, numOrExpr]),
  step: numOrExpr.optional(),
  bands: z
    .array(z.strictObject({ within: z.number().positive(), score: z.number().min(0).max(1) }))
    .min(1)
    .optional(),
});

export type EstimateQuestion = z.infer<typeof EstimateSchema>;
export type EstimateAnswer = string;

const DEFAULT_BANDS = [
  { within: 0.1, score: 1 },
  { within: 0.25, score: 0.6 },
];

export function estimateRange(q: EstimateQuestion, scope: Scope): [number, number] {
  const n = (v: number | string) => (typeof v === 'number' ? v : evalNumber(v, scope));
  return [n(q.range[0]), n(q.range[1])];
}

export const estimateModel: WidgetModel<EstimateQuestion, EstimateAnswer> = {
  kind: 'estimate',
  schema: EstimateSchema,
  grade(q, answer, ctx): Grade {
    const x = parseNumber(answer);
    const target = evalNumber(q.answer.expr, ctx.scope);
    if (x === null) return { correct: false, score: 0, interpretation: "That isn't a number." };
    const rel = Math.abs(x - target) / Math.max(Math.abs(target), 1e-12);
    const band = [...(q.bands ?? DEFAULT_BANDS)]
      .sort((a, b) => a.within - b.within)
      .find((b) => rel <= b.within);
    const score = band?.score ?? 0.3;
    const pct = Math.round(rel * 100);
    return {
      correct: score >= 1,
      score,
      interpretation: `The answer is ${formatNumber(target)}${q.answer.unit ? ` ${q.answer.unit}` : ''}: you were ${pct === 0 ? 'spot on' : `${pct}% ${x > target ? 'high' : 'low'}`}.`,
    };
  },
  correctAnswer(q, ctx) {
    return String(Number(evalNumber(q.answer.expr, ctx.scope).toPrecision(8)));
  },
  validate(q, ctx) {
    const errs: string[] = [];
    const a = evalNumber(q.answer.expr, ctx.scope);
    const [lo, hi] = estimateRange(q, ctx.scope);
    if (!(lo < hi)) errs.push('estimate range must be increasing');
    if (!(a >= lo && a <= hi))
      errs.push(`answer ${formatNumber(a)} is outside the range [${formatNumber(lo)}, ${formatNumber(hi)}]`);
    return errs;
  },
  describe(q, answer) {
    return `Estimated ${answer}${q.answer.unit ? ` ${q.answer.unit}` : ''}`;
  },
  tags() {
    return [];
  },
};
