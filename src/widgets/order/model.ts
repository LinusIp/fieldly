import { z } from 'zod';
import { evalNumber, type Scope } from '../../engine/expr';
import { renderTemplate } from '../../engine/template';
import { commonFields } from '../common';
import type { Grade, WidgetModel } from '../types';

/**
 * `order` (§9.2): drag items into order. With item `value`s and `orderBy`, the correct order is
 * computed (so the validator proves it); otherwise `correctOrder` lists ids. A `wrongOrders` match
 * names the misconception. Feedback marks items already in the right position.
 */

export const OrderSchema = z
  .strictObject({
    ...commonFields,
    kind: z.literal('order'),
    items: z
      .array(
        z.strictObject({
          id: z.string().min(1),
          text: z.string().min(1),
          value: z.string().min(1).optional(),
        }),
      )
      .min(3)
      .max(8),
    orderBy: z.enum(['value-desc', 'value-asc']).optional(),
    correctOrder: z.array(z.string()).optional(),
    wrongOrders: z
      .array(z.strictObject({ order: z.array(z.string()), misconception: z.string() }))
      .optional(),
  })
  .refine((q) => !!q.orderBy !== !!q.correctOrder, {
    message: 'give either orderBy (with values) or correctOrder',
  });

export type OrderQuestion = z.infer<typeof OrderSchema>;
/** Item ids in the learner's order. */
export type OrderAnswer = string[];

export function correctOrderOf(q: OrderQuestion, scope: Scope): string[] {
  if (q.correctOrder) return q.correctOrder;
  const vals = q.items.map((it) => ({ id: it.id, v: evalNumber(it.value!, scope) }));
  vals.sort((a, b) => (q.orderBy === 'value-desc' ? b.v - a.v : a.v - b.v));
  return vals.map((x) => x.id);
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export const orderModel: WidgetModel<OrderQuestion, OrderAnswer> = {
  kind: 'order',
  schema: OrderSchema as unknown as z.ZodType<OrderQuestion>,
  grade(q, answer, ctx): Grade {
    const target = correctOrderOf(q, ctx.scope);
    const parts = target.map((id, i) => answer[i] === id);
    const wrong = (q.wrongOrders ?? []).find((w) => same(w.order, answer));
    return { correct: same(target, answer), parts, misconception: wrong?.misconception };
  },
  correctAnswer(q, ctx) {
    return correctOrderOf(q, ctx.scope);
  },
  validate(q, ctx) {
    const errs: string[] = [];
    const ids = q.items.map((i) => i.id);
    if (new Set(ids).size !== ids.length) errs.push('order item ids must be unique');
    const perm = (o: string[]) =>
      o.length === ids.length && new Set(o).size === ids.length && o.every((x) => ids.includes(x));
    if (q.orderBy) {
      if (q.items.some((i) => !i.value)) errs.push('orderBy needs a value on every item');
      else {
        const vals = q.items.map((i) => evalNumber(i.value!, ctx.scope));
        if (vals.some((v) => !Number.isFinite(v))) errs.push('an item value is not finite');
        if (new Set(vals.map((v) => v.toPrecision(10))).size !== vals.length)
          errs.push('item values must be distinct');
      }
    }
    if (q.correctOrder && !perm(q.correctOrder)) errs.push('correctOrder must list every item id once');
    const target = errs.length ? [] : correctOrderOf(q, ctx.scope);
    for (const w of q.wrongOrders ?? []) {
      if (!perm(w.order)) errs.push(`wrong order [${w.order.join(', ')}] must list every item id once`);
      else if (same(w.order, target))
        errs.push(`wrong order [${w.order.join(', ')}] equals the correct order`);
    }
    const texts = q.items.map((i) => renderTemplate(i.text, ctx.scope));
    if (new Set(texts).size !== texts.length) errs.push('two items display the same text');
    return errs;
  },
  describe(q, answer, ctx) {
    const byId = new Map(q.items.map((i) => [i.id, renderTemplate(i.text, ctx.scope)]));
    return `Order: ${answer.map((id) => byId.get(id)).join(' → ')}`;
  },
  tags(q) {
    return (q.wrongOrders ?? []).map((w) => w.misconception);
  },
};
