import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { track } from '../analytics';
import { Loading } from '../components/ui';
import type { Lesson } from '../content/schema';
import type { ContentIndex, SubjectContent } from '../content/types';
import { randomSeed } from '../engine/params';
import { useProgress } from '../storage/progress';
import type { AttemptState, Progress } from '../storage/schema';
import {
  advanceAttempt,
  ensureVariant,
  entryMap,
  finishLesson,
  isStep,
  lessonCtx,
  lessonResult,
  lessonScope,
  newAttempt,
  openLesson,
  type Entry,
} from './attempt';
import { ChallengeScreen } from './ChallengeScreen';
import { PlayerContext, withAttempt, type PlayerCtx } from './context';
import { registerDebug } from './debug';
import { ExplanationsTab } from './ExplanationsTab';
import { ConceptScreen, ExploreScreen } from './ExploreScreen';
import { HookScreen } from './HookScreen';
import { QuestionScreen } from './QuestionScreen';
import { RecapScreen } from './RecapScreen';
import { FactsDrawer, FactsPanel, ProgressDots, type Dot } from './Sidebar';
import { WorkedScreen } from './WorkedScreen';

const TYPE_LABEL: Record<string, string> = {
  hook: 'Hook',
  explore: 'Explore',
  concept: 'Concept',
  worked: 'Worked example',
  question: 'Question',
  challenge: 'Challenge',
  recap: 'Recap',
};

function ScreenView({ entry }: { entry: Entry }) {
  switch (entry.type) {
    case 'hook':
      return <HookScreen screen={entry} />;
    case 'explore':
      return <ExploreScreen screen={entry} />;
    case 'concept':
      return <ConceptScreen screen={entry} />;
    case 'worked':
      return <WorkedScreen screen={entry} />;
    case 'question':
      return <QuestionScreen step={entry} />;
    case 'challenge':
      return <ChallengeScreen screen={entry} />;
    case 'recap':
      return <RecapScreen screen={entry} />;
  }
}

/** The lesson player (§8.1). Progress (attempt included) lives in the store, so a reload resumes. */
export function LessonPlayer({
  lesson,
  subject,
  index,
  base,
}: {
  lesson: Lesson;
  subject: SubjectContent;
  index: ContentIndex;
  base: number;
}) {
  const progress = useProgress((s) => s.progress);
  const update = useProgress((s) => s.update);
  const attempt = progress.lessons[lesson.id]?.attempt;
  const lctx = useMemo(() => lessonCtx(lesson, subject, base), [lesson, subject, base]);
  const [tab, setTab] = useState<'lesson' | 'explanations'>('lesson');
  /** Index into the sequence being re-read, or null for the current screen. */
  const [viewing, setViewing] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  // Open or resume the attempt.
  useEffect(() => {
    update((p) => openLesson(p, lctx, randomSeed()));
  }, [lctx, update]);

  const setAttempt = useCallback(
    (fn: (a: AttemptState, p: Progress) => AttemptState) =>
      update((p) => {
        const a = p.lessons[lesson.id]?.attempt;
        return a ? withAttempt(p, lesson.id, fn(a, p)) : p;
      }),
    [lesson.id, update],
  );

  const map = useMemo(() => entryMap(lesson), [lesson]);
  const seed = attempt?.seed;
  const scope = useMemo(() => (seed === undefined ? {} : lessonScope(lesson, seed)), [lesson, seed]);
  const misMap = useMemo(() => new Map(subject.misconceptions.map((m) => [m.id, m])), [subject]);
  const conceptMap = useMemo(() => new Map(subject.concepts.map((c) => [c.id, c.title])), [subject]);
  const labels = useMemo(() => {
    const out = new Map<string, string>();
    let n = 0;
    for (const s of lesson.screens) if (s.type === 'question') out.set(s.id, `Q${++n}`);
    for (const x of lesson.extras ?? []) out.set(x.id, x.role === 'bonus' ? 'Bonus' : 'Extra practice');
    return out;
  }, [lesson]);

  const currentId = attempt ? attempt.sequence[attempt.screenIndex] : undefined;
  const currentEntry = currentId ? map.get(currentId) : undefined;

  // A step reached without a variant (an older save): choose it now.
  useEffect(() => {
    if (attempt && currentId && isStep(currentEntry) && !attempt.chosenVariants[currentId])
      setAttempt((a, p) => ensureVariant(lctx, a, p, currentId));
  }, [attempt, currentId, currentEntry, lctx, setAttempt]);

  const advance = useCallback(() => {
    if (viewing !== null) {
      setViewing((v) => (v === null || !attempt || v + 1 >= attempt.screenIndex ? null : v + 1));
      return;
    }
    update((p) => {
      const a = p.lessons[lesson.id]?.attempt;
      if (!a || a.screenIndex >= a.sequence.length - 1) return p;
      const next = advanceAttempt(lctx, a, p);
      let out = withAttempt(p, lesson.id, next);
      if (map.get(next.sequence[next.screenIndex])?.type === 'recap') {
        const wasCompleted = p.lessons[lesson.id]?.status === 'completed';
        out = finishLesson(out, lesson, next);
        const r = lessonResult(lesson, next);
        if (r.completed && !wasCompleted)
          track({ type: 'lesson-completed', lessonId: lesson.id, meanCore: r.meanCore, stars: r.stars });
      }
      return out;
    });
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0 });
      mainRef.current?.focus({ preventScroll: true });
    });
  }, [viewing, attempt, update, lesson, lctx, map]);

  // Debug hook: which screen is on show, and restart with a seed.
  useEffect(() => {
    if (!__DEBUG_HOOK__) return;
    const a = registerDebug('current', () =>
      currentEntry ? { id: currentEntry.id, type: currentEntry.type } : null,
    );
    const b = registerDebug('setSeed', (s: number) =>
      update((p) => {
        const old = p.lessons[lesson.id]?.attempt;
        return withAttempt(p, lesson.id, newAttempt(lesson, s >>> 0, old?.firstInSubject ?? false));
      }),
    );
    return () => {
      a();
      b();
    };
  }, [currentEntry, update, lesson]);

  if (!attempt || attempt.lessonVersion !== lesson.version || !currentEntry)
    return <Loading what="Preparing the lesson" />;

  const shownIndex = viewing ?? attempt.screenIndex;
  const shownEntry = map.get(attempt.sequence[shownIndex])!;
  const ctx: PlayerCtx = {
    lesson,
    lctx,
    subject,
    index,
    attempt,
    progress,
    scope,
    readOnly: viewing !== null,
    setAttempt,
    update,
    advance,
    misconceptionShort: (id) => misMap.get(id)?.short,
    conceptTitle: (slug) => conceptMap.get(slug) ?? slug,
    stepLabel: (id) => labels.get(id) ?? id,
  };
  const subjectMeta = index.subjects.find((s) => s.id === subject.id);
  const dots: Dot[] = attempt.sequence.map((id, i) => {
    const e = map.get(id);
    const c = attempt.challenges[id];
    return {
      id,
      label: labels.get(id) ?? TYPE_LABEL[e?.type ?? ''] ?? id,
      score: isStep(e)
        ? attempt.answers[id]?.score
        : e?.type === 'challenge' && c?.score !== undefined
          ? c.score
          : undefined,
      visited: i <= attempt.screenIndex,
      current: i === shownIndex,
      skipped: attempt.skipped.includes(id),
    };
  });
  const earlier = attempt.sequence.slice(0, attempt.screenIndex);

  return (
    <PlayerContext.Provider value={ctx}>
      <div
        className="mx-auto max-w-6xl px-4 py-6 pb-24 lg:pb-6"
        data-testid="lesson-player"
        data-screen={shownEntry.id}
        data-screen-type={shownEntry.type}
      >
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link to="/subjects" className="hover:text-accent">
            Subjects
          </Link>{' '}
          /{' '}
          <Link to={`/s/${subject.id}`} className="hover:text-accent">
            {subjectMeta?.short ?? subject.id}
          </Link>
        </nav>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{lesson.title}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-lg hover:bg-surface-2 disabled:opacity-40"
            aria-label="Previous screen"
            disabled={shownIndex === 0}
            onClick={() => setViewing(shownIndex - 1)}
            data-testid="back"
          >
            ←
          </button>
          <ProgressDots dots={dots} onPick={(i) => setViewing(i === attempt.screenIndex ? null : i)} />
        </div>

        <div role="tablist" aria-label="Lesson views" className="mt-4 flex gap-1 border-b border-border">
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
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === k ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'}`}
              data-testid={`tab-${k}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,960px)_280px]">
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="min-w-0">
            {tab === 'explanations' ? (
              <ExplanationsTab />
            ) : (
              <>
                {viewing !== null && (
                  <div
                    className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-surface-2 px-4 py-2 text-sm"
                    role="status"
                  >
                    <span>You’re re-reading an earlier screen.</span>
                    <button
                      type="button"
                      className="font-semibold text-accent underline"
                      onClick={() => setViewing(null)}
                      data-testid="back-to-current"
                    >
                      Back to where you were
                    </button>
                    <button type="button" className="text-accent underline" onClick={advance}>
                      Next screen
                    </button>
                  </div>
                )}
                <div ref={mainRef} tabIndex={-1} className="outline-none">
                  <ScreenView key={`${shownEntry.id}:${viewing ?? 'now'}`} entry={shownEntry} />
                </div>
                {earlier.length > 0 && (
                  <details
                    className="mt-8 rounded-xl border border-border bg-surface p-3 text-sm"
                    open={historyOpen}
                    onToggle={(e) => setHistoryOpen((e.target as HTMLDetailsElement).open)}
                  >
                    <summary className="cursor-pointer font-semibold">
                      Earlier in this lesson ({earlier.length})
                    </summary>
                    <ol className="mt-2 grid gap-1 sm:grid-cols-2">
                      {earlier.map((id, i) => {
                        const e = map.get(id);
                        return (
                          <li key={id}>
                            <button
                              type="button"
                              className="w-full rounded px-2 py-1 text-left hover:bg-surface-2"
                              onClick={() => setViewing(i)}
                            >
                              {i + 1}. {labels.get(id) ? `${labels.get(id)} · ` : ''}
                              {TYPE_LABEL[e?.type ?? ''] ?? id}
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  </details>
                )}
              </>
            )}
          </div>
          <aside className="hidden space-y-4 lg:block">
            <FactsPanel facts={attempt.facts} />
          </aside>
        </div>
        <FactsDrawer facts={attempt.facts} />
      </div>
    </PlayerContext.Provider>
  );
}
