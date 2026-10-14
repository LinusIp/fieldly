import { z } from 'zod';
import { renderTemplate } from '../../engine/template';
import { commonFields } from '../common';
import { StaticOptionSchema } from '../mcq/model';
import type { WidgetModel } from '../types';

/** `multi` (§9.2): select all that apply. All-or-nothing; wrong picks and missed ones are marked. */

export const MultiSchema = z.strictObject({
  ...commonFields,
  kind: z.literal('multi'),
  options: z.array(StaticOptionSchema).min(3).max(7),
});

export type MultiQuestion = z.infer<typeof MultiSchema>;
/** Indices (authored order) of the selected options. */
export type MultiAnswer = number[];

export const multiModel: WidgetModel<MultiQuestion, MultiAnswer> = {
  kind: 'multi',
  schema: MultiSchema,
  grade(q, answer) {
    const picked = new Set(answer);
    const parts = q.options.map((o, i) => (o.correct === true) === picked.has(i));
    const wrongPick = q.options.findIndex((o, i) => !o.correct && picked.has(i));
    return {
      correct: parts.every(Boolean),
      parts,
      misconception: wrongPick >= 0 ? q.options[wrongPick].misconception : undefined,
    };
  },
  correctAnswer(q) {
    return q.options.flatMap((o, i) => (o.correct ? [i] : []));
  },
  validate(q, ctx) {
    const errs: string[] = [];
    if (!q.options.some((o) => o.correct)) errs.push('multi needs ≥ 1 correct option');
    if (!q.options.some((o) => !o.correct)) errs.push('multi needs ≥ 1 wrong option');
    q.options.forEach(
      (o, i) => !o.correct && !o.misconception && errs.push(`option ${i + 1} needs a misconception tag`),
    );
    const texts = q.options.map((o) => renderTemplate(o.text, ctx.scope));
    if (new Set(texts).size !== texts.length) errs.push('two options display the same text');
    return errs;
  },
  describe(q, answer, ctx) {
    return answer.length
      ? `Selected: ${answer.map((i) => renderTemplate(q.options[i].text, ctx.scope)).join('; ')}`
      : 'Nothing selected';
  },
  tags(q) {
    return q.options.map((o) => o.misconception).filter((t): t is string => !!t);
  },
};
