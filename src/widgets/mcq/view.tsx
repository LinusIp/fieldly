import { useId, useMemo } from 'react';
import { Markdown } from '../../components/Markdown';
import type { WidgetViewProps } from '../types';
import { Mark, markClass, useDigitKeys } from '../ui';
import { buildOptions, type McqAnswer, type McqQuestion } from './model';

/** A radio group (§11). A wrong first pick stays marked and disabled; the reveal marks the answer. */
export function McqView({
  question: q,
  ctx,
  disabled,
  answer,
  onChange,
  marks,
  reveal,
}: WidgetViewProps<McqQuestion, McqAnswer>) {
  const name = useId();
  const options = useMemo(() => buildOptions(q, ctx.scope, ctx.seed), [q, ctx.scope, ctx.seed]);
  const wrong = marks && !marks.grade.correct ? marks.answer : null;
  useDigitKeys(!disabled, options.length, (i) => {
    if (options[i].index !== wrong) onChange(options[i].index);
  });
  return (
    <div role="radiogroup" aria-label="Options" className="grid gap-3" data-testid="mcq">
      {options.map((o, pos) => {
        const isWrong = wrong === o.index || (reveal && reveal.learner === o.index && !o.correct);
        const isCorrect = !!reveal && o.correct;
        const checked = answer === o.index;
        const off = disabled || wrong === o.index;
        const state = isCorrect ? 'ok' : isWrong ? 'bad' : checked ? 'picked' : 'none';
        return (
          <label
            key={o.index}
            className={`flex min-h-[56px] items-center gap-3 rounded-lg border-2 px-4 py-3 text-[18px] font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-primary ${markClass(state)} ${state === 'picked' ? 'shadow-linked' : state === 'none' && !off ? 'shadow-s1' : ''} ${off ? 'cursor-default' : 'cursor-pointer'}`}
            data-option={pos}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={checked}
              disabled={off}
              onChange={() => onChange(o.index)}
            />
            <span
              aria-hidden="true"
              className="tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border-2 border-outline bg-surface-sunk text-small font-extrabold text-ink"
            >
              {pos + 1}
            </span>
            <span className="min-w-0 flex-1">
              <Markdown inline>{o.text}</Markdown>
            </span>
            {isCorrect && <Mark ok label="Correct answer" />}
            {isWrong && <Mark ok={false} label="Your answer" />}
          </label>
        );
      })}
    </div>
  );
}
