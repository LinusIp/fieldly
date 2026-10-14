import { useId, useMemo, useRef } from 'react';
import { Markdown } from '../../components/Markdown';
import { math } from '../../engine/expr';
import { normaliseInput } from '../common';
import type { WidgetViewProps } from '../types';
import { AnswerField, ExprCompare } from '../ui';
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
      <AnswerField
        id={id}
        inputRef={input}
        inputMode="text"
        mono
        value={answer ?? ''}
        onChange={(v) => onChange(v.trim() ? v : null)}
        disabled={disabled}
        state={wrongFirst ? 'wrong' : 'idle'}
        testId="expression-input"
      />
      <div className="mt-2 min-h-[2rem] text-lg" aria-live="polite">
        {tex ? (
          <Markdown inline>{`$${tex}$`}</Markdown>
        ) : answer ? (
          <span className="text-sm text-ink-2">…</span>
        ) : null}
      </div>
      {!disabled && (
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Symbol keypad">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => insert(k === '−' ? '-' : k === '×' ? '*' : k === 'π' ? 'pi' : k)}
              className="min-h-[44px] min-w-[44px] rounded-lg border-2 border-outline bg-surface px-2 font-mono text-sm hover:bg-surface-sunk"
            >
              {k}
            </button>
          ))}
        </div>
      )}
      <p className="mt-1 text-xs text-ink-2">
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
