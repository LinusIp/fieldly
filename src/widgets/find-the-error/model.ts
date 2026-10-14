import { z } from 'zod';
import { commonFields } from '../common';
import { expressionModel, ExpressionSchema } from '../expression/model';
import { mcqModel, McqSchema } from '../mcq/model';
import { numericModel, NumericSchema } from '../numeric/model';
import type { Grade, WidgetCtx, WidgetModel } from '../types';

/**
 * `find-the-error` (§9.2): tap the first wrong line of a worked solution, then fix it with a
 * `numeric`, `expression` or `mcq` sub-question. Both parts are graded.
 */

/** The fix: a numeric, expression or mcq question without its own id/difficulty/hints/explanation. */
const fixOf = <T extends z.ZodObject>(s: T) =>
  s.omit({
    id: true,
    difficulty: true,
    hints: true,
    explanation: true,
    graded: true,
    version: true,
    verify: true,
  });
const FixSchema = z.discriminatedUnion('kind', [
  fixOf(NumericSchema),
  fixOf(ExpressionSchema),
  fixOf(McqSchema),
]);

export const FindTheErrorSchema = z.strictObject({
  ...commonFields,
  kind: z.literal('find-the-error'),
  lines: z.array(z.string().min(1)).min(3).max(10),
  /** Index (0-based) of the first wrong line. */
  errorLine: z.number().int().min(0),
  fix: FixSchema,
});

export type FindTheErrorQuestion = z.infer<typeof FindTheErrorSchema>;
export interface FindTheErrorAnswer {
  line: number | null;
  fix: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fixModel(q: FindTheErrorQuestion): { model: WidgetModel<any, any>; question: any } {
  const question = { ...q.fix, id: `${q.id}-fix`, difficulty: q.difficulty };
  const model =
    q.fix.kind === 'numeric' ? numericModel : q.fix.kind === 'expression' ? expressionModel : mcqModel;
  return { model, question };
}

export function gradeFix(q: FindTheErrorQuestion, fix: unknown, ctx: WidgetCtx): Grade {
  const { model, question } = fixModel(q);
  return fix === null || fix === undefined ? { correct: false } : model.grade(question, fix, ctx);
}

export const findTheErrorModel: WidgetModel<FindTheErrorQuestion, FindTheErrorAnswer> = {
  kind: 'find-the-error',
  schema: FindTheErrorSchema,
  grade(q, answer, ctx): Grade {
    const lineOk = answer.line === q.errorLine;
    const fix = gradeFix(q, answer.fix, ctx);
    return {
      correct: lineOk && fix.correct,
      parts: [lineOk, fix.correct],
      misconception: fix.misconception,
      interpretation: !lineOk
        ? answer.line !== null && answer.line < q.errorLine
          ? 'That line is fine — the mistake comes later.'
          : 'The mistake comes earlier.'
        : fix.interpretation,
    };
  },
  correctAnswer(q, ctx) {
    const { model, question } = fixModel(q);
    return { line: q.errorLine, fix: model.correctAnswer(question, ctx) };
  },
  validate(q, ctx) {
    const errs: string[] = [];
    if (q.errorLine >= q.lines.length) errs.push(`errorLine ${q.errorLine} is past the last line`);
    const { model, question } = fixModel(q);
    const parsed = model.schema.safeParse(question);
    if (!parsed.success) errs.push(`fix: ${parsed.error.issues[0]?.message}`);
    else errs.push(...model.validate(question, ctx).map((e) => `fix: ${e}`));
    return errs;
  },
  describe(q, answer, ctx) {
    const { model, question } = fixModel(q);
    return `Line ${answer.line === null ? '—' : answer.line + 1}; fix: ${answer.fix === null || answer.fix === undefined ? '—' : model.describe(question, answer.fix, ctx)}`;
  },
  tags(q) {
    const { model, question } = fixModel(q);
    return model.tags(question);
  },
};
