import { Link } from 'react-router';
import { allLessons, findLesson, useContentIndex } from '../../content/loader';
import type { ContentIndex } from '../../content/types';
import { useProgress } from '../../storage/progress';
import type { Progress } from '../../storage/schema';
import { ErrorState, Loading } from '../../components/ui';

/** The first playable lesson, in syllabus order, that isn't completed yet. */
function nextLesson(index: ContentIndex, progress: Progress) {
  for (const s of index.subjects)
    for (const l of allLessons(s))
      if (l.available && progress.lessons[l.id]?.status !== 'completed') return findLesson(index, l.id);
  return undefined;
}

/** `#/`: Today — what to do next (§10.1). Daily goal, streak and daily practice join in §14 Phase 4. */
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10" data-testid="today">
      <h1 className="text-3xl font-semibold tracking-tight">Today</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Learn by doing: predict, experiment, then solve linked problems. A few focused minutes a day add up.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {next ? (
          <Link
            to={`/l/${next.lesson.id}`}
            className="group rounded-xl border border-border bg-surface p-5 no-underline hover:border-accent"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              {resume ? 'Continue lesson' : 'Recommended next'}
            </div>
            <div className="mt-1 font-semibold text-text group-hover:text-accent">{next.lesson.title}</div>
            <div className="text-sm text-muted">
              {next.subject.title} · {next.unit.title}
            </div>
          </Link>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">
            New lessons are on their way. Browse the syllabus to see what's coming.
          </div>
        )}
        <Link
          to="/subjects"
          className="flex items-center justify-between rounded-xl border border-border bg-surface p-5 no-underline hover:border-accent"
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Browse</div>
            <div className="mt-1 font-semibold text-text">All subjects</div>
            <div className="text-sm text-muted">
              {index.subjects.length} subjects, each a path of units and lessons.
            </div>
          </div>
          <span aria-hidden="true" className="text-2xl text-accent">
            →
          </span>
        </Link>
      </div>
    </div>
  );
}
