import { useId, useState } from 'react';
import type { WidgetViewProps } from '../types';
import { Tx } from '../ui';
import type { ExplainAnswer, ExplainQuestion } from './model';

/** Self-explanation (§2.8): free text, never graded; afterwards compare with an expert answer and a checklist. */
export function ExplainView({
  question: q,
  ctx,
  disabled,
  answer,
  onChange,
  reveal,
}: WidgetViewProps<ExplainQuestion, ExplainAnswer>) {
  const id = useId();
  const [ticked, setTicked] = useState<boolean[]>(() => q.checklist.map(() => false));
  return (
    <div data-testid="explain">
      <label htmlFor={id} className="sr-only">
        Your explanation
      </label>
      <textarea
        id={id}
        rows={4}
        value={reveal ? (reveal.learner ?? '') : (answer ?? '')}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.trim() ? e.target.value : null)}
        className="w-full rounded-lg border-2 border-border bg-bg p-3 focus:border-accent"
        placeholder="Write it in your own words…"
        data-testid="explain-input"
      />
      {reveal && (
        <ExpertCompare
          expert={q.expert}
          checklist={q.checklist}
          scope={ctx.scope}
          ticked={ticked}
          setTicked={setTicked}
        />
      )}
    </div>
  );
}

/** The expert answer and a self-check list (used by `explain` and the recap screen). */
export function ExpertCompare({
  expert,
  checklist,
  scope,
  ticked,
  setTicked,
}: {
  expert: string;
  checklist: string[];
  scope: Record<string, unknown>;
  ticked: boolean[];
  setTicked(t: boolean[]): void;
}) {
  return (
    <div className="mt-3 space-y-3" data-testid="expert-compare">
      <section className="rounded-xl border border-border bg-bg p-4">
        <h4 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">An expert answer</h4>
        <Tx s={expert} scope={scope} inline={false} />
      </section>
      <fieldset>
        <legend className="text-sm font-semibold">Check your own answer</legend>
        <ul className="mt-1 space-y-1">
          {checklist.map((c, i) => (
            <li key={i}>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[var(--c-accent)]"
                  checked={ticked[i] ?? false}
                  onChange={() => setTicked(ticked.map((t, j) => (j === i ? !t : t)))}
                />
                <Tx s={c} scope={scope} />
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-muted">
          {ticked.filter(Boolean).length} of {checklist.length} ticked. This is for you — it isn’t scored.
        </p>
      </fieldset>
    </div>
  );
}
