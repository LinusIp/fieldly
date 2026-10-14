import { Link } from 'react-router';
import { allLessons, useContentIndex } from '../../content/loader';
import { useProgress } from '../../storage/progress';
import { ErrorState, Loading, ProgressRing } from '../../components/ui';

/** `#/subjects`: every subject with a progress ring (§10.1). */
export function SubjectsPage() {
  const { data: index, error } = useContentIndex();
  const progress = useProgress((s) => s.progress);
  if (error) return <ErrorState error={error} />;
  if (!index) return <Loading what="Loading subjects" />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Subjects</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Hands-on lessons: play with a model, spot the pattern, name it, then use it in linked problems and
        challenges.
      </p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="subject-list">
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
                    <h2 className="mt-1 font-semibold leading-snug text-text">{s.title}</h2>
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
