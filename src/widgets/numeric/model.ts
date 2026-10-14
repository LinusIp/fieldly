import { z } from 'zod';
import { evalNumber } from '../../engine/expr';
import { formatNumber } from '../../engine/format';
import { commonFields, exprString, parseNumber, sigFigsOf, withinTolerance } from '../common';
import type { Grade, WidgetCtx, WidgetModel } from '../types';

/**
 * `numeric` (§9.2): type a number (decimals or fractions such as 1/6). A value within tolerance of
 * a `wrongAnswers` value triggers that misconception. The unit is shown, not typed.
 */

export const NumericSchema = z.strictObject({
  ...commonFields,
  kind: z.literal('numeric'),
  answer: z.strictObject({
    expr: exprString,
    unit: z.string().optional(),
    /** Relative tolerance, default 0.01. */
    tolerance: z.number().positive().optional(),
    /** Absolute tolerance (overrides relative). */
    abs: z.number().positive().optional(),
  }),
  wrongAnswers: z.array(z.strictObject({ expr: exprString, misconception: z.string() })).optional(),
  /** Expected significant figures: a right value with other sig figs is accepted with a note. */
  sigFigs: z.number().int().min(1).max(8).optional(),
});

export type NumericQuestion = z.infer<typeof NumericSchema>;
export type NumericAnswer = string;

export function numericTarget(q: NumericQuestion, ctx: WidgetCtx): number {
  return evalNumber(q.answer.expr, ctx.scope);
}

export const numericModel: WidgetModel<NumericQuestion, NumericAnswer> = {
  kind: 'numeric',
  schema: NumericSchema,
  grade(q, answer, ctx): Grade {
    const x = parseNumber(answer);
    if (x === null) return { correct: false, interpretation: "That isn't a number." };
    const target = numericTarget(q, ctx);
    if (withinTolerance(x, target, q.answer.tolerance, q.answer.abs)) {
      const note =
        q.sigFigs !== undefined && sigFigsOf(answer) !== q.sigFigs
          ? `Right value — written to ${q.sigFigs} significant figures it's ${formatNumber(target, { sig: q.sigFigs })}.`
          : undefined;
      return { correct: true, note };
    }
    for (const w of q.wrongAnswers ?? []) {
      const v = evalNumber(w.expr, ctx.scope);
      if (withinTolerance(x, v, q.answer.tolerance, q.answer.abs))
        return {
          correct: false,
          misconception: w.misconception,
          interpretation: x > target ? 'Too high.' : 'Too low.',
        };
    }
    return { correct: false, interpretation: x > target ? 'Too high.' : 'Too low.' };
  },
  correctAnswer(q, ctx) {
    return String(Number(numericTarget(q, ctx).toPrecision(8)));
  },
  validate(q, ctx) {
    const errs: string[] = [];
    const a = numericTarget(q, ctx);
    if (!Number.isFinite(a)) return [`answer "${q.answer.expr}" is not finite`];
    const wrong = (q.wrongAnswers ?? []).map((w) => ({ w, v: evalNumber(w.expr, ctx.scope) }));
    for (const { w, v } of wrong) {
      if (!Number.isFinite(v)) errs.push(`wrong answer "${w.expr}" is not finite`);
      else if (withinTolerance(v, a, q.answer.tolerance, q.answer.abs))
        errs.push(
          `wrong answer "${w.expr}" (${formatNumber(v)}) is within tolerance of the answer (${formatNumber(a)})`,
        );
    }
    for (let i = 0; i < wrong.length; i++)
      for (let j = i + 1; j < wrong.length; j++)
        if (withinTolerance(wrong[i].v, wrong[j].v, q.answer.tolerance, q.answer.abs))
          errs.push(`wrong answers "${wrong[i].w.expr}" and "${wrong[j].w.expr}" coincide`);
    return errs;
  },
  describe(q, answer) {
    return `Answered ${answer}${q.answer.unit ? ` ${q.answer.unit}` : ''}`;
  },
  tags(q) {
    return (q.wrongAnswers ?? []).map((w) => w.misconception);
  },
};
