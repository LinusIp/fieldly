import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { FEATURES } from '../../config';
import { allLessons, findLesson, useContentIndex } from '../../content/loader';
import type { ContentIndex, LessonMeta, PuzzlePackMeta, SubjectMeta, UnitMeta } from '../../content/types';
import { useProgress } from '../../storage/progress';
import type { Progress } from '../../storage/schema';
import { Badge, ErrorState, Loading, Stars } from '../../components/ui';
import { NotFoundPage } from './NotFoundPage';

/** Node states on the path map (§3.7), coloured consistently. */
type NodeState = 'soon' | 'locked' | 'available' | 'in-progress' | 'completed' | 'mastered';

const STATE_LABEL: Record<NodeState, string> = {
  soon: 'coming soon',
  locked: 'locked',
  available: 'available',
  'in-progress': 'in progress',
  completed: 'completed',
  mastered: 'mastered',
};

function lessonState(l: LessonMeta, progress: Progress): NodeState {
  if (!l.available) return 'soon';
  const s = progress.lessons[l.id]?.status;
  if (s === 'completed') return 'completed';
  if (s === 'in-progress') return 'in-progress';
  return 'available';
}

function NodeDot({
  state,
  kind,
  label,
}: {
  state: NodeState;
  kind: 'lesson' | 'side' | 'gate';
  label: ReactNode;
}) {
  const size = kind === 'lesson' ? 'h-10 w-10 text-sm' : 'h-7 w-7 text-xs';
  const shape = kind === 'gate' ? 'rounded-lg' : 'rounded-full';
  const look: Record<NodeState, string> = {
    soon: 'border-2 border-dashed border-border bg-bg text-muted',
    locked: 'border-2 border-border bg-surface-2 text-muted',
    available: 'border-2 border-accent bg-surface text-accent',
    'in-progress': 'border-2 border-accent bg-accent-soft text-accent',
    completed: 'border-2 border-accent bg-accent text-on-accent',
    mastered: 'border-2 border-ok bg-ok text-on-accent',
  };
  return (
    <span
      aria-hidden="true"
      className={`relative z-10 flex shrink-0 items-center justify-center font-semibold ${size} ${shape} ${look[state]}`}
    >
      {label}
    </span>
  );
}

/** One row on the path: a dot, then text. Becomes a link only when it leads somewhere playable. */
function PathNode({
  to,
  state,
  kind,
  dot,
  title,
  meta,
  children,
  testId,
}: {
  to?: string;
  state: NodeState;
  kind: 'lesson' | 'side' | 'gate';
  dot: ReactNode;
  title: string;
  meta?: ReactNode;
  children?: ReactNode;
  testId?: string;
}) {
  const indent = kind === 'side' ? 'pl-[3px] sm:pl-1.5' : '';
  const body = (
    <div className={`flex items-start gap-4 ${indent}`}>
      <NodeDot state={state} kind={kind} label={dot} />
      <div className="min-w-0 flex-1 pt-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`${kind === 'lesson' ? 'font-medium' : 'text-sm'} ${state === 'soon' ? 'text-muted' : 'text-text'}`}
          >
            {title}
          </span>
          {meta}
        </div>
        {children}
      </div>
    </div>
  );
  return (
    <li className="relative py-2" data-lesson-id={testId} data-state={state}>
      {to ? (
        <Link
          to={to}
          className="block rounded-lg px-2 py-1 no-underline hover:bg-surface-2"
          aria-label={`${title}, ${STATE_LABEL[state]}`}
        >
          {body}
        </Link>
      ) : (
        <div className="px-2 py-1" aria-label={`${title}, ${STATE_LABEL[state]}`}>
          {body}
        </div>
      )}
    </li>
  );
}

function RecommendedFirst({
  lesson,
  progress,
  index,
}: {
  lesson: LessonMeta;
  progress: Progress;
  index: ContentIndex;
}) {
  const missing = lesson.prerequisites.filter((p) => progress.lessons[p]?.status !== 'completed');
  if (!lesson.available || missing.length === 0 || progress.lessons[lesson.id]?.status === 'completed')
    return null;
  return (
    <p className="mt-1 text-xs text-warn">
      Recommended first:{' '}
      {missing.map((p, i) => (
        <span key={p}>
          {i > 0 && ', '}
          {findLesson(index, p)?.lesson.title ?? p}
        </span>
      ))}
    </p>
  );
}

function UnitPath({
  unit,
  number,
  subject,
  progress,
  index,
}: {
  unit: UnitMeta;
  number: number;
  subject: SubjectMeta;
  progress: Progress;
  index: ContentIndex;
}) {
  const packsAfter = (lessonId: string): PuzzlePackMeta[] =>
    subject.puzzles.filter((p) => p.unlockAfter === lessonId);
  const done = unit.lessons.filter((l) => progress.lessons[l.id]?.status === 'completed').length;
  const anyAvailable = unit.lessons.some((l) => l.available);
  const allDone = done === unit.lessons.length;

  return (
    <section
      className="rounded-xl border border-border bg-surface p-4 sm:p-5"
      aria-labelledby={`unit-${unit.id}`}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-muted">Unit {number}</span>
        <h2 id={`unit-${unit.id}`} className="flex-1 text-lg font-semibold">
          {unit.title}
        </h2>
        <span className="text-xs text-muted">
          Level {unit.baseDifficulty} · {done}/{unit.lessons.length} lessons
        </span>
      </header>
      <ol className="relative mt-3 before:absolute before:bottom-6 before:left-[27px] before:top-6 before:w-0.5 before:bg-border">
        {unit.lessons.map((l, li) => {
          const state = lessonState(l, progress);
          const lp = progress.lessons[l.id];
          const completed = state === 'completed';
          const practiceState: NodeState =
            !l.available || !FEATURES.practice ? 'soon' : completed ? 'available' : 'locked';
          return [
            <PathNode
              key={l.id}
              testId={l.id}
              to={`/l/${l.id}`}
              state={state}
              kind="lesson"
              dot={li + 1}
              title={l.title}
              meta={
                <>
                  {state === 'soon' && <Badge>Coming soon</Badge>}
                  {state === 'in-progress' && <Badge tone="accent">In progress</Badge>}
                  {l.tryFirst && <Badge tone="warn">Try first</Badge>}
                  {l.available && <Stars count={lp?.stars ?? 0} />}
                  {l.estimatedMinutes && <span className="text-xs text-muted">{l.estimatedMinutes} min</span>}
                </>
              }
            >
              <RecommendedFirst lesson={l} progress={progress} index={index} />
            </PathNode>,
            l.available && (
              <PathNode
                key={`${l.id}#practice`}
                to={practiceState === 'available' ? `/practice/lesson/${l.id}` : undefined}
                state={practiceState}
                kind="side"
                dot="↻"
                title="Practice set"
                meta={
                  practiceState === 'locked' ? (
                    <span className="text-xs text-muted">Complete the lesson to unlock</span>
                  ) : practiceState === 'soon' ? (
                    <Badge>Coming soon</Badge>
                  ) : null
                }
              />
            ),
            ...packsAfter(l.id).map((p) => {
              const ps: NodeState = !FEATURES.puzzles ? 'soon' : completed ? 'available' : 'locked';
              return (
                <PathNode
                  key={p.id}
                  to={ps === 'available' ? `/puzzles/${p.id}` : undefined}
                  state={ps}
                  kind="side"
                  dot="★"
                  title={`${p.title} — puzzle pack`}
                  meta={
                    ps === 'locked' ? (
                      <span className="text-xs text-muted">Unlocks after “{l.title}”</span>
                    ) : ps === 'soon' ? (
                      <Badge>Coming soon</Badge>
                    ) : (
                      <span className="text-xs text-muted">{p.levels} levels</span>
                    )
                  }
                />
              );
            }),
          ];
        })}
        <PathNode
          key="checkpoint"
          to={anyAvailable && FEATURES.practice ? `/checkpoint/${unit.id}` : undefined}
          state={anyAvailable && FEATURES.practice ? 'available' : 'soon'}
          kind="gate"
          dot="✓"
          title="Unit checkpoint"
          meta={
            anyAvailable && FEATURES.practice ? (
              <span className="text-xs text-muted">
                {unit.checkpointItems} mixed questions · pass to test out
              </span>
            ) : (
              <Badge>Coming soon</Badge>
            )
          }
        />
        <PathNode
          key="hard"
          to={allDone && FEATURES.practice ? `/practice/hard/${unit.id}` : undefined}
          state={!anyAvailable || !FEATURES.practice ? 'soon' : allDone ? 'available' : 'locked'}
          kind="gate"
          dot="⚡"
          title="Hard mode"
          meta={
            !anyAvailable || !FEATURES.practice ? (
              <Badge>Coming soon</Badge>
            ) : allDone ? null : (
              <span className="text-xs text-muted">Complete every lesson in the unit to unlock</span>
            )
          }
        />
      </ol>
    </section>
  );
}

/** `#/s/:subjectId`: the subject's path map (§3.7, §10.1). */
export function SubjectPage() {
  const { subjectId } = useParams();
  const { data: index, error } = useContentIndex();
  const progress = useProgress((s) => s.progress);
  if (error) return <ErrorState error={error} />;
  if (!index) return <Loading />;
  const subject = index.subjects.find((s) => s.id === subjectId);
  if (!subject) return <NotFoundPage />;
  const lessons = allLessons(subject);
  const completed = lessons.filter((l) => progress.lessons[l.id]?.status === 'completed').length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link to="/subjects" className="hover:text-accent">
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
            {subject.prerequisites.map((p, i) => (
              <span key={p}>
                {i > 0 && ', '}
                <Link to={`/s/${p}`} className="text-accent underline">
                  {index.subjects.find((s) => s.id === p)?.title ?? p}
                </Link>
              </span>
            ))}
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
      <div className="mt-8 space-y-4" data-testid="path-map">
        {subject.units.map((unit, ui) => (
          <UnitPath
            key={unit.id}
            unit={unit}
            number={ui + 1}
            subject={subject}
            progress={progress}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
