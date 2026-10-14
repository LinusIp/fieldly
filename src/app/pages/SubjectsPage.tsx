import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { ErrorState, Loading, ProgressRing } from '../../components/ui';
import { allLessons, useContentIndex } from '../../content/loader';
import { useProgress } from '../../storage/progress';

/** `#/subjects`: every subject with a progress ring (§10.1), on its subject-accent card (§10.4). */
export function SubjectsPage() {
  const { data: index, error } = useContentIndex();
  const progress = useProgress((s) => s.progress);
  if (error) return <ErrorState error={error} />;
  if (!index) return <Loading what="Loading subjects" />;

  return (
    <div className="mx-auto max-w-[1220px] px-[18px] py-6 md:px-6">
      <h1 className="text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em] md:text-display">Learn</h1>
      <p className="mt-2 max-w-[640px] text-ink-2">
        Hands-on lessons: play with a model, spot the pattern, name it, then use it in linked questions and
        challenges.
      </p>
      <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="subject-list">
        {index.subjects.map((s) => {
          const lessons = allLessons(s);
          const available = lessons.filter((l) => l.available).length;
          const completed = lessons.filter((l) => progress.lessons[l.id]?.status === 'completed').length;
          return (
            <li key={s.id}>
              <Link
                to={`/s/${s.id}`}
                className="press press-s2 flex h-full flex-col gap-3 rounded-xl bg-[var(--accent)] p-5 text-on-fill no-underline"
                style={{ '--accent': `var(--color-${s.id}, var(--volt))` } as CSSProperties}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-small font-extrabold">{s.short}</span>
                    <h2 className="text-h2">{s.title}</h2>
                  </div>
                  <span className="rounded-full border-2 border-outline bg-surface p-1 text-ink">
                    <ProgressRing
                      size={56}
                      stroke={8}
                      value={lessons.length ? completed / lessons.length : 0}
                      label={`${completed} of ${lessons.length} lessons completed`}
                      center={<span className="text-[13px]">{completed}</span>}
                    />
                  </span>
                </div>
                <p className="flex-1 font-semibold">{s.description}</p>
                <p className="text-small font-bold">
                  {s.units.length} units, {lessons.length} lessons.{' '}
                  {available > 0 ? `${available} ready to play.` : 'Lessons coming soon.'}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
