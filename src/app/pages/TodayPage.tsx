import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  Badge,
  buttonClass,
  ChartIcon,
  ErrorState,
  Loading,
  ProgressBattery,
  ProgressRing,
  PuzzleIcon,
  StreakPill,
} from '../../components/ui';
import { FEATURES } from '../../config';
import { allLessons, findLesson, loadSubject, useContentIndex } from '../../content/loader';
import { nsId, type ContentIndex } from '../../content/types';
import { isDue } from '../../engine/memory';
import { streakNow, xpToday } from '../../engine/motivation';
import { useProgress } from '../../storage/progress';
import type { Progress } from '../../storage/schema';

/** The first playable lesson, in syllabus order, that isn't completed yet. */
function nextLesson(index: ContentIndex, progress: Progress) {
  for (const s of index.subjects)
    for (const l of allLessons(s))
      if (l.available && progress.lessons[l.id]?.status !== 'completed') return findLesson(index, l.id);
  return undefined;
}

/** Concept titles from the subjects' concepts.yaml, keyed "<subject>/<slug>" (loaded on demand). */
function useConceptTitles(keys: string[]): Map<string, string> {
  const subjects = [...new Set(keys.map((k) => k.split('/')[0]))].sort().join(',');
  const [titles, setTitles] = useState(() => new Map<string, string>());
  useEffect(() => {
    if (!subjects) return;
    let alive = true;
    Promise.all(subjects.split(',').map((id) => loadSubject(id).catch(() => null))).then((list) => {
      if (!alive) return;
      const m = new Map<string, string>();
      for (const sc of list) for (const c of sc?.concepts ?? []) if (sc) m.set(nsId(sc.id, c.id), c.title);
      setTitles(m);
    });
    return () => {
      alive = false;
    };
  }, [subjects]);
  return titles;
}

/** The first playable lesson that teaches a concept, to review it from. */
function lessonFor(index: ContentIndex, key: string): string | undefined {
  const [sid, slug] = key.split('/');
  const subject = index.subjects.find((s) => s.id === sid);
  return subject ? allLessons(subject).find((l) => l.available && l.concepts.includes(slug))?.id : undefined;
}

function ConceptLinks({
  keys,
  titles,
  index,
}: {
  keys: string[];
  titles: Map<string, string>;
  index: ContentIndex;
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {keys.map((k) => {
        const lesson = lessonFor(index, k);
        const title = titles.get(k) ?? '…';
        const cls =
          'inline-flex min-h-[44px] items-center rounded-full border-2 border-outline bg-surface-tint px-4 text-small font-semibold text-ink no-underline';
        return (
          <li key={k}>
            {lesson ? (
              <Link
                to={`/l/${lesson}`}
                className={`${cls} hover:bg-surface`}
                aria-label={`${title}: open the lesson`}
              >
                {title}
              </Link>
            ) : (
              <span className={cls}>{title}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** `#/`: Today (§10.1): daily goal, continue lesson, daily practice and puzzle, fading concepts. */
export function TodayPage() {
  const { data: index, error } = useContentIndex();
  const progress = useProgress((s) => s.progress);
  const now = new Date();
  // Two reasons a concept comes back (§3.3): its recall estimate has dropped below 0.8 ("fading"),
  // or a missed step that builds on it marked it due now ("due for review").
  const dueNow = Object.entries(progress.memory).filter(([, m]) => isDue(m, now));
  const markedDue = dueNow.filter(([, m]) => m.dueOverride).map(([k]) => k);
  const fading = dueNow.filter(([, m]) => !m.dueOverride).map(([k]) => k);
  const titles = useConceptTitles([...markedDue, ...fading]);
  if (error) return <ErrorState error={error} />;
  if (!index) return <Loading what="Loading" />;

  const inProgress = Object.entries(progress.lessons)
    .filter(([, l]) => l.status === 'in-progress' && l.attempt)
    .sort((a, b) => (b[1].lastOpenedAt ?? '').localeCompare(a[1].lastOpenedAt ?? ''));
  const resume = inProgress.length ? findLesson(index, inProgress[0][0]) : undefined;
  const next = resume ?? nextLesson(index, progress);
  const attempt = resume ? progress.lessons[resume.lesson.id]?.attempt : undefined;
  const goal = progress.settings.dailyGoal;
  const today = xpToday(progress);
  const left = Math.max(0, goal - today);
  const streak = streakNow(progress);
  const unitNumber = next ? next.subject.units.findIndex((u) => u.id === next.unit.id) + 1 : 0;

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-5 px-[18px] py-6 md:px-6" data-testid="today">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em] md:text-display">
          {now.toLocaleDateString(undefined, { weekday: 'long' })}
        </h1>
        <span className="md:hidden">
          <StreakPill days={streak.days} charges={streak.charges} />
        </span>
      </header>

      <section
        className="flex items-center gap-4 rounded-xl border-2 border-outline bg-surface p-4"
        aria-label="Daily goal"
      >
        <ProgressRing size={64} value={today / goal} label={`${today} of ${goal} XP today`} center={today} />
        <div className="flex flex-col">
          <span className="tabular text-h2">
            {today} / {goal} XP
          </span>
          <span className="text-small font-semibold text-ink-2">
            {left === 0
              ? 'Daily goal reached. Nice work.'
              : `${left} XP to go today. Graded questions and challenges earn XP.`}
          </span>
        </div>
      </section>

      {next ? (
        <section className="flex flex-col gap-3 rounded-xl border-2 border-outline bg-primary p-5 text-on-primary shadow-s2">
          <span className="text-small font-bold">
            {next.subject.short}, unit {unitNumber}
          </span>
          <h2 className="text-h2">{next.lesson.title}</h2>
          {attempt && (
            <ProgressBattery
              total={attempt.sequence.length}
              done={attempt.screenIndex}
              current={attempt.screenIndex}
              height={12}
              label={`Screen ${attempt.screenIndex + 1} of ${attempt.sequence.length}`}
            />
          )}
          <Link to={`/l/${next.lesson.id}`} className={buttonClass('accent', 'min-h-[56px] text-[19px]')}>
            {attempt ? `Continue at screen ${attempt.screenIndex + 1}` : 'Start lesson'}
          </Link>
        </section>
      ) : (
        <section className="rounded-xl border-2 border-dashed border-ink-3 p-5 font-semibold text-ink-2">
          You’ve finished every lesson that’s ready. New ones are on their way.
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <section className="flex flex-col gap-2 rounded-lg border-2 border-outline bg-correct-tint p-4">
          <ChartIcon />
          <h2 className="text-h3">Daily practice</h2>
          <p className="flex-1 text-small font-semibold text-ink-2">
            {FEATURES.practice ? `${fading.length} topics due` : 'Spaced practice of what you’ve learned.'}
          </p>
          {FEATURES.practice ? (
            <Link to="/practice/daily" className={buttonClass('secondary')}>
              Start
            </Link>
          ) : (
            <Badge tone="dashed">Coming soon</Badge>
          )}
        </section>
        <section className="flex flex-col gap-2 rounded-lg border-2 border-outline bg-volt-tint p-4">
          <PuzzleIcon />
          <h2 className="text-h3">Daily puzzle</h2>
          <p className="flex-1 text-small font-semibold text-ink-2">A fresh circuit puzzle every day.</p>
          {FEATURES.puzzles ? (
            <Link to="/puzzles" className={buttonClass('secondary')}>
              Play
            </Link>
          ) : (
            <Badge tone="dashed">Coming soon</Badge>
          )}
        </section>
      </div>

      <section
        className="flex flex-col gap-3 rounded-lg border-2 border-outline bg-surface p-4"
        aria-labelledby="fading-h"
      >
        <h2 id="fading-h" className="text-h3">
          Fading from memory
        </h2>
        {fading.length === 0 ? (
          <p className="text-small font-semibold text-ink-2">
            Nothing yet. Concepts you’ve practised show up here when they’re due for a refresh.
          </p>
        ) : (
          <ConceptLinks keys={fading} titles={titles} index={index} />
        )}
      </section>

      {markedDue.length > 0 && (
        <section
          className="flex flex-col gap-3 rounded-lg border-2 border-outline bg-surface p-4"
          aria-labelledby="due-h"
          data-testid="due-for-review"
        >
          <h2 id="due-h" className="text-h3">
            Due for review
          </h2>
          <p className="text-small font-semibold text-ink-2">
            A question that builds on these went wrong, so they’re worth a quick look before moving on.
          </p>
          <ConceptLinks keys={markedDue} titles={titles} index={index} />
        </section>
      )}

      <Link to="/subjects" className={buttonClass('secondary', 'self-start')}>
        Browse all {index.subjects.length} subjects
      </Link>
    </div>
  );
}
