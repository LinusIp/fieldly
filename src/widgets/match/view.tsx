import { useMemo } from 'react';
import type { Scope } from '../../engine/expr';
import { hashString, seededOrder } from '../common';
import type { WidgetViewProps } from '../types';
import { Mark, markClass, MiniPlot, Tx } from '../ui';
import type { MatchAnswer, MatchQuestion, MatchSide } from './model';

function Side({ s, scope }: { s: MatchSide; scope: Scope }) {
  if (typeof s === 'string') return <Tx s={s} scope={scope} />;
  return <MiniPlot plot={s.plot} x={s.x} scope={scope} label={s.label} />;
}

const LETTERS = 'ABCDEFGHI';

/**
 * Link each left item to a right item (§9.2). Right items carry letters; each left item has a
 * letter menu, which works the same with a mouse, touch or keyboard. Per-pair marking.
 */
export function MatchView({
  question: q,
  ctx,
  disabled,
  answer,
  onChange,
  marks,
  reveal,
}: WidgetViewProps<MatchQuestion, MatchAnswer>) {
  const rights = useMemo(() => [...q.pairs.map((p) => p.right), ...(q.extraRights ?? [])], [q]);
  const order = useMemo(
    () => seededOrder(rights.length, ctx.seed ^ hashString(q.id)),
    [rights, ctx.seed, q.id],
  );
  const letterOf = new Map(order.map((ri, pos) => [ri, LETTERS[pos]]));
  const current: MatchAnswer = reveal ? q.pairs.map((_, i) => i) : (answer ?? q.pairs.map(() => null));
  const set = (i: number, ri: number | null) => {
    const next = [...current];
    next[i] = ri;
    onChange(next.some((x) => x !== null) ? next : null);
  };
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1fr]" data-testid="match">
      <ol className="grid gap-2">
        {q.pairs.map((p, i) => {
          let mark: boolean | undefined;
          if (reveal) mark = reveal.learner?.[i] === i;
          else if (marks && marks.answer[i] === current[i]) mark = marks.grade.parts?.[i];
          const chose = reveal?.learner?.[i];
          return (
            <li
              key={i}
              className={`flex flex-wrap items-center gap-3 rounded-xl border-2 px-3 py-2 ${markClass(mark === undefined ? 'none' : mark ? 'ok' : 'bad')}`}
            >
              <span className="min-w-0 flex-1">
                <Side s={p.left} scope={ctx.scope} />
              </span>
              <label className="flex items-center gap-1 text-sm">
                <span className="sr-only">Match for item {i + 1}</span>
                <span aria-hidden="true">↔</span>
                <select
                  className="min-h-[44px] rounded-lg border border-border bg-bg px-2 font-semibold"
                  value={current[i] ?? ''}
                  disabled={disabled || !!reveal}
                  onChange={(e) => set(i, e.target.value === '' ? null : Number(e.target.value))}
                  data-testid="match-select"
                >
                  <option value="">–</option>
                  {order.map((ri, pos) => (
                    <option key={ri} value={ri}>
                      {LETTERS[pos]}
                    </option>
                  ))}
                </select>
              </label>
              {mark !== undefined && (
                <Mark
                  ok={mark}
                  label={
                    mark
                      ? 'Matched'
                      : reveal
                        ? `You chose ${chose == null ? '–' : letterOf.get(chose)}`
                        : 'Wrong pair'
                  }
                />
              )}
            </li>
          );
        })}
      </ol>
      <ul className="grid gap-2" aria-label="Choices">
        {order.map((ri, pos) => (
          <li key={ri} className="flex items-center gap-3 rounded-xl border border-border bg-bg px-3 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-2 text-sm font-bold">
              {LETTERS[pos]}
            </span>
            <Side s={rights[ri]} scope={ctx.scope} />
          </li>
        ))}
      </ul>
    </div>
  );
}
