import { useMemo } from 'react';
import { Markdown } from '../components/Markdown';
import { Button } from '../components/ui';
import type { WorkedScreen as Worked } from '../content/schema';
import { renderTemplate } from '../engine/template';
import { BlankText } from '../widgets/blanks/BlankText';
import { gradeBlank, segmentsOf, type BlankSegment } from '../widgets/blanks/model';
import { conceptRating } from './attempt';
import { usePlayer } from './context';

/** Stored in `attempt.explore[screenId]`: steps shown, typed blank values, tries per blank, faded count. */
export interface WorkedState {
  values: string[][];
  tries: number[][];
  /** Checks pressed per step (marks show after the first). */
  checks: number[];
  /** How many `[[?…]]` spans are blanks, fixed when the screen is first shown. */
  faded: number;
}

/** `fade: adaptive`: one fadeable span becomes a blank for every 100 rating points above 1000 (§8.1). */
export function fadedCount(fade: Worked['fade'], rating: number): number {
  return fade === 'adaptive' ? Math.max(0, Math.floor((rating - 1000) / 100)) : 0;
}

/** Which blank segments of each step are inputs: plain `[[…]]` always; the last `faded` `[[?…]]` spans. */
export function blankMask(steps: BlankSegment[][], faded: number): boolean[][] {
  const fadeable: [number, number][] = [];
  steps.forEach((segs, si) => {
    let k = -1;
    segs.forEach((s) => {
      if (!s.blank) return;
      k++;
      if (s.fadeable) fadeable.push([si, k]);
    });
  });
  const on = new Set(fadeable.slice(Math.max(0, fadeable.length - faded)).map(([a, b]) => `${a}:${b}`));
  return steps.map((segs, si) => {
    let k = -1;
    return segs.filter((s) => s.blank).map((s) => (k++, !s.fadeable || on.has(`${si}:${k}`)));
  });
}

/**
 * Worked example (§8.1): steps revealed one at a time. Blanks must be filled (2 tries each, then
 * revealed) before the next step appears. Never scored.
 */
export function WorkedScreen({ screen }: { screen: Worked }) {
  const pl = usePlayer();
  const { attempt, scope, readOnly, progress, lctx } = pl;
  const steps = useMemo(() => screen.steps.map((s) => segmentsOf(s.text)), [screen.steps]);
  const saved = attempt.explore[screen.id];
  const shown = saved?.taskIndex ?? 1;
  const ws: WorkedState = (saved?.state as WorkedState | undefined) ?? {
    values: steps.map(() => []),
    tries: steps.map(() => []),
    checks: steps.map(() => 0),
    faded: fadedCount(screen.fade, conceptRating(progress, lctx, screen.concept)),
  };
  const mask = useMemo(() => blankMask(steps, ws.faded), [steps, ws.faded]);
  const blanksOfStep = (si: number) =>
    steps[si]
      .filter((s) => s.blank)
      .filter((_, k) => mask[si][k])
      .map((s) => s.blank!);

  const save = (patch: { taskIndex?: number; state?: WorkedState }) =>
    pl.setAttempt((a) => ({
      ...a,
      explore: {
        ...a.explore,
        [screen.id]: { ...(a.explore[screen.id] ?? { taskIndex: shown, state: ws }), ...patch },
      },
    }));

  const stepResolved = (si: number) => {
    const bs = blanksOfStep(si);
    return bs.every(
      (b, i) => gradeBlank(b, ws.values[si]?.[i] ?? '', scope) || (ws.tries[si]?.[i] ?? 0) >= 2,
    );
  };
  const check = (si: number) => {
    const bs = blanksOfStep(si);
    const tries = [...(ws.tries[si] ?? [])];
    bs.forEach((b, i) => {
      if (!gradeBlank(b, ws.values[si]?.[i] ?? '', scope)) tries[i] = (tries[i] ?? 0) + 1;
    });
    const checks = steps.map((_, j) => (ws.checks?.[j] ?? 0) + (j === si ? 1 : 0));
    const next = { ...ws, checks, tries: ws.tries.map((t, j) => (j === si ? tries : t)) };
    save({ state: next });
  };
  const allShown = shown >= steps.length;
  const lastResolved = stepResolved(Math.min(shown, steps.length) - 1);

  return (
    <article className="space-y-4" data-testid="screen-worked">
      <div className="rounded-2xl border-2 border-outline bg-surface p-5 sm:p-6">
        <h2 className="mb-2 text-h3 text-ink">Worked example</h2>
        <Markdown>{renderTemplate(screen.problem, scope)}</Markdown>
      </div>
      <ol className="space-y-3">
        {steps.slice(0, shown).map((segs, si) => {
          const bs = blanksOfStep(si);
          const resolved = stepResolved(si);
          const parts = bs.map((b, i) =>
            (ws.checks?.[si] ?? 0) > 0 ? gradeBlank(b, ws.values[si]?.[i] ?? '', scope) : undefined,
          );
          return (
            <li key={si} className="rounded-xl border-2 border-outline bg-surface p-4" data-step={si}>
              <span className="text-h3 text-ink">Step {si + 1}</span>
              <div className="mt-1">
                <BlankText
                  segments={segs}
                  scope={scope}
                  seed={attempt.seed}
                  values={ws.values[si] ?? []}
                  disabled={readOnly || resolved}
                  parts={parts}
                  revealed={bs.map((_, i) => (ws.tries[si]?.[i] ?? 0) >= 2)}
                  asBlank={(k) => mask[si][k]}
                  onChange={(i, v) => {
                    const vals = [...(ws.values[si] ?? [])];
                    vals[i] = v;
                    save({ state: { ...ws, values: ws.values.map((x, j) => (j === si ? vals : x)) } });
                  }}
                />
              </div>
              {bs.length > 0 && !resolved && !readOnly && (
                <Button
                  variant="secondary"
                  className="mt-2"
                  onClick={() => check(si)}
                  data-testid="check-step"
                >
                  Check this step
                </Button>
              )}
            </li>
          );
        })}
      </ol>
      {!readOnly && !allShown && lastResolved && (
        <Button onClick={() => save({ taskIndex: shown + 1 })} data-testid="next-step">
          Next step
        </Button>
      )}
      {!readOnly && allShown && lastResolved && (
        <Button onClick={pl.advance} data-testid="continue">
          Continue
        </Button>
      )}
    </article>
  );
}
