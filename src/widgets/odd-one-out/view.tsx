import { useId } from 'react';
import { McqView } from '../mcq/view';
import type { WidgetViewProps } from '../types';
import { Mark, markClass, MiniPlot, Tx } from '../ui';
import { whyQuestion, type OddOneOutAnswer, type OddOneOutQuestion } from './model';

/** Pick the item that doesn't belong, then say why (§9.2). Both parts must be right. */
export function OddOneOutView({
  question: q,
  ctx,
  disabled,
  answer,
  onChange,
  marks,
  reveal,
}: WidgetViewProps<OddOneOutQuestion, OddOneOutAnswer>) {
  const name = useId();
  const cur: OddOneOutAnswer = answer ?? { pick: null, why: null };
  const shownPick = reveal ? (reveal.learner?.pick ?? null) : cur.pick;
  const set = (patch: Partial<OddOneOutAnswer>) => {
    const next = { ...cur, ...patch };
    onChange(next.pick === null && next.why === null ? null : next);
  };
  const why = { ...whyQuestion(q), prompt: '' };
  return (
    <div data-testid="odd-one-out">
      <p className="mb-2 text-sm font-semibold">1. Which one doesn’t belong?</p>
      <div role="radiogroup" aria-label="Items" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {q.items.map((item, i) => {
          let mark: boolean | undefined;
          if (reveal) mark = i === q.odd ? true : shownPick === i ? false : undefined;
          else if (marks && marks.answer.pick === i && cur.pick === i) mark = marks.grade.parts?.[0];
          const state = mark === true ? 'ok' : mark === false ? 'bad' : shownPick === i ? 'picked' : 'none';
          return (
            <label
              key={i}
              className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border-2 p-2 text-center has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent ${markClass(state)} ${disabled ? '' : 'cursor-pointer hover:border-accent'}`}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={shownPick === i}
                disabled={disabled || !!reveal}
                onChange={() => set({ pick: i })}
              />
              {typeof item === 'string' ? (
                <Tx s={item} scope={ctx.scope} />
              ) : (
                <MiniPlot plot={item.plot} x={item.x} scope={ctx.scope} label={item.label} />
              )}
              {mark !== undefined && <Mark ok={mark} label={mark ? 'Odd one out' : 'Your pick'} />}
            </label>
          );
        })}
      </div>
      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold">2. Why?</p>
        {q.why.prompt && (
          <div className="mb-2">
            <Tx s={q.why.prompt} scope={ctx.scope} inline={false} />
          </div>
        )}
        <McqView
          question={why}
          ctx={ctx}
          disabled={disabled || !!reveal}
          answer={reveal ? (reveal.learner?.why ?? null) : cur.why}
          onChange={(w) => set({ why: w })}
          marks={
            marks && !marks.grade.parts?.[1] && marks.answer.why !== null
              ? { answer: marks.answer.why, grade: { correct: false } }
              : undefined
          }
          reveal={
            reveal
              ? {
                  correct: (reveal.correct as OddOneOutAnswer).why ?? 0,
                  learner: reveal.learner?.why ?? null,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
