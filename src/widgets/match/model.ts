import { z } from 'zod';
import { renderTemplate } from '../../engine/template';
import { commonFields } from '../common';
import type { Grade, WidgetModel } from '../types';

/**
 * `match` (§9.2): link each left item to a right item. Sides are text/KaTeX or a mini plot
 * (`{ plot: expr, x?: [a, b] }`). `extraRights` are decoys. Per-pair marking.
 */

const Side = z.union([
  z.string().min(1),
  z.strictObject({
    plot: z.string().min(1),
    x: z.tuple([z.number(), z.number()]).optional(),
    label: z.string().optional(),
  }),
]);
export type MatchSide = z.infer<typeof Side>;

export const MatchSchema = z.strictObject({
  ...commonFields,
  kind: z.literal('match'),
  pairs: z
    .array(z.strictObject({ left: Side, right: Side }))
    .min(2)
    .max(6),
  extraRights: z.array(Side).max(3).optional(),
});

export type MatchQuestion = z.infer<typeof MatchSchema>;
/** For each left (authored order), the index of the chosen right in [...pairs.right, ...extraRights]. */
export type MatchAnswer = (number | null)[];

export function sideKey(s: MatchSide, scope: Record<string, unknown>): string {
  return typeof s === 'string' ? renderTemplate(s, scope) : `plot:${s.plot}:${s.x?.join(',') ?? ''}`;
}

export const matchModel: WidgetModel<MatchQuestion, MatchAnswer> = {
  kind: 'match',
  schema: MatchSchema,
  nonTextKeys: ['pairs', 'extraRights'],
  texts(q) {
    const sides = [...q.pairs.flatMap((p) => [p.left, p.right]), ...(q.extraRights ?? [])];
    return sides.map((s) => (typeof s === 'string' ? s : (s.label ?? '')));
  },
  grade(q, answer): Grade {
    const parts = q.pairs.map((_, i) => answer[i] === i);
    return { correct: parts.every(Boolean), parts };
  },
  correctAnswer(q) {
    return q.pairs.map((_, i) => i);
  },
  validate(q, ctx) {
    const errs: string[] = [];
    const lefts = q.pairs.map((p) => sideKey(p.left, ctx.scope));
    const rights = [...q.pairs.map((p) => p.right), ...(q.extraRights ?? [])].map((s) =>
      sideKey(s, ctx.scope),
    );
    if (new Set(lefts).size !== lefts.length) errs.push('left items must be distinct');
    if (new Set(rights).size !== rights.length) errs.push('right items (including decoys) must be distinct');
    return errs;
  },
  describe(q, answer, ctx) {
    const rights = [...q.pairs.map((p) => p.right), ...(q.extraRights ?? [])];
    return q.pairs
      .map(
        (p, i) =>
          `${sideKey(p.left, ctx.scope)} ↔ ${answer[i] === null || answer[i] === undefined ? '—' : sideKey(rights[answer[i]!], ctx.scope)}`,
      )
      .join('; ');
  },
  tags() {
    return [];
  },
};
