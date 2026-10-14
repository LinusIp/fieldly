import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { track } from '../analytics';
import { BackIcon, CrossIcon, IconButton, Loading, ProgressBattery, XpPill } from '../components/ui';
import type { Lesson } from '../content/schema';
import type { ContentIndex, SubjectContent } from '../content/types';
import { addXp, countActiveDay, earnCharge, LESSON_XP } from '../engine/motivation';
import { randomSeed } from '../engine/params';
import { useProgress } from '../storage/progress';
import type { AttemptState, Progress } from '../storage/schema';
import {
  advanceAttempt,
  ensureVariant,
  entryMap,
  factEntries,
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
import { FactsButton, FactsPanel } from './Sidebar';
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

/** Screens that lay out their own side column (missions) instead of the Facts panel. */
const OWN_SIDE = new Set(['explore', 'hook']);

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

/** The lesson player (§8.1, §10.2). Progress (attempt included) lives in the store, so a reload resumes. */
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
  const navigate = useNavigate();
  const attempt = progress.lessons[lesson.id]?.attempt;
  const lctx = useMemo(() => lessonCtx(lesson, subject, base), [lesson, subject, base]);
  const [tab, setTab] = useState<'lesson' | 'explanations'>('lesson');
  /** Index into the sequence being re-read, or null for the current screen. */
  const [viewing, setViewing] = useState<number | null>(null);
  /** The completion burst plays once, when the recap is reached with the lesson complete (§10.6). */
  const [burst, setBurst] = useState(false);
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
        if (r.completed && !wasCompleted) {
          // A completed lesson: +20 XP, a streak day and a streak charge (§3.7).
          out = earnCharge(countActiveDay(addXp(out, LESSON_XP)));
          track({ type: 'lesson-completed', lessonId: lesson.id, meanCore: r.meanCore, stars: r.stars });
          setBurst(true);
        }
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
  const stepLabel = (id: string) => labels.get(id) ?? id;
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
    stepLabel,
  };
  const facts = factEntries(lesson, attempt, scope, stepLabel);
  const used = isStep(shownEntry)
    ? (shownEntry.uses ?? [])
    : shownEntry.type === 'challenge'
      ? (shownEntry.uses ?? [])
      : [];
  const nextSlot =
    isStep(shownEntry) && shownEntry.establishes && attempt.answers[shownEntry.id]?.correct === undefined
      ? `Answer ${stepLabel(shownEntry.id)} to add the next fact.`
      : undefined;
  const total = attempt.sequence.length;
  const earlier = attempt.sequence.slice(0, attempt.screenIndex);
  const ownSide = OWN_SIDE.has(shownEntry.type);

  return (
    <PlayerContext.Provider value={ctx}>
      <div
        className="pb-10"
        data-testid="lesson-player"
        data-screen={shownEntry.id}
        data-screen-type={shownEntry.type}
      >
        <header className="mx-auto flex max-w-[1220px] flex-wrap items-center gap-x-5 gap-y-3 px-[18px] pt-[18px] pb-2 md:px-6">
          <IconButton label="Leave lesson" onClick={() => navigate(`/s/${subject.id}`)} data-testid="leave">
            <CrossIcon className="h-5 w-5" />
          </IconButton>
          <div className="flex min-w-[240px] flex-[1_1_320px]">
            <ProgressBattery
              total={total}
              done={attempt.screenIndex}
              current={attempt.screenIndex}
              burst={burst}
              label={`Screen ${attempt.screenIndex + 1} of ${total}`}
            />
          </div>
          <XpPill xp={progress.xp.total} />
        </header>

        <div className="mx-auto flex max-w-[1220px] flex-wrap items-center gap-3 px-[18px] pt-2 md:px-6">
          <h1 className="sr-only">{lesson.title}</h1>
          <IconButton
            label="Previous screen"
            disabled={shownIndex === 0}
            onClick={() => setViewing(shownIndex - 1)}
            className="h-11 w-11 disabled:opacity-40"
            data-testid="back"
          >
            <BackIcon />
          </IconButton>
          <div
            role="tablist"
            aria-label="Lesson views"
            className="flex gap-1 rounded-full border-2 border-outline bg-surface p-1"
          >
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
                className={`min-h-[44px] rounded-full px-4 text-small font-extrabold ${
                  tab === k ? 'bg-primary text-on-primary' : 'text-ink-2 hover:text-ink'
                }`}
                data-testid={`tab-${k}`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-small font-semibold text-ink-2">{lesson.title}</span>
        </div>

        <div
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          className="mx-auto max-w-[1220px] px-[18px] pt-4 md:px-6"
        >
          {tab === 'explanations' ? (
            <ExplanationsTab />
          ) : (
            <>
              {viewing !== null && (
                <div
                  className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border-2 border-outline bg-volt-tint px-4 py-2.5 font-semibold"
                  role="status"
                >
                  <span>You’re re-reading an earlier screen.</span>
                  <button
                    type="button"
                    className="font-extrabold text-primary-ink underline"
                    onClick={() => setViewing(null)}
                    data-testid="back-to-current"
                  >
                    Back to where you were
                  </button>
                  <button
                    type="button"
                    className="font-extrabold text-primary-ink underline"
                    onClick={advance}
                  >
                    Next screen
                  </button>
                </div>
              )}
              <div className="flex flex-wrap items-start gap-7">
                <div
                  ref={mainRef}
                  tabIndex={-1}
                  className={`min-w-0 outline-none ${ownSide ? 'flex-[1_1_100%]' : 'flex-[999_1_560px]'}`}
                >
                  <ScreenView key={`${shownEntry.id}:${viewing ?? 'now'}`} entry={shownEntry} />
                </div>
                {!ownSide && (
                  <aside
                    className="flex min-w-0 max-w-[400px] flex-[1_1_300px] flex-col gap-3"
                    aria-label="Your facts"
                  >
                    <div className="hidden md:block">
                      <FactsPanel facts={facts} used={used} nextSlot={nextSlot} />
                    </div>
                    <div className="md:hidden">
                      <FactsButton facts={facts} used={used} nextSlot={nextSlot} />
                    </div>
                  </aside>
                )}
              </div>
              {earlier.length > 0 && (
                <details className="mt-10 rounded-lg border-2 border-outline bg-surface p-4">
                  <summary className="flex min-h-[44px] cursor-pointer items-center font-extrabold">
                    Earlier in this lesson ({earlier.length})
                  </summary>
                  <ol className="mt-3 grid gap-1 sm:grid-cols-2">
                    {earlier.map((id, i) => {
                      const e = map.get(id);
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            className="min-h-[44px] w-full rounded-md px-3 text-left font-semibold hover:bg-surface-tint"
                            onClick={() => setViewing(i)}
                          >
                            {i + 1}. {labels.get(id) ? `${labels.get(id)}: ` : ''}
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
      </div>
    </PlayerContext.Provider>
  );
}
