import { useId } from 'react';
import { evalNumber } from '../../engine/expr';
import { parseNumber } from '../common';
import type { WidgetViewProps } from '../types';
import { AnswerField, NumberLine } from '../ui';
import { numericModel, type NumericAnswer, type NumericQuestion } from './model';

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
  const learnerRight =
    !!reveal && reveal.learner != null && numericModel.grade(q, reveal.learner, ctx).correct;
  return (
    <div data-testid="numeric">
      <label htmlFor={id} className="sr-only">
        Your answer{q.answer.unit ? ` in ${q.answer.unit}` : ''}
      </label>
      <AnswerField
        id={id}
        value={(reveal ? reveal.learner : answer) ?? ''}
        onChange={(v) => onChange(v.trim() ? v : null)}
        disabled={disabled}
        unit={q.answer.unit}
        state={wrongFirst ? 'wrong' : reveal ? (learnerRight ? 'correct' : 'wrong') : 'idle'}
        testId="numeric-input"
      />
      <p className="mt-2 text-small font-semibold text-ink-2">Decimals or fractions such as 1/6 are fine.</p>
      {reveal && correct !== null && (
        <div className="mt-2">
          <p className="font-semibold">
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
