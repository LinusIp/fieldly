import { useId } from 'react';
import { ExpressionView } from '../expression/view';
import { McqView } from '../mcq/view';
import { NumericView } from '../numeric/view';
import type { WidgetViewProps } from '../types';
import { Mark, markClass, Tx } from '../ui';
import type { FindTheErrorAnswer, FindTheErrorQuestion } from './model';

/** Tap the first wrong line of a worked solution, then fix it (§9.2). Both parts are graded. */
export function FindTheErrorView({
  question: q,
  ctx,
  disabled,
  answer,
  onChange,
  marks,
  reveal,
}: WidgetViewProps<FindTheErrorQuestion, FindTheErrorAnswer>) {
  const name = useId();
  const cur: FindTheErrorAnswer = reveal
    ? (reveal.correct as FindTheErrorAnswer)
    : (answer ?? { line: null, fix: null });
  const set = (patch: Partial<FindTheErrorAnswer>) => {
    const next = { ...cur, ...patch };
    onChange(next.line === null && (next.fix === null || next.fix === undefined) ? null : next);
  };
  const lineMark = (i: number): boolean | undefined => {
    if (reveal) return i === q.errorLine ? true : reveal.learner?.line === i ? false : undefined;
    if (marks && marks.answer.line === i && cur.line === i) return marks.grade.parts?.[0];
    return undefined;
  };
  const fixQ = { ...q.fix, id: `${q.id}-fix`, difficulty: q.difficulty, prompt: '' };
  const fixMarks =
    marks && !marks.grade.parts?.[1] && marks.answer.fix != null
      ? { answer: marks.answer.fix, grade: { correct: false } }
      : undefined;
  const fixReveal = reveal
    ? { correct: (reveal.correct as FindTheErrorAnswer).fix, learner: reveal.learner?.fix ?? null }
    : undefined;
  const subProps = {
    ctx,
    disabled: disabled || !!reveal,
    answer: (reveal ? reveal.learner?.fix : cur.fix) ?? null,
    onChange: (fix: unknown) => set({ fix }),
    marks: fixMarks,
    reveal: fixReveal,
  };
  return (
    <div data-testid="find-the-error">
      <p className="mb-2 text-sm font-semibold">1. Tap the first line that is wrong.</p>
      <ol role="radiogroup" aria-label="Lines of the solution" className="grid gap-1">
        {q.lines.map((line, i) => {
          const mark = lineMark(i);
          const state = mark === true ? 'ok' : mark === false ? 'bad' : cur.line === i ? 'picked' : 'none';
          return (
            <li key={i}>
              <label
                className={`flex items-start gap-3 rounded-lg border-2 px-3 py-2 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent ${markClass(state)} ${disabled ? '' : 'cursor-pointer hover:border-accent'}`}
                data-line={i}
              >
                <input
                  type="radio"
                  name={name}
                  className="sr-only"
                  checked={cur.line === i}
                  disabled={disabled || !!reveal}
                  onChange={() => set({ line: i })}
                />
                <span className="w-6 shrink-0 text-sm font-semibold text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <Tx s={line} scope={ctx.scope} />
                </span>
                {mark !== undefined && <Mark ok={mark} label={mark ? 'First error' : 'Your pick'} />}
              </label>
            </li>
          );
        })}
      </ol>
      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold">2. Fix it:</p>
        {typeof q.fix.prompt === 'string' && q.fix.prompt && (
          <div className="mb-2">
            <Tx s={q.fix.prompt as string} scope={ctx.scope} inline={false} />
          </div>
        )}
        {q.fix.kind === 'numeric' ? (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <NumericView question={fixQ as any} {...(subProps as any)} />
        ) : q.fix.kind === 'expression' ? (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <ExpressionView question={fixQ as any} {...(subProps as any)} />
        ) : (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <McqView question={fixQ as any} {...(subProps as any)} />
        )}
      </div>
    </div>
  );
}
