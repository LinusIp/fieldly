import { Link } from 'react-router';
import { allLessons, findLesson, useContentIndex } from '../../content/loader';
import { dueCount } from '../../engine/review';
import { useProgress } from '../../storage/progress';
import { ErrorState, Loading, ProgressRing } from '../../components/ui';

export function HomePage() {
  const { data: index, error } = useContentIndex();
  const progress = useProgress((s) => s.progress);
  if (error) return <ErrorState error={error} />;
  if (!index) return <Loading what="Loading subjects" />;

  const due = dueCount(progress.review, new Date());
  const inProgress = Object.entries(progress.lessons)
    .filter(([, l]) => l.status === 'in-progress' && l.attempt)
    .sort((a, b) => (b[1].lastOpenedAt ?? '').localeCompare(a[1].lastOpenedAt ?? ''));
  const resume = inProgress.length ? findLesson(index, inProgress[0][0]) : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Learn by solving</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Short intro, a chain of linked problems with full explanations, then a hands-on challenge. The
        questions adapt to how you're doing.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {resume ? (
          <Link
            to={`/l/${resume.lesson.id}`}
            className="group rounded-xl border border-border bg-surface p-4 no-underline hover:border-accent"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              Continue where you left off
            </div>
            <div className="mt-1 font-semibold text-text group-hover:text-accent">{resume.lesson.title}</div>
            <div className="text-sm text-muted">
              {resume.subject.title} · {resume.unit.title}
            </div>
          </Link>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
            Pick a subject below to start. Your progress stays in this browser.
          </div>
        )}
        <Link
          to="/review"
          className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 no-underline hover:border-accent"
          aria-label={`Review, ${due} due`}
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Spaced review</div>
            <div className="mt-1 font-semibold text-text">Review ({due} due)</div>
            <div className="text-sm text-muted">Questions you missed come back with new numbers.</div>
          </div>
          <span aria-hidden="true" className="text-2xl text-accent">
            →
          </span>
        </Link>
      </div>

      <h2 className="mt-10 text-lg font-semibold">Subjects</h2>
      <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="subject-list">
        {index.subjects.map((s) => {
          const lessons = allLessons(s);
          const available = lessons.filter((l) => l.available).length;
          const completed = lessons.filter((l) => progress.lessons[l.id]?.status === 'completed').length;
          return (
            <li key={s.id}>
              <Link
                to={`/s/${s.id}`}
                className="flex h-full flex-col rounded-xl border border-border bg-surface p-5 no-underline transition-colors hover:border-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-accent">{s.short}</div>
                    <h3 className="mt-1 font-semibold leading-snug text-text">{s.title}</h3>
                  </div>
                  <ProgressRing
                    value={lessons.length ? completed / lessons.length : 0}
                    label={`${completed} of ${lessons.length} lessons completed`}
                  />
                </div>
                <p className="mt-2 flex-1 text-sm text-muted">{s.description}</p>
                <div className="mt-4 text-xs text-muted">
                  {s.units.length} units · {lessons.length} lessons ·{' '}
                  {available > 0 ? `${available} ready to play` : 'lessons coming soon'}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
