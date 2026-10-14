import { z } from 'zod';
import { commonFields } from '../common';
import type { WidgetModel } from '../types';

/** `explain` (§9.2): write a short explanation; never graded. Compared with an expert answer and a checklist. */

export const ExplainSchema = z.strictObject({
  ...commonFields,
  kind: z.literal('explain'),
  expert: z.string().min(1),
  checklist: z.array(z.string().min(1)).min(1),
});

export type ExplainQuestion = z.infer<typeof ExplainSchema>;
export type ExplainAnswer = string;

export const explainModel: WidgetModel<ExplainQuestion, ExplainAnswer> = {
  kind: 'explain',
  schema: ExplainSchema,
  grade() {
    return { correct: true };
  },
  correctAnswer(q) {
    return q.expert;
  },
  validate() {
    return [];
  },
  describe(_q, answer) {
    return `Wrote: ${answer}`;
  },
  tags() {
    return [];
  },
};
