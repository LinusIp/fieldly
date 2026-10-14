import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Markdown } from '../components/Markdown';
import { Button, Loading } from '../components/ui';
import type { Lesson, Misconception } from '../content/schema';
import type { ContentIndex } from '../content/types';
import { useProgress } from '../storage/progress';
import type { AttemptState, Progress } from '../storage/schema';
import { ensureVariant, lessonScope, newAttempt, resetStaleQuestions, subjectOf } from './attempt';
import { ChallengeStage } from './ChallengeStage';
import { PlayerContext, usePlayer, withAttempt, type PlayerCtx } from './context';
import { debugEnabled } from './debug';
import { ExplanationsTab } from './ExplanationsTab';
import { Practice } from './Practice';
import { Summary } from './Summary';

const STAGES = [
  { key: 'intro', label: 'Intro' },
  { key: 'practice', label: 'Practice' },
  { key: 'challenge', label: 'Challenge' },
  { key: 'summary', label: 'Summary' },
] as const;

export function LessonPlayer({
  lesson,
  index,
  misconceptions,
  conceptTitles,
}: {
  lesson: Lesson;
  index: ContentIndex;
  misconceptions: Misconception[];
  conceptTitles: Map<string, string>;
}) {
  const progress = useProgress((s) => s.progress);
  const update = useProgress((s) => s.update);
  const attempt = progress.lessons[lesson.id]?.attempt;
  const [tab, setTab] = useState<'lesson' | 'explanations'>('lesson');

  // Open (or resume) the attempt.
  useEffect(() => {
    update((p) => {
      p = resetStaleQuestions(lesson, p);
      const lp = p.lessons[lesson.id];
      const now = new Date();
      let a = lp?.attempt;
      if (!a || a.lessonVersion !== lesson.version) a = newAttempt(lesson, p, now);
      return {
        ...p,
        lessons: {
          ...p.lessons,
          [lesson.id]: {
            status: lp?.status === 'completed' ? 'completed' : 'in-progress',
            bestScore: lp?.bestScore ?? 0,
            stars: lp?.stars ?? 0,
            completedAt: lp?.completedAt,
            attempt: a,
            lastOpenedAt: now.toISOString(),
          },
        },
      };
    });
  }, [lesson, update]);

  const setAttempt = useCallback(
    (fn: (a: AttemptState, p: Progress) => AttemptState) =>
      update((p) => {
        const a = p.lessons[lesson.id]?.attempt;
        return a ? withAttempt(p, lesson.id, fn(a, p)) : p;
      }),
    [lesson.id, update],
  );

  const seed = attempt?.seed;
  const scope = useMemo(() => (seed === undefined ? {} : lessonScope(lesson, seed)), [lesson, seed]);
  const misMap = useMemo(() => new Map(misconceptions.map((m) => [m.id, m])), [misconceptions]);
  const debug = useMemo(() => debugEnabled(), []);

  if (!attempt) return <Loading what="Preparing the lesson" />;

  const ctx: PlayerCtx = {
    lesson,
    index,
    misconceptions: misMap,
    conceptTitles,
    attempt,
    progress,
    scope,
    debug,
    setAttempt,
    update,
  };
  const stageIdx = STAGES.findIndex((s) => s.key === attempt.stage);
  const subject = index.subjects.find((s) => s.id === subjectOf(lesson.id));

  return (
    <PlayerContext.Provider value={ctx}>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link to="/" className="hover:text-accent">
            Subjects
          </Link>{' '}
          /{' '}
          <Link to={`/s/${subjectOf(lesson.id)}`} className="hover:text-accent">
            {subject?.short ?? subjectOf(lesson.id)}
          </Link>
        </nav>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{lesson.title}</h1>

        <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-label="Lesson stages">
          {STAGES.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2">
              <span
                aria-current={i === stageIdx ? 'step' : undefined}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${
                  i === stageIdx
                    ? 'bg-accent text-on-accent'
                    : i < stageIdx
                      ? 'bg-accent-soft text-accent'
                      : 'bg-surface-2 text-muted'
                }`}
              >
                {i < stageIdx && <span aria-hidden="true">✓</span>}
                {s.label}
                {i < stageIdx && <span className="sr-only"> (done)</span>}
              </span>
              {i < STAGES.length - 1 && (
                <span aria-hidden="true" className="text-muted">
                  ›
                </span>
              )}
            </li>
          ))}
        </ol>

        <div role="tablist" aria-label="Lesson views" className="mt-5 flex gap-1 border-b border-border">
          {(
            [
              ['lesson', 'Lesson'],
              ['explanations', 'Explanations'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              type="button"
              id={`tab-${k}`}
              aria-selected={tab === k}
              aria-controls={`panel-${k}`}
              tabIndex={tab === k ? 0 : -1}
              onClick={() => setTab(k)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft')
                  setTab(tab === 'lesson' ? 'explanations' : 'lesson');
              }}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${
                tab === k ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-6">
          {tab === 'explanations' ? (
            <ExplanationsTab />
          ) : attempt.stage === 'intro' ? (
            <Intro />
          ) : attempt.stage === 'practice' ? (
            <Practice />
          ) : attempt.stage === 'challenge' ? (
            <ChallengeStage />
          ) : (
            <Summary />
          )}
        </div>
      </div>
    </PlayerContext.Provider>
  );
}

function Intro() {
  const { lesson, setAttempt } = usePlayer();
  return (
    <div className="max-w-[720px] space-y-6" data-testid="intro">
      <div className="text-[1.05rem] leading-relaxed">
        <Markdown>{lesson.intro}</Markdown>
      </div>
      <section
        className="rounded-xl border border-accent/30 bg-accent-soft/50 p-5"
        aria-labelledby="worked-h"
      >
        <h2 id="worked-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-accent">
          Worked example
        </h2>
        <Markdown>{lesson.workedExample}</Markdown>
      </section>
      <div className="flex items-center gap-4">
        <Button
          onClick={() =>
            setAttempt((a, p) => ensureVariant(lesson, { ...a, stage: 'practice', stepIndex: 0 }, p))
          }
          data-testid="start-practice"
        >
          Start practice
        </Button>
        <span className="text-sm text-muted">
          {lesson.chain.filter((s) => s.role === 'core').length} linked questions, then a hands-on challenge ·
          about {lesson.estimatedMinutes} min
        </span>
      </div>
    </div>
  );
}
