import { useId } from 'react';
import { evalNumber } from '../../engine/expr';
import { parseNumber } from '../common';
import type { WidgetViewProps } from '../types';
import { Mark, NumberLine } from '../ui';
import type { NumericAnswer, NumericQuestion } from './model';

/** Type a number (decimals or fractions). The unit is shown, not typed (§9.2). */
export function NumericView({
  question: q,
  ctx,
  disabled,
  answer,
  onChange,
  marks,
  reveal,
}: WidgetViewProps<NumericQuestion, NumericAnswer>) {
  const id = useId();
  const wrongFirst = marks && !marks.grade.correct && answer === marks.answer;
  const learner = reveal?.learner != null ? parseNumber(reveal.learner) : null;
  const correct = reveal ? evalNumber(q.answer.expr, ctx.scope) : null;
  return (
    <div data-testid="numeric">
      <label htmlFor={id} className="sr-only">
        Your answer{q.answer.unit ? ` in ${q.answer.unit}` : ''}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={answer ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.trim() ? e.target.value : null)}
          className={`w-40 rounded-lg border-2 bg-bg px-3 py-2 font-mono text-lg ${wrongFirst ? 'border-bad' : 'border-border focus:border-accent'}`}
          data-testid="numeric-input"
        />
        {q.answer.unit && <span className="text-lg text-muted">{q.answer.unit}</span>}
        {wrongFirst && <Mark ok={false} label="Not this" />}
      </div>
      <p className="mt-1 text-xs text-muted">Decimals or fractions such as 1/6 are fine.</p>
      {reveal && correct !== null && (
        <div className="mt-2">
          <p className="text-sm">
            Correct answer:{' '}
            <strong data-testid="correct-answer">
              {String(Number(correct.toPrecision(6)))}
              {q.answer.unit ? ` ${q.answer.unit}` : ''}
            </strong>
          </p>
          {learner !== null && Number.isFinite(correct) && (
            <NumberLine learner={learner} correct={correct} unit={q.answer.unit} />
          )}
        </div>
      )}
    </div>
  );
}
