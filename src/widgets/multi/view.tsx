import { useMemo } from 'react';
import { hashString, seededOrder } from '../common';
import type { WidgetViewProps } from '../types';
import { Mark, markClass, Tx, useDigitKeys } from '../ui';
import type { MultiAnswer, MultiQuestion } from './model';

/** A checkbox group (§11): all-or-nothing, but wrong picks and missed ones are marked. */
export function MultiView({
  question: q,
  ctx,
  disabled,
  answer,
  onChange,
  marks,
  reveal,
}: WidgetViewProps<MultiQuestion, MultiAnswer>) {
  const order = useMemo(
    () =>
      q.fixedOrder ? q.options.map((_, i) => i) : seededOrder(q.options.length, ctx.seed ^ hashString(q.id)),
    [q, ctx.seed],
  );
  const picked = new Set(answer ?? []);
  const toggle = (i: number) => {
    const next = new Set(picked);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    onChange(next.size ? [...next].sort((a, b) => a - b) : null);
  };
  useDigitKeys(!disabled, order.length, (pos) => toggle(order[pos]));
  // Marks after a wrong first attempt describe that answer; after the reveal, the final one.
  const shown = reveal ? new Set(reveal.learner ?? []) : marks ? new Set(marks.answer) : null;
  return (
    <fieldset className="grid gap-3" data-testid="multi">
      <legend className="mb-1 text-sm text-ink-2">Select all that apply.</legend>
      {order.map((i, pos) => {
        const o = q.options[i];
        let state: 'ok' | 'bad' | 'picked' | 'none' = picked.has(i) ? 'picked' : 'none';
        let label: string | null = null;
        if (shown && (marks || reveal)) {
          const was = shown.has(i);
          if (reveal && o.correct) {
            state = 'ok';
            label = was ? 'Correct pick' : 'Correct (you missed it)';
          } else if (was && !o.correct) {
            state = 'bad';
            label = 'Shouldn’t be picked';
          } else if (!reveal && was && o.correct && picked.has(i)) state = 'picked';
        }
        return (
          <label
            key={i}
            className={`flex min-h-[56px] items-center gap-3 rounded-lg border-2 px-4 py-3 text-[18px] font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-primary ${markClass(state)} ${state === 'picked' ? 'shadow-linked' : state === 'none' && !disabled ? 'shadow-s1' : ''} ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[var(--primary)]"
              checked={picked.has(i)}
              disabled={disabled}
              onChange={() => toggle(i)}
            />
            <span aria-hidden="true" className="mt-0.5 text-xs font-semibold text-ink-2">
              {pos + 1}
            </span>
            <span className="min-w-0 flex-1">
              <Tx s={o.text} scope={ctx.scope} />
            </span>
            {label && <Mark ok={state === 'ok'} label={label} />}
          </label>
        );
      })}
    </fieldset>
  );
}
