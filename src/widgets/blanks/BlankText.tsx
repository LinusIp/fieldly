import { useMemo } from 'react';
import { Markdown } from '../../components/Markdown';
import type { Scope } from '../../engine/expr';
import { renderTemplate } from '../../engine/template';
import { hashString, seededOrder } from '../common';
import { blankAnswer, type BlankSegment } from './model';

/**
 * Text with inline blanks, shared by the `blanks` widget and `worked` screens. `asBlank(i)` says
 * whether the i-th blank segment is an input (worked screens show un-faded `[[?…]]` spans filled).
 * `parts` marks each input; `revealed` shows the correct values in place.
 */
export function BlankText({
  segments,
  scope,
  values,
  onChange,
  disabled,
  parts,
  revealed,
  asBlank = () => true,
  seed,
  label = 'Blank',
}: {
  segments: BlankSegment[];
  scope: Scope;
  values: string[];
  onChange(i: number, v: string): void;
  disabled: boolean;
  parts?: (boolean | undefined)[];
  revealed?: boolean[];
  asBlank?: (i: number) => boolean;
  seed: number;
  label?: string;
}) {
  let k = -1;
  const choiceOrders = useMemo(
    () =>
      segments.map((s, i) =>
        s.blank?.type === 'choice' ? seededOrder(s.blank.options.length, seed ^ hashString(`${i}`)) : [],
      ),
    [segments, seed],
  );
  let n = 0;
  return (
    <span className="leading-[2.6]" data-testid="blank-text">
      {segments.map((s, si) => {
        if (s.text !== undefined)
          return (
            <Markdown key={si} inline>
              {renderTemplate(s.text, scope)}
            </Markdown>
          );
        k++;
        const b = s.blank!;
        if (!asBlank(k)) return <strong key={si}>{blankAnswer(b, scope)}</strong>;
        const i = n++;
        const ok = parts?.[i];
        const shown = revealed?.[i];
        const cls = `mx-1 rounded-md border-2 bg-bg px-2 py-1 font-mono ${ok === true ? 'border-ok' : ok === false ? 'border-bad' : 'border-border focus:border-accent'}`;
        const aria = `${label} ${i + 1}${ok === true ? ', right' : ok === false ? ', wrong' : ''}`;
        const field =
          b.type === 'choice' ? (
            <select
              aria-label={aria}
              className={cls}
              value={values[i] ?? ''}
              disabled={disabled || shown}
              onChange={(e) => onChange(i, e.target.value)}
              data-testid="blank-input"
            >
              <option value="">…</option>
              {choiceOrders[si].map((j) => (
                <option key={j} value={b.options[j]}>
                  {b.options[j]}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-label={aria}
              type="text"
              autoComplete="off"
              spellCheck={false}
              size={Math.max(4, (values[i] ?? '').length + 1)}
              className={cls}
              value={values[i] ?? ''}
              disabled={disabled || shown}
              onChange={(e) => onChange(i, e.target.value)}
              data-testid="blank-input"
            />
          );
        return (
          <span key={si} className="inline-flex items-center">
            {field}
            {ok !== undefined && (
              <span aria-hidden="true" className={ok ? 'text-ok' : 'text-bad'}>
                {ok ? '✓' : '✕'}
              </span>
            )}
            {shown && !ok && (
              <span className="ml-1 text-sm font-semibold text-ok">→ {blankAnswer(b, scope)}</span>
            )}
          </span>
        );
      })}
    </span>
  );
}
