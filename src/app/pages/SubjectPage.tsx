import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { allLessons, findLesson, useContentIndex } from '../../content/loader';
import type { LessonMeta, UnitMeta } from '../../content/types';
import { useProgress } from '../../storage/progress';
import type { Progress } from '../../storage/schema';
import { Badge, ErrorState, Loading, Stars } from '../../components/ui';
import { NotFoundPage } from './NotFoundPage';

function unitDone(unit: UnitMeta, progress: Progress): number {
  return unit.lessons.filter((l) => progress.lessons[l.id]?.status === 'completed').length;
}

export function SubjectPage() {
  const { subjectId } = useParams();
  const { data: index, error } = useContentIndex();
  const progress = useProgress((s) => s.progress);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (error) return <ErrorState error={error} />;
  if (!index) return <Loading />;
  const subject = index.subjects.find((s) => s.id === subjectId);
  if (!subject) return <NotFoundPage />;

  // Open by default: the first unit that still has something playable to do, else the first unit.
  const defaultOpen =
    subject.units.find((u) =>
      u.lessons.some((l) => l.available && progress.lessons[l.id]?.status !== 'completed'),
    )?.id ?? subject.units[0].id;
  const isOpen = (id: string) => open[id] ?? id === defaultOpen;

  const lessons = allLessons(subject);
  const completed = lessons.filter((l) => progress.lessons[l.id]?.status === 'completed').length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link to="/" className="hover:text-accent">
          Subjects
        </Link>{' '}
        / <span aria-current="page">{subject.short}</span>
      </nav>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{subject.title}</h1>
      <p className="mt-2 text-muted">{subject.description}</p>
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="inline text-muted">Prerequisites: </dt>
          <dd className="inline">
            {subject.prerequisites.length === 0 && !subject.background && 'none'}
            {subject.prerequisites.map((p, i) => {
              const ps = index.subjects.find((s) => s.id === p);
              return (
                <span key={p}>
                  {i > 0 && ', '}
                  <Link to={`/s/${p}`} className="text-accent underline">
                    {ps?.title ?? p}
                  </Link>
                </span>
              );
            })}
            {subject.background && (
              <span>
                {subject.prerequisites.length > 0 && ' · '}
                {subject.background}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="inline text-muted">Progress: </dt>
          <dd className="inline">
            {completed} of {lessons.length} lessons completed
          </dd>
        </div>
      </dl>

      <div className="mt-8 space-y-3">
        {subject.units.map((unit, ui) => {
          const expanded = isOpen(unit.id);
          const panelId = `unit-panel-${unit.id}`;
          return (
            <section key={unit.id} className="rounded-xl border border-border bg-surface">
              <h2>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => setOpen((o) => ({ ...o, [unit.id]: !expanded }))}
                  className="flex w-full items-center gap-4 rounded-xl px-5 py-4 text-left hover:bg-surface-2"
                >
                  <span className="text-sm font-semibold text-muted">Unit {ui + 1}</span>
                  <span className="flex-1 font-semibold">{unit.title}</span>
                  <span className="hidden text-xs text-muted sm:inline">Level {unit.baseDifficulty}</span>
                  <span className="text-xs text-muted">
                    {unitDone(unit, progress)}/{unit.lessons.length}
                  </span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className={`h-4 w-4 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
                  >
                    <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </button>
              </h2>
              {expanded && (
                <ol id={panelId} className="border-t border-border">
                  {unit.lessons.map((l, li) => (
                    <LessonRow key={l.id} lesson={l} number={li + 1} progress={progress} index={index} />
                  ))}
                </ol>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function LessonRow({
  lesson,
  number,
  progress,
  index,
}: {
  lesson: LessonMeta;
  number: number;
  progress: Progress;
  index: NonNullable<ReturnType<typeof useContentIndex>['data']>;
}) {
  const lp = progress.lessons[lesson.id];
  const missing = lesson.prerequisites.filter((p) => progress.lessons[p]?.status !== 'completed');
  const status = lp?.status ?? 'not-started';

  const body = (
    <div className="flex items-start gap-4">
      <span className="mt-0.5 w-6 shrink-0 text-right text-sm text-muted">{number}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-medium ${lesson.available ? 'text-text' : 'text-muted'}`}>
            {lesson.title}
          </span>
          {!lesson.available && <Badge>Coming soon</Badge>}
          {lesson.available && status === 'in-progress' && <Badge tone="accent">In progress</Badge>}
        </div>
        {lesson.available && missing.length > 0 && status !== 'completed' && (
          <p className="mt-1 text-xs text-warn">
            Recommended first:{' '}
            {missing.map((p, i) => {
              const loc = findLesson(index, p);
              return (
                <span key={p}>
                  {i > 0 && ', '}
                  <Link to={`/l/${p}`} className="underline" onClick={(e) => e.stopPropagation()}>
                    {loc?.lesson.title ?? p}
                  </Link>
                </span>
              );
            })}
          </p>
        )}
      </div>
      {lesson.available && (
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Stars count={lp?.stars ?? 0} />
          {lesson.estimatedMinutes && (
            <span className="text-xs text-muted">{lesson.estimatedMinutes} min</span>
          )}
        </div>
      )}
    </div>
  );

  return (
    <li className="border-b border-border last:border-b-0" data-lesson-id={lesson.id}>
      {lesson.available ? (
        <div className="relative px-5 py-3 hover:bg-surface-2">
          <Link
            to={`/l/${lesson.id}`}
            className="absolute inset-0"
            aria-label={`${lesson.title}${status === 'completed' ? ', completed' : ''}`}
          />
          <div className="pointer-events-none relative [&_a]:pointer-events-auto">{body}</div>
        </div>
      ) : (
        <div className="px-5 py-3" aria-disabled="true">
          {body}
        </div>
      )}
    </li>
  );
}
