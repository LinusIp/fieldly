import type { CSSProperties, ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { BackIcon, Badge, buttonClass, CheckIcon, ErrorState, Loading, Stars } from '../../components/ui';
import { FEATURES } from '../../config';
import { allLessons, findLesson, useContentIndex } from '../../content/loader';
import type { ContentIndex, LessonMeta, SubjectMeta, UnitMeta } from '../../content/types';
import { useProgress } from '../../storage/progress';
import type { Progress } from '../../storage/schema';
import { NotFoundPage } from './NotFoundPage';

/** Node states on the path map (§3.7). */
type NodeState = 'soon' | 'available' | 'current' | 'in-progress' | 'completed';

const STATE_LABEL: Record<NodeState, string> = {
  soon: 'coming soon',
  available: 'not started',
  current: 'up next',
  'in-progress': 'in progress',
  completed: 'completed',
};

function lessonState(l: LessonMeta, progress: Progress): NodeState {
  if (!l.available) return 'soon';
  const s = progress.lessons[l.id]?.status;
  if (s === 'completed' || s === 'tested-out') return 'completed';
  if (s === 'in-progress') return 'in-progress';
  return 'available';
}

/** Circuit-symbol glyphs for upcoming nodes (§10.5), cycled through a unit. */
const GLYPHS: ReactNode[] = [
  <path key="r" d="M1 15h6l2.5-6 4 12 4-12 4 12 2.5-6h6" />,
  <path
    key="p"
    d="M2 15h5M23 15h5M7 6v18M23 6v18M7 6h4l1.5-3 3 6 3-6 1.5 3h3M7 24h4l1.5-3 3 6 3-6 1.5 3h3"
  />,
  <g key="b">
    <path d="M2 15h9M19 15h9" />
    <path d="M11 5v20" strokeWidth="3" />
    <path d="M19 10v10" strokeWidth="5" />
  </g>,
  <g key="j">
    <path d="M3 15h12M15 15l10-9M15 15l10 9" />
    <circle cx="15" cy="15" r="3.5" fill="currentColor" />
  </g>,
  <g key="m">
    <circle cx="15" cy="15" r="9" />
    <path d="M11 19l4-9 4 9" />
  </g>,
  <path key="c" d="M2 15h10M18 15h10M12 6v18M18 6v18" />,
];

function Glyph({ i, className = 'h-[30px] w-[30px]' }: { i: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 30 30"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[i % GLYPHS.length]}
    </svg>
  );
}

const ROW = 132;
const W = 390;
const LEFT_X = 95;
const RIGHT_X = 295;
const TOP = ROW / 2;

/** The snaking wire through the node centres: accent with flowing dots behind, light ahead. */
function Wire({ count, lit }: { count: number; lit: number }) {
  if (count === 0) return null;
  const pts = Array.from(
    { length: count },
    (_, i) => [i % 2 === 0 ? LEFT_X : RIGHT_X, TOP + i * ROW] as const,
  );
  const seg = (i: number) => {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    return `M${x0} ${y0} C ${x0} ${y0 + 70}, ${x1} ${y1 - 70}, ${x1} ${y1}`;
  };
  const all = pts
    .slice(0, -1)
    .map((_, i) => seg(i))
    .join(' ');
  const tail = `M${pts[count - 1][0]} ${pts[count - 1][1]} L ${pts[count - 1][0]} ${pts[count - 1][1] + 60}`;
  const litPath = pts
    .slice(0, Math.max(0, lit))
    .map((_, i) => (i < count - 1 ? seg(i) : ''))
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${W} ${count * ROW}`}
      className="pointer-events-none absolute inset-x-0 top-0 h-full w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={`${all} ${tail}`}
        fill="none"
        stroke="var(--outline)"
        strokeWidth="16"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={`${all} ${tail}`}
        fill="none"
        stroke="var(--path-ahead)"
        strokeWidth="8"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {litPath && (
        <>
          <path
            d={litPath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="8"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={litPath}
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="2 18"
            opacity="0.9"
            className="flow-anim"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
    </svg>
  );
}

function SideTags({
  lesson,
  completed,
  subject,
}: {
  lesson: LessonMeta;
  completed: boolean;
  subject: SubjectMeta;
}) {
  if (!lesson.available) return null;
  const packs = subject.puzzles.filter((p) => p.unlockAfter === lesson.id);
  const practiceOpen = FEATURES.practice && completed;
  return (
    <span className="flex flex-wrap gap-1.5">
      {practiceOpen ? (
        <Link
          to={`/practice/lesson/${lesson.id}`}
          className={buttonClass('secondary', 'min-h-[44px] px-3 text-small')}
        >
          Practice set
        </Link>
      ) : (
        <Badge tone="dashed">
          {FEATURES.practice ? 'Practice set opens when you finish' : 'Practice sets are coming soon'}
        </Badge>
      )}
      {packs.map((p) =>
        FEATURES.puzzles && completed ? (
          <Link
            key={p.id}
            to={`/puzzles/${p.id}`}
            className={buttonClass('secondary', 'min-h-[44px] px-3 text-small')}
          >
            {p.title}: {p.levels} puzzles
          </Link>
        ) : (
          <Badge key={p.id} tone="dashed">
            {FEATURES.puzzles
              ? `${p.levels} ${p.title} puzzles open when you finish`
              : `${p.title} puzzles coming soon`}
          </Badge>
        ),
      )}
    </span>
  );
}

function LessonNode({
  lesson,
  i,
  state,
  progress,
  subject,
  index,
}: {
  lesson: LessonMeta;
  i: number;
  state: NodeState;
  progress: Progress;
  subject: SubjectMeta;
  index: ContentIndex;
}) {
  const right = i % 2 === 1;
  const lp = progress.lessons[lesson.id];
  const attempt = lp?.attempt;
  const isCurrent = state === 'current' || state === 'in-progress';
  const missing = lesson.prerequisites.filter((p) => progress.lessons[p]?.status !== 'completed');
  const note =
    state === 'soon'
      ? 'Coming soon'
      : state === 'in-progress' && attempt
        ? `Screen ${attempt.screenIndex + 1} of ${attempt.sequence.length}`
        : lesson.estimatedMinutes
          ? `About ${lesson.estimatedMinutes} minutes`
          : undefined;

  let dot: ReactNode;
  if (state === 'completed')
    dot = (
      <span className="flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-outline bg-[var(--accent)] text-on-fill shadow-s2">
        <CheckIcon className="h-7 w-7" />
      </span>
    );
  else if (isCurrent)
    dot = (
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-tint">
        <span className="flex h-[78px] w-[78px] items-center justify-center rounded-full border-[3px] border-outline bg-primary text-on-primary shadow-s2">
          <Glyph i={i} className="h-9 w-9" />
        </span>
      </span>
    );
  else
    dot = (
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-full border-[3px] bg-surface text-ink shadow-s2 ${state === 'soon' ? 'border-dashed border-ink-3 text-ink-3 shadow-none' : 'border-outline'}`}
      >
        <Glyph i={i} />
      </span>
    );

  const label = `${lesson.title}, ${STATE_LABEL[state]}`;
  return (
    <li
      className={`relative flex items-center gap-3.5 ${right ? 'flex-row-reverse text-right' : ''}`}
      style={{
        height: ROW,
        paddingLeft: right ? 0 : `calc(${(LEFT_X / W) * 100}% - ${isCurrent ? 48 : 32}px)`,
        paddingRight: right ? `calc(${((W - RIGHT_X) / W) * 100}% - ${isCurrent ? 48 : 32}px)` : 0,
      }}
      data-lesson-id={lesson.id}
      data-state={state === 'current' ? 'available' : state}
    >
      <Link
        to={`/l/${lesson.id}`}
        aria-label={label}
        className="relative z-10 shrink-0 rounded-full no-underline transition-transform active:translate-y-1"
      >
        {dot}
      </Link>
      <div className={`flex min-w-0 flex-col gap-1 ${right ? 'items-end' : 'items-start'}`}>
        <Link
          to={`/l/${lesson.id}`}
          className="inline-flex min-h-[44px] items-center text-h3 text-ink no-underline hover:underline"
        >
          {lesson.title}
        </Link>
        {lesson.tryFirst && <Badge tone="warn">Try it first</Badge>}
        {state === 'completed' && <Stars count={lp?.stars ?? 0} />}
        {note && <span className="text-small font-semibold text-ink-2">{note}</span>}
        {missing.length > 0 && state !== 'completed' && lesson.available && (
          <span className="text-small font-semibold text-ink-2">
            Recommended first: {missing.map((p) => findLesson(index, p)?.lesson.title ?? p).join(', ')}
          </span>
        )}
        <SideTags lesson={lesson} completed={state === 'completed'} subject={subject} />
      </div>
    </li>
  );
}

function UnitPath({
  unit,
  number,
  subject,
  progress,
  index,
  currentId,
}: {
  unit: UnitMeta;
  number: number;
  subject: SubjectMeta;
  progress: Progress;
  index: ContentIndex;
  currentId?: string;
}) {
  const states = unit.lessons.map((l) => {
    const s = lessonState(l, progress);
    return l.id === currentId && s === 'available' ? 'current' : s;
  });
  const done = states.filter((s) => s === 'completed').length;
  // Current flows up to the first lesson that isn't finished.
  const firstOpen = states.findIndex((s) => s !== 'completed');
  const lit = firstOpen === -1 ? unit.lessons.length : firstOpen + 1;
  const anyAvailable = unit.lessons.some((l) => l.available);
  const allDone = done === unit.lessons.length;
  return (
    <section aria-labelledby={`unit-${unit.id}`} className="flex flex-col gap-2">
      <header className="flex items-center gap-3">
        <div className="flex flex-1 flex-col">
          <span className="text-small font-semibold text-ink-2">Unit {number}</span>
          <h2 id={`unit-${unit.id}`} className="text-h2">
            {unit.title}
          </h2>
        </div>
        <span
          className="tabular rounded-[12px] border-2 border-outline bg-surface px-2.5 py-1 font-extrabold"
          aria-label={`${done} of ${unit.lessons.length} lessons done`}
        >
          {done}/{unit.lessons.length}
        </span>
      </header>
      <div className="relative mx-auto w-full max-w-[390px]">
        <Wire count={unit.lessons.length} lit={lit} />
        <ol role="list" aria-label={`Lessons in unit ${number}`} className="relative">
          {unit.lessons.map((l, i) => (
            <LessonNode
              key={l.id}
              lesson={l}
              i={i}
              state={states[i]}
              progress={progress}
              subject={subject}
              index={index}
            />
          ))}
        </ol>
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        <Badge tone="dashed">
          {anyAvailable && FEATURES.practice
            ? `Unit checkpoint: ${unit.checkpointItems} mixed questions`
            : 'Unit checkpoint coming soon'}
        </Badge>
        <Badge tone="dashed">
          {!anyAvailable || !FEATURES.practice
            ? 'Hard mode coming soon'
            : allDone
              ? 'Hard mode is open'
              : 'Hard mode opens when you finish every lesson'}
        </Badge>
      </div>
    </section>
  );
}

/** `#/s/:subjectId`: the subject's path map (§3.7, §10.5). */
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
  const inProgress = lessons.find((l) => progress.lessons[l.id]?.status === 'in-progress');
  const next =
    inProgress ?? lessons.find((l) => l.available && progress.lessons[l.id]?.status !== 'completed');

  return (
    <div
      className="mx-auto flex max-w-[760px] flex-col gap-8 px-[18px] py-6 md:px-6"
      style={{ '--accent': `var(--color-${subject.id}, var(--volt))` } as CSSProperties}
    >
      <header className="flex items-center gap-3">
        <Link
          to="/subjects"
          aria-label="Back to subjects"
          className="press press-s1 flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-surface text-ink"
        >
          <BackIcon />
        </Link>
        <div className="flex flex-1 flex-col">
          <span className="text-small font-semibold text-ink-2">
            {completed} of {lessons.length} lessons done
          </span>
          <h1 className="text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em] md:text-display">
            {subject.title}
          </h1>
        </div>
      </header>
      <p className="-mt-4 max-w-[640px] text-ink-2">
        {subject.description}
        {(subject.prerequisites.length > 0 || subject.background) && (
          <>
            {' '}
            Before this:{' '}
            {subject.prerequisites.map((p, i) => (
              <span key={p}>
                {i > 0 && ', '}
                <Link to={`/s/${p}`} className="font-semibold text-primary-ink underline">
                  {index.subjects.find((s) => s.id === p)?.title ?? p}
                </Link>
              </span>
            ))}
            {subject.background && `${subject.prerequisites.length ? '; ' : ''}${subject.background}`}.
          </>
        )}
      </p>
      {next && (
        <Link
          to={`/l/${next.id}`}
          className={buttonClass('primary', 'min-h-[56px] self-start px-8 text-[19px]')}
        >
          {inProgress ? `Continue: ${next.title}` : `Start: ${next.title}`}
        </Link>
      )}
      <div className="flex flex-col gap-10" data-testid="path-map">
        {subject.units.map((unit, ui) => (
          <UnitPath
            key={unit.id}
            unit={unit}
            number={ui + 1}
            subject={subject}
            progress={progress}
            index={index}
            currentId={next?.id}
          />
        ))}
      </div>
    </div>
  );
}
