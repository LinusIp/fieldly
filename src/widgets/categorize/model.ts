import { z } from 'zod';
import { renderTemplate } from '../../engine/template';
import { commonFields } from '../common';
import type { Grade, WidgetModel } from '../types';

/**
 * `categorize` (§9.2): sort cards into buckets. Misplaced cards are marked; a misplaced card's tag
 * names the misconception (cards may share a tag).
 */

export const CategorizeSchema = z.strictObject({
  ...commonFields,
  kind: z.literal('categorize'),
  buckets: z.array(z.string().min(1)).min(2).max(5),
  cards: z
    .array(
      z.strictObject({
        text: z.string().min(1),
        bucket: z.string().min(1),
        misconception: z.string().optional(),
      }),
    )
    .min(3)
    .max(10),
});

export type CategorizeQuestion = z.infer<typeof CategorizeSchema>;
/** Bucket name per card, in authored card order (null = not placed). */
export type CategorizeAnswer = (string | null)[];

export const categorizeModel: WidgetModel<CategorizeQuestion, CategorizeAnswer> = {
  kind: 'categorize',
  schema: CategorizeSchema,
  grade(q, answer): Grade {
    const parts = q.cards.map((c, i) => answer[i] === c.bucket);
    const firstWrong = parts.findIndex((p) => !p);
    return {
      correct: parts.every(Boolean),
      parts,
      misconception: firstWrong >= 0 ? q.cards[firstWrong].misconception : undefined,
    };
  },
  correctAnswer(q) {
    return q.cards.map((c) => c.bucket);
  },
  validate(q, ctx) {
    const errs: string[] = [];
    if (new Set(q.buckets).size !== q.buckets.length) errs.push('bucket names must be unique');
    q.cards.forEach(
      (c, i) => !q.buckets.includes(c.bucket) && errs.push(`card ${i + 1} uses unknown bucket "${c.bucket}"`),
    );
    const texts = q.cards.map((c) => renderTemplate(c.text, ctx.scope));
    if (new Set(texts).size !== texts.length) errs.push('two cards display the same text');
    if (q.graded !== false && new Set(q.cards.map((c) => c.bucket)).size < 2)
      errs.push('cards should use ≥ 2 buckets');
    return errs;
  },
  describe(q, answer, ctx) {
    return q.cards
      .map((c, i) => `${renderTemplate(c.text, ctx.scope)} → ${answer[i] ?? 'unplaced'}`)
      .join('; ');
  },
  tags(q) {
    return q.cards.map((c) => c.misconception).filter((t): t is string => !!t);
  },
};
