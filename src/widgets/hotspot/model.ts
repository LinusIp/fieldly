import { z } from 'zod';
import { InteractiveRefSchema } from '../../content/schema';
import { commonFields } from '../common';
import type { Grade, WidgetModel } from '../types';

/**
 * `hotspot` (§9.2): tap an element of an interactive shown in `view` mode. `ordered` hotspots grade
 * a visit order (BFS, heap). `wrongTargets` maps an element to a misconception. `verify` rules are
 * evaluated on the interactive's initial state, so the validator proves the answer from the model.
 */

export const HotspotSchema = z.strictObject({
  ...commonFields,
  kind: z.literal('hotspot'),
  on: InteractiveRefSchema,
  targets: z.array(z.string().min(1)).min(2),
  answer: z.array(z.string().min(1)).min(1),
  ordered: z.boolean().optional(),
  wrongTargets: z.record(z.string(), z.string()).optional(),
});

export type HotspotQuestion = z.infer<typeof HotspotSchema>;
/** Tapped element ids, in tap order. */
export type HotspotAnswer = string[];

export const hotspotModel: WidgetModel<HotspotQuestion, HotspotAnswer> = {
  kind: 'hotspot',
  schema: HotspotSchema,
  grade(q, answer): Grade {
    let correct: boolean;
    if (q.ordered) correct = answer.length === q.answer.length && answer.every((id, i) => id === q.answer[i]);
    else correct = answer.length === q.answer.length && q.answer.every((id) => answer.includes(id));
    const wrong = answer.find((id) => !q.answer.includes(id));
    const parts = q.ordered
      ? q.answer.map((id, i) => answer[i] === id)
      : answer.map((id) => q.answer.includes(id));
    return { correct, parts, misconception: wrong ? q.wrongTargets?.[wrong] : undefined };
  },
  correctAnswer(q) {
    return [...q.answer];
  },
  validate(q) {
    const errs: string[] = [];
    for (const id of q.answer) if (!q.targets.includes(id)) errs.push(`answer "${id}" is not a target`);
    for (const id of Object.keys(q.wrongTargets ?? {}))
      if (!q.targets.includes(id)) errs.push(`wrongTargets "${id}" is not a target`);
      else if (q.answer.includes(id)) errs.push(`wrongTargets "${id}" is part of the answer`);
    if (new Set(q.targets).size !== q.targets.length) errs.push('targets must be unique');
    return errs;
  },
  describe(_q, answer) {
    return answer.length ? `Tapped ${answer.join(', ')}` : 'Nothing tapped';
  },
  tags(q) {
    return Object.values(q.wrongTargets ?? {});
  },
};
