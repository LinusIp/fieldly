import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Markdown } from '../components/Markdown';
import { Badge, Button, buttonClass, CheckIcon, CrossIcon, Stars } from '../components/ui';
import { FEATURES } from '../config';
import type { RecapScreen as Recap } from '../content/schema';
import { allLessons } from '../content/loader';
import { renderTemplate } from '../engine/template';
import { ExpertCompare } from '../widgets/explain/view';
import { conceptKey, entryMap, isStep, lessonResult } from './attempt';
import { usePlayer, withAttempt } from './context';

function scoreWord(s: number): string {
  if (s >= 0.8) return 'Strong';
  if (s > 0) return 'Right, with help';
  return 'Missed';
}

/** Every misconception met in the attempt: each question's matched ones and challenge feedback (§8.1). */
export function misconceptionsMet(
  answers: Record<string, { seen?: string[]; misconception?: string }>,
  challenges: Record<string, { seen?: string[] }>,
): string[] {
  const all = [
    ...Object.values(answers).flatMap((r) => [
      ...(r.seen ?? []),
      ...(r.misconception ? [r.misconception] : []),
    ]),
    ...Object.values(challenges).flatMap((c) => c.seen ?? []),
  ];
  return [...new Set(all)];
}

function Card({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border-2 border-outline bg-surface p-5 shadow-s3 md:p-7"
      data-testid={testId}
    >
      <h2 className="text-h2">{title}</h2>
      {children}
    </section>
  );
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
  const met = misconceptionsMet(attempt.answers, attempt.challenges);
  const subject = index.subjects.find((s) => s.id === lctx.subjectId);
  const lessons = subject ? allLessons(subject) : [];
  const nextId = screen.next ?? lessons[lessons.findIndex((l) => l.id === lesson.id) + 1]?.id;
  const next = lessons.find((l) => l.id === nextId);

  return (
    <article className="flex flex-col gap-6" data-testid="screen-recap">
      <section
        className="flex flex-col gap-3 rounded-xl border-2 border-outline bg-primary p-5 text-on-primary shadow-s3 md:p-7"
        data-testid="summary"
      >
        <span className="text-small font-semibold">{lesson.title}</span>
        <h2 className="text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em] md:text-display">
          {result.completed ? 'Lesson complete!' : 'Nearly there'}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-lg border-2 border-outline bg-surface px-3 py-2">
            <Stars count={result.stars} size="md" />
          </span>
          <span className="font-extrabold" data-testid="stars-text">
            {result.stars} of 3 stars
          </span>
          {result.completed ? (
            <Badge tone="ok">Completed</Badge>
          ) : (
            <Badge tone="warn">Not complete yet</Badge>
          )}
        </div>
        <p className="font-semibold">
          {result.completed
            ? `Mean score on the core questions: ${result.meanCore.toFixed(2)}. ${
                result.stars === 3
                  ? 'Three stars: 0.9 or more, and both challenges solved without the last hint.'
                  : result.stars === 2
                    ? 'Two stars: 0.7 or more. Three need 0.9 and both challenges solved without the last hint.'
                    : 'One star. Two stars need a mean of 0.7 on the core questions.'
              }`
            : 'Answer every core question and try both challenges to complete the lesson.'}
        </p>
      </section>

      <Card title="Key takeaways">
        <ul className="flex flex-col gap-2.5">
          {screen.takeaways.map((t, i) => (
            <li key={i} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-outline bg-volt"
              />
              <Markdown inline>{renderTemplate(t, scope)}</Markdown>
            </li>
          ))}
        </ul>
      </Card>

      {screen.explain && (
        <Card title="Explain it yourself" testId="self-explain">
          <Markdown>{renderTemplate(screen.explain.prompt, scope)}</Markdown>
          <label htmlFor="recap-explain" className="sr-only">
            Your explanation
          </label>
          <textarea
            id="recap-explain"
            rows={4}
            className="w-full rounded-lg border-[3px] border-outline bg-surface p-3 focus:border-primary"
            value={text}
            disabled={compared || readOnly}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write it in your own words…"
          />
          {!compared && !readOnly && (
            <Button variant="secondary" className="self-start" onClick={compare} data-testid="compare-expert">
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
        </Card>
      )}

      <Card title="How each step went">
        <ol className="grid gap-2 sm:grid-cols-2" data-testid="step-scores">
          {steps.map((id) => {
            const s = attempt.answers[id]?.score;
            const skipped = attempt.skipped.includes(id);
            return (
              <li
                key={id}
                className="flex items-center justify-between gap-2 rounded-md border-2 border-outline bg-surface-sunk px-3 py-2"
              >
                <span className="font-extrabold">{pl.stepLabel(id)}</span>
                <span className="tabular flex items-center gap-2 font-semibold">
                  {s === undefined
                    ? skipped
                      ? 'Skipped'
                      : 'Not answered'
                    : `${scoreWord(s)}, ${s.toFixed(1)}`}
                  {s !== undefined && (
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-[8px] border-2 border-outline text-on-fill ${s > 0 ? 'bg-correct' : 'bg-wrong'}`}
                      aria-hidden="true"
                    >
                      {s > 0 ? <CheckIcon className="h-3.5 w-3.5" /> : <CrossIcon className="h-3.5 w-3.5" />}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
          {lesson.screens
            .filter((s) => s.type === 'challenge')
            .map((s) => {
              const c = attempt.challenges[s.id];
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-md border-2 border-outline bg-surface-sunk px-3 py-2"
                >
                  <span className="font-extrabold">{s.type === 'challenge' ? s.title : ''}</span>
                  <span className="tabular font-semibold">
                    {!c
                      ? 'Not tried'
                      : c.skipped
                        ? 'Skipped'
                        : c.usedSolution
                          ? 'Solution shown, 0'
                          : c.score === undefined
                            ? 'Not solved yet'
                            : `Solved, ${c.score.toFixed(1)}`}
                  </span>
                </li>
              );
            })}
        </ol>
      </Card>

      <Card title="Your ratings">
        <ul className="flex flex-col gap-2" data-testid="rating-changes">
          {lesson.concepts.map((c) => {
            const r = progress.ratings.concept[conceptKey(lctx, c)];
            const before = r?.ratingAtLessonStart?.[lesson.id];
            const now = r?.r;
            return (
              <li key={c} className="tabular flex flex-wrap justify-between gap-2 font-semibold">
                <span>{pl.conceptTitle(c)}</span>
                <span>
                  {now === undefined
                    ? 'Not practised yet'
                    : before === undefined
                      ? Math.round(now)
                      : `${Math.round(before)} → ${Math.round(now)} (${now >= before ? '+' : ''}${Math.round(now - before)})`}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Misconceptions you met" testId="misconceptions-met">
        {met.length === 0 ? (
          <p className="font-semibold text-ink-2">None this time: no answer matched a common mistake.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {met.map((m) => (
              <li
                key={m}
                className="rounded-md border-2 border-outline bg-wrong-tint px-3 py-2 font-semibold"
              >
                {pl.misconceptionShort(m) ?? m}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        {FEATURES.practice ? (
          <Link to={`/practice/lesson/${lesson.id}`} className={buttonClass('primary', 'min-h-[56px] px-6')}>
            Start practice
          </Link>
        ) : (
          <span className="inline-flex min-h-[52px] items-center gap-2 rounded-md border-2 border-dashed border-ink-3 px-4 font-extrabold text-ink-2">
            Practice sets are coming soon
          </span>
        )}
        {next &&
          (next.available ? (
            <Link
              to={`/l/${next.id}`}
              className={buttonClass(FEATURES.practice ? 'secondary' : 'primary', 'min-h-[56px] px-6')}
              data-testid="next-lesson"
            >
              Next lesson: {next.title}
            </Link>
          ) : (
            <span className="inline-flex min-h-[52px] items-center gap-2 rounded-md border-2 border-dashed border-ink-3 px-4 font-extrabold text-ink-2">
              Next lesson, {next.title}, is coming soon
            </span>
          ))}
        <Link to={`/s/${lctx.subjectId}`} className={buttonClass('secondary', 'min-h-[52px]')}>
          Back to the path map
        </Link>
      </div>
    </article>
  );
}
