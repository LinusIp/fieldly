import { useId, useMemo, useRef } from 'react';
import { Markdown } from '../../components/Markdown';
import { math } from '../../engine/expr';
import { normaliseInput } from '../common';
import type { WidgetViewProps } from '../types';
import { ExprCompare, Mark } from '../ui';
import { substituteParams, type ExpressionAnswer, type ExpressionQuestion } from './model';

function toTex(input: string): string | null {
  try {
    return math.parse(normaliseInput(input)).toTex({ parenthesis: 'auto', implicit: 'hide' });
  } catch {
    return null;
  }
}

/** Type a formula: plain-text input, live KaTeX preview and a symbol keypad (§9.2, §11). */
export function ExpressionView({
  question: q,
  ctx,
  disabled,
  answer,
  onChange,
  marks,
  reveal,
}: WidgetViewProps<ExpressionQuestion, ExpressionAnswer>) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const vars = Object.keys(q.answer.vars);
  const keys = [...vars, ...(q.allowedSymbols ?? []), '+', '−', '×', '/', '^', '(', ')', 'sqrt(', 'π'];
  const tex = answer ? toTex(answer) : null;
  const wrongFirst = marks && !marks.grade.correct && answer === marks.answer;
  const correct = useMemo(
    () => substituteParams(q.answer.expr, ctx.scope, new Set(vars)),
    [q, ctx.scope, vars],
  );
  const insert = (k: string) => {
    const el = input.current;
    const cur = answer ?? '';
    const at = el?.selectionStart ?? cur.length;
    const end = el?.selectionEnd ?? at;
    const next = cur.slice(0, at) + k + cur.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + k.length, at + k.length);
    });
  };
  return (
    <div data-testid="expression">
      <label htmlFor={id} className="sr-only">
        Your expression, using {vars.join(', ')}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          ref={input}
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={answer ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.trim() ? e.target.value : null)}
          className={`w-full max-w-md rounded-lg border-2 bg-bg px-3 py-2 font-mono text-lg ${wrongFirst ? 'border-bad' : 'border-border focus:border-accent'}`}
          data-testid="expression-input"
        />
        {wrongFirst && <Mark ok={false} label="Not this" />}
      </div>
      <div className="mt-2 min-h-[2rem] text-lg" aria-live="polite">
        {tex ? (
          <Markdown inline>{`$${tex}$`}</Markdown>
        ) : answer ? (
          <span className="text-sm text-muted">…</span>
        ) : null}
      </div>
      {!disabled && (
        <div className="mt-1 flex flex-wrap gap-1" aria-label="Symbol keypad">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => insert(k === '−' ? '-' : k === '×' ? '*' : k === 'π' ? 'pi' : k)}
              className="min-h-[44px] min-w-[44px] rounded-lg border border-border bg-surface px-2 font-mono text-sm hover:bg-surface-2"
            >
              {k}
            </button>
          ))}
        </div>
      )}
      <p className="mt-1 text-xs text-muted">
        Use {vars.join(', ')}
        {q.allowedSymbols?.length ? ` and ${q.allowedSymbols.join(', ')}` : ''}. Write powers as x^2.
      </p>
      {reveal && (
        <div className="mt-2">
          <p className="text-sm">
            Correct answer: <Markdown inline>{`$${toTex(correct) ?? correct}$`}</Markdown>
          </p>
          {reveal.learner && vars.length === 1 && (
            <ExprCompare
              learner={reveal.learner}
              correct={q.answer.expr}
              variable={vars[0]}
              range={q.answer.vars[vars[0]]}
              scope={ctx.scope}
            />
          )}
        </div>
      )}
    </div>
  );
}
