import { Link } from 'react-router';
import { Markdown } from '../components/Markdown';
import { Button, Stars } from '../components/ui';
import { findLesson } from '../content/loader';
import { computeStars } from '../engine/scoring';
import { renderTemplate } from '../engine/template';
import {
  coreSteps,
  currentQuestion,
  meanCoreScore,
  newAttempt,
  optionsFor,
  stepLabel,
  subjectOf,
} from './attempt';
import { usePlayer, withAttempt } from './context';

export function Summary() {
  const { lesson, attempt, progress, scope, index, misconceptions, conceptTitles, update } = usePlayer();
  const meanCore = meanCoreScore(lesson, attempt);
  const ch = attempt.challenge;
  const stars = computeStars({
    completed: true,
    meanCore,
    challengeSolved: !!ch?.solved && !ch.usedSolution,
    challengeUsedTier3: (ch?.hintsUsed ?? 0) >= 3,
  });

  // Misconceptions met in this attempt: wrong options chosen, plus challenge feedback.
  const met = new Map<string, number>();
  for (const id of attempt.sequence) {
    const ans = attempt.answers[id];
    if (!ans || ans.score === undefined) continue;
    const q = currentQuestion(lesson, attempt, id)!;
    const options = optionsFor(q, scope, attempt.seed);
    for (const i of ans.selected) {
      const o = options.find((x) => x.index === i);
      if (o && !o.correct && o.misconception) met.set(o.misconception, (met.get(o.misconception) ?? 0) + 1);
    }
  }
  const chMis = (ch?.state as { misconceptions?: string[] } | undefined)?.misconceptions ?? [];
  for (const m of chMis) met.set(m, (met.get(m) ?? 0) + 1);

  const concepts = Object.keys(attempt.ratingsBefore).filter((c) => progress.ratings.concept[c]);
  const next = lesson.summary.next ? findLesson(index, lesson.summary.next) : undefined;

  const retry = () =>
    update((p) => {
      const a = { ...newAttempt(lesson, p, new Date()), stage: 'practice' as const };
      return withAttempt(p, lesson.id, a);
    });

  return (
    <div className="max-w-[760px] space-y-6" data-testid="summary">
      <section className="rounded-2xl border border-border bg-surface p-6 text-center">
        <h2 className="text-2xl font-semibold">Lesson complete</h2>
        <div className="mt-3 flex justify-center" data-testid="summary-stars">
          <Stars count={stars} size="md" />
        </div>
        <p className="mt-2 text-muted">
          Practice score {Math.round(meanCore * 100)}%
          {ch &&
            (ch.solved && !ch.usedSolution
              ? ` · challenge solved (score ${ch.score ?? 0})`
              : ch.usedSolution
                ? ' · challenge solution shown'
                : ' · challenge attempted')}
        </p>
        <p className="mt-1 text-xs text-muted">
          ★ complete · ★★ practice score ≥ 70% · ★★★ ≥ 90% and the challenge solved without the last hint
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h3 className="font-semibold">Scores</h3>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1 font-medium">Step</th>
              <th className="py-1 font-medium">Version</th>
              <th className="py-1 text-right font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {attempt.sequence.map((id) => (
              <tr key={id} className="border-t border-border">
                <td className="py-1.5">{stepLabel(lesson, id)}</td>
                <td className="py-1.5 text-muted">{attempt.chosenVariants[id] ?? '—'}</td>
                <td className="py-1.5 text-right font-medium">
                  {attempt.skippedSteps.includes(id) ? 'skipped' : (attempt.answers[id]?.score ?? '—')}
                </td>
              </tr>
            ))}
            {ch && (
              <tr className="border-t border-border">
                <td className="py-1.5">Challenge</td>
                <td className="py-1.5 text-muted">{ch.variant}</td>
                <td className="py-1.5 text-right font-medium">{ch.score ?? 0}</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">
          Mean of the {coreSteps(lesson).length} core steps: {meanCore.toFixed(2)}
        </p>
      </section>

      {concepts.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h3 className="font-semibold">Ratings</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {concepts.map((c) => {
              const before = attempt.ratingsBefore[c];
              const after = progress.ratings.concept[c].r;
              const d = Math.round(after - before);
              return (
                <li key={c} className="flex justify-between gap-4">
                  <span>{conceptTitles.get(c) ?? c}</span>
                  <span className={d > 0 ? 'text-ok' : d < 0 ? 'text-bad' : 'text-muted'}>
                    {Math.round(before)} → {Math.round(after)} ({d >= 0 ? '+' : '−'}
                    {Math.abs(d)})
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-border bg-surface p-5">
        <h3 className="font-semibold">Misconceptions you met</h3>
        {met.size === 0 ? (
          <p className="mt-1 text-sm text-muted">None this time.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {[...met.keys()].map((m) => {
              const mc = misconceptions.get(m);
              return (
                <li key={m} className="rounded-lg bg-bg p-3 text-sm">
                  <div className="font-medium">
                    <Markdown inline>{mc ? renderTemplate(mc.short, scope) : m}</Markdown>
                  </div>
                  {mc && (
                    <div className="mt-1 text-muted">
                      <Markdown>{mc.explain}</Markdown>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h3 className="font-semibold">Key takeaways</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {lesson.summary.keyTakeaways.map((t, i) => (
            <li key={i}>
              <Markdown inline>{renderTemplate(t, scope)}</Markdown>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        {next && (
          <Link
            to={`/l/${next.lesson.id}`}
            className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent no-underline"
          >
            Next: {next.lesson.title}
            {!next.lesson.available && ' (coming soon)'}
          </Link>
        )}
        <Button variant="secondary" onClick={retry} data-testid="retry">
          Retry lesson
        </Button>
        <Link
          to={`/s/${subjectOf(lesson.id)}`}
          className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text no-underline hover:bg-surface-2"
        >
          Back to subject
        </Link>
      </div>
    </div>
  );
}
