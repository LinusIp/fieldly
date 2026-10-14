import { useState } from 'react';
import type { ChallengeComponentProps } from '../types';
import type { ConfigWithSolution, Placed, State } from './logic';

const btn =
  'rounded border border-border px-1.5 py-0.5 text-xs leading-none hover:bg-surface-2 disabled:opacity-30 disabled:hover:bg-transparent';

export function Parsons({
  config,
  state,
  disabled,
  onStateChange,
}: ChallengeComponentProps<ConfigWithSolution, State>) {
  const text = new Map([...config.lines, ...config.distractors].map((l) => [l.id, l.text]));
  const [drag, setDrag] = useState<number | null>(null);
  const mono = config.language !== 'text';

  const set = (answer: Placed[], pool = state.pool) => onStateChange({ pool, answer });
  const add = (id: string) =>
    set(
      [...state.answer, { id, indent: 0 }],
      state.pool.filter((x) => x !== id),
    );
  const remove = (i: number) =>
    set(
      state.answer.filter((_, k) => k !== i),
      [...state.pool, state.answer[i].id],
    );
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= state.answer.length) return;
    const a = [...state.answer];
    [a[i], a[j]] = [a[j], a[i]];
    set(a);
  };
  const indent = (i: number, d: number) =>
    set(state.answer.map((p, k) => (k === i ? { ...p, indent: Math.max(0, Math.min(6, p.indent + d)) } : p)));
  const dropAt = (target: number) => {
    if (drag === null || drag === target) return;
    const a = [...state.answer];
    const [item] = a.splice(drag, 1);
    a.splice(target, 0, item);
    set(a);
    setDrag(null);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="parsons">
      <section aria-labelledby="pool-h">
        <h3 id="pool-h" className="mb-2 text-sm font-semibold">
          Available lines
        </h3>
        <ul className="space-y-1.5">
          {state.pool.length === 0 && <li className="text-sm text-muted">All lines used.</li>}
          {state.pool.map((id) => (
            <li key={id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => add(id)}
                className={`w-full rounded-lg border border-border bg-bg px-3 py-2 text-left text-sm hover:border-accent ${mono ? 'font-mono' : ''}`}
                data-line={id}
              >
                <span className="sr-only">Add line: </span>
                {text.get(id)}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          Click a line to add it to your solution. Some lines may not belong.
        </p>
      </section>

      <section aria-labelledby="answer-h">
        <h3 id="answer-h" className="mb-2 text-sm font-semibold">
          Your solution
        </h3>
        <ol className="space-y-1.5" data-testid="parsons-answer">
          {state.answer.length === 0 && (
            <li className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted">
              Lines you add appear here, in order.
            </li>
          )}
          {state.answer.map((p, i) => (
            <li
              key={p.id}
              draggable={!disabled}
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropAt(i)}
              className={`flex items-center gap-2 rounded-lg border bg-surface px-2 py-1.5 ${drag === i ? 'border-accent' : 'border-border'}`}
            >
              <span aria-hidden="true" className="cursor-grab select-none text-muted">
                ⋮⋮
              </span>
              <span
                className={`min-w-0 flex-1 whitespace-pre-wrap text-sm ${mono ? 'font-mono' : ''}`}
                style={{ paddingLeft: `${p.indent * 1.25}rem` }}
              >
                {text.get(p.id)}
              </span>
              {!disabled && (
                <span className="flex shrink-0 gap-1">
                  {config.indent && (
                    <>
                      <button
                        type="button"
                        className={btn}
                        disabled={p.indent === 0}
                        onClick={() => indent(i, -1)}
                        aria-label={`Outdent line ${i + 1}`}
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        className={btn}
                        onClick={() => indent(i, 1)}
                        aria-label={`Indent line ${i + 1}`}
                      >
                        →
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className={btn}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={`Move line ${i + 1} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={btn}
                    disabled={i === state.answer.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={`Move line ${i + 1} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={`${btn} text-bad`}
                    onClick={() => remove(i)}
                    aria-label={`Remove line ${i + 1}`}
                  >
                    ✕
                  </button>
                </span>
              )}
            </li>
          ))}
        </ol>
        {config.indent && (
          <p className="mt-2 text-xs text-muted">
            Indentation matters: use ← and → to set each line's level.
          </p>
        )}
      </section>
    </div>
  );
}
