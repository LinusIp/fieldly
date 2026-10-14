import { useMemo } from 'react';
import type { WidgetViewProps } from '../types';
import { BlankText } from './BlankText';
import { blanksOf, gradeBlank, segmentsOf, type BlanksAnswer, type BlanksQuestion } from './model';

/** Fill blanks inside a sentence or derivation; each blank is marked (§9.2). */
export function BlanksView({
  question: q,
  ctx,
  disabled,
  answer,
  onChange,
  marks,
  reveal,
}: WidgetViewProps<BlanksQuestion, BlanksAnswer>) {
  const segments = useMemo(() => segmentsOf(q.text), [q.text]);
  const blanks = useMemo(() => blanksOf(q.text), [q.text]);
  const values = answer ?? blanks.map(() => '');
  let parts: (boolean | undefined)[] | undefined;
  if (reveal) parts = blanks.map((b, i) => gradeBlank(b, reveal.learner?.[i] ?? '', ctx.scope));
  else if (marks)
    // A first-attempt mark stays while that blank is unchanged.
    parts = blanks.map((_, i) => (values[i] === marks.answer[i] ? marks.grade.parts?.[i] : undefined));
  return (
    <div className="text-[1.05rem]" data-testid="blanks">
      <BlankText
        segments={segments}
        scope={ctx.scope}
        values={reveal ? (reveal.learner ?? []) : values}
        disabled={disabled}
        parts={parts}
        revealed={reveal ? blanks.map(() => true) : undefined}
        seed={ctx.seed}
        onChange={(i, v) => {
          const next = [...values];
          next[i] = v;
          onChange(next.every((x) => x.trim()) ? next : next.some((x) => x.trim()) ? next : null);
        }}
      />
    </div>
  );
}
