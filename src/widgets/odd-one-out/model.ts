import { z } from 'zod';
import { renderTemplate } from '../../engine/template';
import { commonFields } from '../common';
import { mcqModel, McqSchema } from '../mcq/model';
import type { Grade, WidgetModel } from '../types';

/**
 * `odd-one-out` (§9.2): pick the item that doesn't belong, then say why (an mcq). Both parts must
 * be right. Items are text/KaTeX or a mini plot.
 */

const Item = z.union([
  z.string().min(1),
  z.strictObject({
    plot: z.string().min(1),
    x: z.tuple([z.number(), z.number()]).optional(),
    label: z.string().optional(),
  }),
]);

const WhySchema = McqSchema.omit({
  id: true,
  difficulty: true,
  hints: true,
  explanation: true,
  graded: true,
  version: true,
  verify: true,
});

export const OddOneOutSchema = z.strictObject({
  ...commonFields,
  kind: z.literal('odd-one-out'),
  items: z.array(Item).length(4),
  odd: z.number().int().min(0).max(3),
  why: WhySchema,
});

export type OddOneOutQuestion = z.infer<typeof OddOneOutSchema>;
export interface OddOneOutAnswer {
  pick: number | null;
  why: number | null;
}

export function whyQuestion(q: OddOneOutQuestion) {
  return { ...q.why, id: `${q.id}-why`, difficulty: q.difficulty };
}

export const oddOneOutModel: WidgetModel<OddOneOutQuestion, OddOneOutAnswer> = {
  kind: 'odd-one-out',
  schema: OddOneOutSchema,
  nonTextKeys: ['items'],
  texts(q) {
    return q.items.map((i) => (typeof i === 'string' ? i : (i.label ?? '')));
  },
  grade(q, answer, ctx): Grade {
    const pickOk = answer.pick === q.odd;
    const why = answer.why === null ? { correct: false } : mcqModel.grade(whyQuestion(q), answer.why, ctx);
    return { correct: pickOk && why.correct, parts: [pickOk, why.correct], misconception: why.misconception };
  },
  correctAnswer(q, ctx) {
    return { pick: q.odd, why: mcqModel.correctAnswer(whyQuestion(q), ctx) };
  },
  validate(q, ctx) {
    const errs: string[] = [];
    const keys = q.items.map((i) =>
      typeof i === 'string' ? renderTemplate(i, ctx.scope) : `plot:${i.plot}`,
    );
    if (new Set(keys).size !== 4) errs.push('the 4 items must be distinct');
    errs.push(...mcqModel.validate(whyQuestion(q), ctx).map((e) => `why: ${e}`));
    return errs;
  },
  describe(_q, answer) {
    return `Picked item ${answer.pick === null ? '—' : answer.pick + 1}`;
  },
  tags(q) {
    return mcqModel.tags(whyQuestion(q));
  },
};
