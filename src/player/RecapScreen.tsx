import { useState } from 'react';
import { Link } from 'react-router';
import { Markdown } from '../components/Markdown';
import { Badge, Button, Stars } from '../components/ui';
import type { RecapScreen as Recap } from '../content/schema';
import { allLessons } from '../content/loader';
import { FEATURES } from '../config';
import { renderTemplate } from '../engine/template';
import { ExpertCompare } from '../widgets/explain/view';
import { conceptKey, entryMap, isStep, lessonResult } from './attempt';
import { usePlayer, withAttempt } from './context';

function scoreWord(s: number): string {
  if (s >= 0.8) return 'strong';
  if (s > 0) return 'with help';
  return 'missed';
}

/**
 * Recap (§8.1): takeaways, the self-explanation box (never graded) with an expert answer and a
 * checklist, the lesson summary, and Practise / Next lesson.
 */
export function RecapScreen({ screen }: { screen: Recap }) {
  const pl = usePlayer();
  const { lesson, attempt, progress, scope, index, lctx, readOnly } = pl;
  const key = `${screen.id}#explain`;
  const saved = attempt.answers[key];
  const [text, setText] = useState<string>((saved?.answer as string | undefined) ?? '');
  const [ticked, setTicked] = useState<boolean[]>(() => screen.explain?.checklist.map(() => false) ?? []);
  const compared = saved?.correct !== undefined;
  const result = lessonResult(lesson, attempt);
  const map = entryMap(lesson);

  const compare = () =>
    pl.update((p) => {
      const a = p.lessons[lesson.id]?.attempt;
      return a
        ? withAttempt(p, lesson.id, {
            ...a,
            answers: { ...a.answers, [key]: { answer: text, hintsUsed: 0, attempts: 1, correct: true } },
          })
        : p;
    });

  const steps = attempt.sequence.filter((id) => isStep(map.get(id)));
  const misconceptions = [
    ...new Set(Object.values(attempt.answers).flatMap((r) => (r.misconception ? [r.misconception] : []))),
  ];
  const subject = index.subjects.find((s) => s.id === lctx.subjectId);
  const lessons = subject ? allLessons(subject) : [];
  const nextId = screen.next ?? lessons[lessons.findIndex((l) => l.id === lesson.id) + 1]?.id;
  const next = lessons.find((l) => l.id === nextId);

  return (
    <article className="space-y-5" data-testid="screen-recap">
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Key takeaways</h2>
        <ul className="space-y-2">
          {screen.takeaways.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden="true" className="text-accent">
                ●
              </span>
              <Markdown inline>{renderTemplate(t, scope)}</Markdown>
            </li>
          ))}
        </ul>
      </section>

      {screen.explain && (
        <section
          className="rounded-2xl border border-border bg-surface p-5 sm:p-6"
          data-testid="self-explain"
        >
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Explain it yourself
          </h2>
          <Markdown>{renderTemplate(screen.explain.prompt, scope)}</Markdown>
          <label htmlFor="recap-explain" className="sr-only">
            Your explanation
          </label>
          <textarea
            id="recap-explain"
            rows={4}
            className="mt-2 w-full rounded-lg border-2 border-border bg-bg p-3 focus:border-accent"
            value={text}
            disabled={compared || readOnly}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write it in your own words…"
          />
          {!compared && !readOnly && (
            <Button variant="secondary" className="mt-2" onClick={compare} data-testid="compare-expert">
              Compare with an expert answer
            </Button>
          )}
          {compared && (
            <ExpertCompare
              expert={screen.explain.expert}
              checklist={screen.explain.checklist}
              scope={scope}
              ticked={ticked}
              setTicked={setTicked}
            />
          )}
        </section>
      )}

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6" data-testid="summary">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Lesson summary</h2>
          <Stars count={result.stars} size="md" />
          {result.completed ? (
            <Badge tone="ok">Completed</Badge>
          ) : (
            <Badge tone="warn">Not complete yet</Badge>
          )}
        </div>
        {!result.completed && (
          <p className="mt-1 text-sm text-muted">
            To complete the lesson, answer every core question and attempt both challenges.
          </p>
        )}
        <h3 className="mt-4 text-sm font-semibold">Score per step</h3>
        <ol className="mt-1 grid gap-1 text-sm sm:grid-cols-2" data-testid="step-scores">
          {steps.map((id) => {
            const s = attempt.answers[id]?.score;
            return (
              <li key={id} className="flex justify-between gap-2 rounded bg-bg px-2 py-1">
                <span>{pl.stepLabel(id)}</span>
                <span className="font-mono">
                  {s === undefined
                    ? attempt.skipped.includes(id)
                      ? 'skipped'
                      : '—'
                    : `${s.toFixed(1)} · ${scoreWord(s)}`}
                </span>
              </li>
            );
          })}
          {lesson.screens
            .filter((s) => s.type === 'challenge')
            .map((s) => {
              const c = attempt.challenges[s.id];
              return (
                <li key={s.id} className="flex justify-between gap-2 rounded bg-bg px-2 py-1">
                  <span>Challenge: {s.type === 'challenge' ? s.title : ''}</span>
                  <span className="font-mono">
                    {c?.score === undefined ? '—' : c.usedSolution ? 'solution shown' : c.score.toFixed(1)}
                  </span>
                </li>
              );
            })}
        </ol>
        <h3 className="mt-4 text-sm font-semibold">Ratings</h3>
        <ul className="mt-1 space-y-1 text-sm" data-testid="rating-changes">
          {lesson.concepts.map((c) => {
            const r = progress.ratings.concept[conceptKey(lctx, c)];
            const before = r?.ratingAtLessonStart?.[lesson.id];
            const now = r?.r;
            return (
              <li key={c}>
                {pl.conceptTitle(c)}:{' '}
                {now === undefined
                  ? 'not practised yet'
                  : before === undefined
                    ? Math.round(now)
                    : `${Math.round(before)} → ${Math.round(now)} (${now >= before ? '+' : ''}${Math.round(now - before)})`}
              </li>
            );
          })}
        </ul>
        {misconceptions.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-semibold">Misconceptions you met</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {misconceptions.map((m) => (
                <li key={m}>{pl.misconceptionShort(m) ?? m}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        {FEATURES.practice ? (
          <Link
            to={`/practice/lesson/${lesson.id}`}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent"
          >
            Practise this lesson
          </Link>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted">
            Practise this lesson <Badge>Coming soon</Badge>
          </span>
        )}
        {next ? (
          next.available ? (
            <Link
              to={`/l/${next.id}`}
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-2"
              data-testid="next-lesson"
            >
              Next lesson: {next.title}
            </Link>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted">
              Next lesson: {next.title} <Badge>Coming soon</Badge>
            </span>
          )
        ) : null}
        <Link to={`/s/${lctx.subjectId}`} className="text-sm text-accent underline">
          Back to the path map
        </Link>
      </div>
    </article>
  );
}
