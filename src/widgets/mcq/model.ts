import { z } from 'zod';
import { evalNumber, type Scope } from '../../engine/expr';
import { formatNumber } from '../../engine/format';
import { renderTemplate } from '../../engine/template';
import { commonFields, hashString, seededOrder } from '../common';
import type { Grade, WidgetCtx, WidgetModel } from '../types';

/**
 * `mcq` (§9.2): pick one option. Static `options` (3–5, one correct, others tagged) or computed
 * `answer` + 3 `distractors` (shown sorted ascending). Predictions (`graded: false`) may mark at
 * most one option correct and need no tags. The answer is the option's index in authored order.
 */

export const NumericOptionSchema = z.strictObject({
  expr: z.string().min(1),
  unit: z.string().optional(),
  sig: z.number().int().min(1).max(10).optional(),
});

export const StaticOptionSchema = z.strictObject({
  text: z.string().min(1),
  correct: z.literal(true).optional(),
  misconception: z.string().optional(),
});

export const McqSchema = z.strictObject({
  ...commonFields,
  kind: z.literal('mcq'),
  options: z.array(StaticOptionSchema).min(2).max(5).optional(),
  answer: NumericOptionSchema.optional(),
  distractors: z.array(NumericOptionSchema.extend({ misconception: z.string() })).optional(),
});

export type McqQuestion = z.infer<typeof McqSchema>;
export type McqAnswer = number;

export interface DisplayOption {
  /** Index in authored order: computed → [answer, ...distractors]; static → options[]. */
  index: number;
  text: string;
  correct: boolean;
  misconception?: string;
  value?: number;
}

export function formatNumericOption(value: number, unit?: string, sig?: number): string {
  const n = formatNumber(value, { sig });
  return unit ? `${n} ${unit}` : n;
}

/** Options in display order: computed sorted ascending; static shuffled per attempt unless `fixedOrder`. */
export function buildOptions(
  q: Pick<McqQuestion, 'id' | 'answer' | 'distractors' | 'options' | 'fixedOrder'>,
  scope: Scope,
  seed: number,
): DisplayOption[] {
  if (q.answer) {
    const authored = [
      { ...q.answer, misconception: undefined as string | undefined, correct: true },
      ...(q.distractors ?? []).map((d) => ({ ...d, correct: false })),
    ];
    const opts = authored.map((o, index) => {
      const value = evalNumber(o.expr, scope);
      if (!Number.isFinite(value)) throw new Error(`option "${o.expr}" is not finite (${value})`);
      return {
        index,
        value,
        text: formatNumericOption(value, o.unit, o.sig),
        correct: o.correct,
        misconception: o.misconception,
      } satisfies DisplayOption;
    });
    return [...opts].sort((a, b) => a.value - b.value || a.index - b.index);
  }
  const opts: DisplayOption[] = (q.options ?? []).map((o, index) => ({
    index,
    text: renderTemplate(o.text, scope),
    correct: o.correct === true,
    misconception: o.misconception,
  }));
  if (q.fixedOrder) return opts;
  return seededOrder(opts.length, seed ^ hashString(q.id)).map((i) => opts[i]);
}

function authored(q: McqQuestion, ctx: WidgetCtx): DisplayOption[] {
  return [...buildOptions(q, ctx.scope, ctx.seed)].sort((a, b) => a.index - b.index);
}

export const mcqModel: WidgetModel<McqQuestion, McqAnswer> = {
  kind: 'mcq',
  schema: McqSchema,
  grade(q, answer, ctx): Grade {
    const o = authored(q, ctx)[answer];
    if (!o) return { correct: false };
    return { correct: o.correct, misconception: o.correct ? undefined : o.misconception };
  },
  correctAnswer(q, ctx) {
    const i = authored(q, ctx).findIndex((o) => o.correct);
    if (i < 0) throw new Error('no correct option');
    return i;
  },
  validate(q, ctx) {
    const errs: string[] = [];
    const graded = q.graded !== false;
    if (!!q.options === !!q.answer)
      errs.push('use either static `options` or a computed `answer` with `distractors`');
    if (q.answer && (q.distractors ?? []).length !== 3) errs.push('computed mcq needs exactly 3 distractors');
    if (q.options) {
      const n = q.options.filter((o) => o.correct).length;
      if (graded && n !== 1) errs.push(`exactly 1 option must be correct (found ${n})`);
      if (!graded && n > 1) errs.push('a prediction may mark at most 1 option correct');
      if (graded && q.options.length < 3) errs.push('graded mcq needs 3–5 options');
      if (graded)
        q.options.forEach(
          (o, i) => !o.correct && !o.misconception && errs.push(`option ${i + 1} needs a misconception tag`),
        );
    }
    let opts: DisplayOption[] = [];
    try {
      opts = buildOptions(q, ctx.scope, ctx.seed);
    } catch (e) {
      errs.push((e as Error).message);
    }
    const seen = new Map<string, number>();
    for (const o of opts) {
      if (seen.has(o.text)) errs.push(`two options both display "${o.text}"`);
      seen.set(o.text, o.index);
    }
    return errs;
  },
  describe(q, answer, ctx) {
    const o = authored(q, ctx)[answer];
    return o ? `Chose "${o.text}"` : 'No option chosen';
  },
  tags(q) {
    return [
      ...(q.options ?? []).map((o) => o.misconception),
      ...(q.distractors ?? []).map((d) => d.misconception),
    ].filter((t): t is string => !!t);
  },
};
