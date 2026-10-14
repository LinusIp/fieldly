import { Link } from 'react-router';
import {
  Badge,
  buttonClass,
  ChartIcon,
  Chip,
  ErrorState,
  Loading,
  ProgressBattery,
  ProgressRing,
  PuzzleIcon,
  StreakPill,
} from '../../components/ui';
import { FEATURES } from '../../config';
import { allLessons, findLesson, useContentIndex } from '../../content/loader';
import type { ContentIndex } from '../../content/types';
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

/** "series-resistance" → "Series resistance". */
function titleOf(conceptKey: string): string {
  const slug = conceptKey.split('/').pop() ?? conceptKey;
  const t = slug.replace(/-/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** `#/`: Today (§10.1): daily goal, continue lesson, daily practice and puzzle, fading concepts. */
export function TodayPage() {
  const { data: index, error } = useContentIndex();
  const progress = useProgress((s) => s.progress);
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
  const now = new Date();
  const fading = Object.entries(progress.memory)
    .filter(([, m]) => isDue(m, now))
    .map(([k]) => k);
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
          <div className="flex flex-wrap gap-2">
            {fading.map((k) => (
              <Chip key={k}>{titleOf(k)}</Chip>
            ))}
          </div>
        )}
      </section>

      <Link to="/subjects" className={buttonClass('secondary', 'self-start')}>
        Browse all {index.subjects.length} subjects
      </Link>
    </div>
  );
}
