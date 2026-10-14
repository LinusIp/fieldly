import { useId } from 'react';
import { evalNumber } from '../../engine/expr';
import { formatNumber } from '../../engine/format';
import { parseNumber } from '../common';
import type { WidgetViewProps } from '../types';
import { NumberLine } from '../ui';
import { estimateRange, type EstimateAnswer, type EstimateQuestion } from './model';

/** Drag a slider or type a guess (§9.2). Never "wrong": one attempt, scored by closeness. */
export function EstimateView({
  question: q,
  ctx,
  disabled,
  answer,
  onChange,
  reveal,
}: WidgetViewProps<EstimateQuestion, EstimateAnswer>) {
  const id = useId();
  const [lo, hi] = estimateRange(q, ctx.scope);
  const step =
    q.step === undefined
      ? (hi - lo) / 100
      : typeof q.step === 'number'
        ? q.step
        : evalNumber(q.step, ctx.scope);
  const x = answer !== null ? parseNumber(answer) : null;
  const sliderValue = x !== null && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : (lo + hi) / 2;
  const unit = q.answer.unit ? ` ${q.answer.unit}` : '';
  const learner = reveal?.learner != null ? parseNumber(reveal.learner) : null;
  return (
    <div data-testid="estimate">
      <label htmlFor={id} className="sr-only">
        Your estimate{unit}
      </label>
      <input
        id={id}
        type="range"
        min={lo}
        max={hi}
        step={step}
        value={sliderValue}
        disabled={disabled}
        onChange={(e) => onChange(String(Number(Number(e.target.value).toPrecision(6))))}
        className="w-full accent-[var(--primary)]"
      />
      <div className="mt-1 flex justify-between text-xs text-ink-2" aria-hidden="true">
        <span>
          {formatNumber(lo)}
          {unit}
        </span>
        <span>
          {formatNumber(hi)}
          {unit}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm text-ink-2">or type:</span>
        <input
          type="text"
          inputMode="decimal"
          aria-label={`Your estimate, typed${unit}`}
          value={answer ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.trim() ? e.target.value : null)}
          className="w-32 rounded-lg border-2 border-outline bg-surface-sunk px-3 py-1.5 font-mono focus:border-primary"
          data-testid="estimate-input"
        />
        {unit && <span className="text-ink-2">{unit}</span>}
      </div>
      {reveal && learner !== null && (
        <NumberLine learner={learner} correct={evalNumber(q.answer.expr, ctx.scope)} unit={q.answer.unit} />
      )}
    </div>
  );
}
