import { useEffect, useMemo, useRef } from 'react';
import { track } from '../analytics';
import { Markdown } from '../components/Markdown';
import { pop, shake } from '../components/motion';
import { Button, Stars } from '../components/ui';
import type { ChallengeScreen as Challenge, ChallengeVariant, Question } from '../content/schema';
import { expectedScore } from '../engine/elo';
import type { Scope } from '../engine/expr';
import { addXp, earnsXp, itemXp } from '../engine/motivation';
import { challengeScore } from '../engine/scoring';
import { selectVariant, type VariantKey } from '../engine/select';
import { renderTemplate } from '../engine/template';
import { fullScope, resolveConfig, runCheck, solvedState } from '../interactives/check';
import { InteractiveFrame, useInteractiveModule } from '../interactives/InteractiveHost';
import type { AnyModule } from '../interactives/registry';
import type { AttemptState, Progress } from '../storage/schema';
import { widgetFor } from '../widgets/registry';
import { challengeScope, conceptRating, gradedScores, recordGraded } from './attempt';
import { usePlayer, withAttempt } from './context';
import { registerDebug } from './debug';
import { HintLadder, nextHintTier } from './HintLadder';
import { FeedbackBanner, StagedExplanation } from './QuestionRunner';
import { buildsOnText, BuildsOnChip, noteMisconception, StepTag } from './QuestionScreen';

export const SHOW_SOLUTION_AFTER = 5;

type Saved = AttemptState['challenges'][string];

/** One star for solving, two without hints, three also at or under `par` (§9.5, §8.1). */
export function challengeStars(saved: Saved | undefined, parMet: boolean): 0 | 1 | 2 | 3 {
  if (!saved?.solved || saved.usedSolution) return 0;
  if (saved.hintsUsed > 0) return 1;
  return parMet ? 3 : 2;
}

export function parMet(par: Record<string, number> | undefined, scope: Scope): boolean {
  if (!par) return true;
  return Object.entries(par).every(([k, v]) => typeof scope[k] === 'number' && (scope[k] as number) <= v);
}

/** The pseudo-question a challenge result is rated as (§3.1). */
function asQuestion(ch: Challenge, vk: string, v: ChallengeVariant): Question {
  return {
    id: `${ch.id}-${vk}`,
    kind: v.question?.kind ?? 'interactive',
    difficulty: v.difficulty,
    prompt: v.goal,
  } as Question;
}

/** Challenge (§8.1): goal, interactive, Check, hint ladder, attempt count and feedback line. */
export function ChallengeScreen({ screen: ch }: { screen: Challenge }) {
  const pl = usePlayer();
  const { lesson, lctx, attempt, progress, readOnly } = pl;
  const saved = attempt.challenges[ch.id];

  // Choose the variant once, when the challenge is first reached (§3.2).
  useEffect(() => {
    if (saved || readOnly) return;
    const std = ch.variants.standard;
    const p = expectedScore(conceptRating(progress, lctx, ch.concept), std.difficulty, lctx.base);
    const variant = selectVariant(p, gradedScores(lesson, attempt)).variant;
    pl.setAttempt((a) =>
      a.challenges[ch.id]
        ? a
        : {
            ...a,
            challenges: {
              ...a.challenges,
              [ch.id]: { variant, state: undefined, hintsUsed: 0, checks: 0, solved: false },
            },
          },
    );
  });
  const interactiveType = ch.interactive;
  const { mod, error } = useInteractiveModule(interactiveType ?? '');
  if (!saved) return <p className="text-ink-2">Preparing the challenge…</p>;
  if (interactiveType && error)
    return <p className="font-semibold">Could not load the interactive: {error.message}</p>;
  if (interactiveType && !mod) return <p className="text-ink-2">Loading the interactive…</p>;
  return <ChallengeInner ch={ch} saved={saved} mod={mod} key={`${ch.id}:${saved.variant}`} />;
}

function ChallengeInner({ ch, saved, mod }: { ch: Challenge; saved: Saved; mod?: AnyModule }) {
  const pl = usePlayer();
  const { lesson, lctx, attempt, readOnly } = pl;
  const boardRef = useRef<HTMLDivElement>(null);
  const vk = saved.variant as VariantKey;
  const v = ch.variants[vk];
  const scope = useMemo(() => challengeScope(lesson, ch, attempt.seed), [lesson, ch, attempt.seed]);
  const config = useMemo(
    () => (mod ? resolveConfig(mod, v.config, scope, v.solution) : undefined),
    [mod, v.config, v.solution, scope],
  );
  const widget = v.question ? widgetFor(v.question.kind) : undefined;
  const state = mod ? (saved.state ?? mod.initialState(config)) : saved.state;
  const done = saved.solved || !!saved.usedSolution || !!saved.skipped;

  const setSaved = (fn: (s: Saved) => Saved, also?: (p: Progress) => Progress) =>
    pl.update((p) => {
      const a = p.lessons[lesson.id]?.attempt;
      const cur = a?.challenges[ch.id];
      if (!a || !cur) return p;
      const next = withAttempt(p, lesson.id, { ...a, challenges: { ...a.challenges, [ch.id]: fn(cur) } });
      return also ? also(next) : next;
    });

  const factOf = (id: string) => {
    const s = lesson.screens.find((x) => x.id === id);
    return s && s.type === 'question' && s.establishes && attempt.answers[id]?.correct !== undefined
      ? renderTemplate(s.establishes, pl.scope)
      : undefined;
  };
  const hints = {
    nudge: renderTemplate(v.hints.nudge, scope),
    buildsOn: v.hints.buildsOn
      ? renderTemplate(v.hints.buildsOn, scope)
      : buildsOnText(ch.uses, pl.stepLabel, factOf),
    partial: renderTemplate(v.hints.partial, scope),
  };
  const itemId = `${lesson.id}#${ch.id}-${vk}`;

  /** Ratings, memory and XP for a real result (solved, or "Show solution" = 0). */
  const rate = (score: number) => (p: Progress) => {
    if (score > 0 && earnsXp(p, itemId)) p = addXp(p, itemXp(v.difficulty, score, 'challenge'));
    return recordGraded(p, lctx, {
      stepId: ch.id,
      question: asQuestion(ch, vk, v),
      concept: ch.concept,
      score,
      record: { answer: null, hintsUsed: saved.hintsUsed, attempts: saved.checks + 1 },
      context: 'lesson',
      usedSolution: score === 0 && !saved.solved,
    });
  };

  const check = () => {
    if (done || readOnly) return;
    let passed: boolean;
    let feedback: string | undefined;
    let misconception: string | undefined;
    if (mod) {
      const r = runCheck(mod, state, config, scope, v.check ?? { expr: 'false' }, v.feedback);
      ({ passed, feedback, misconception } = r);
    } else if (widget && v.question) {
      const g =
        state == null ? { correct: false } : widget.grade(v.question, state, { scope, seed: attempt.seed });
      passed = g.correct;
      misconception = g.misconception;
      feedback = passed ? undefined : (g.interpretation ?? 'Not yet. Compare your answer with the goal.');
    } else return;
    track({ type: 'challenge-checked', lessonId: lesson.id, challengeId: ch.id, variant: vk, passed });
    if (passed) {
      const score = challengeScore({ solved: true, hintTier: saved.hintsUsed, usedSolution: false });
      setSaved(
        (s) => ({ ...s, checks: s.checks + 1, solved: true, score, feedback: undefined }),
        rate(score),
      );
      pop(boardRef.current);
    } else {
      setSaved(
        (s) => ({
          ...s,
          checks: s.checks + 1,
          feedback,
          seen: misconception ? [...new Set([...(s.seen ?? []), misconception])] : s.seen,
        }),
        misconception ? (p) => noteMisconception(p, lctx, misconception) : undefined,
      );
      shake(boardRef.current);
    }
  };

  const solved = () =>
    mod
      ? solvedState(mod, state, v.solution, config)
      : widget && v.question
        ? widget.correctAnswer(v.question, { scope, seed: attempt.seed })
        : state;

  const showSolution = () => {
    if (done || readOnly) return;
    // With a placeholder view the learner can't build anything, so this is a skip, not a 0 (§14 Phase 2).
    if (mod?.placeholder) setSaved((s) => ({ ...s, skipped: true, state: solved(), feedback: undefined }));
    else
      setSaved(
        (s) => ({ ...s, usedSolution: true, score: 0, state: solved(), feedback: undefined }),
        rate(0),
      );
  };

  const openHint = (tier: number) => {
    if (done || readOnly || tier <= saved.hintsUsed) return;
    setSaved((s) => ({ ...s, hintsUsed: tier }));
  };

  // Debug hook: put the interactive (or the widget) into its solution state.
  useEffect(() => {
    if (!__DEBUG_HOOK__ || readOnly || done) return;
    const load = () => setSaved((s) => ({ ...s, state: solved() }));
    const a = registerDebug('loadSolution', load);
    const b = registerDebug('answerCurrent', load);
    return () => {
      a();
      b();
    };
  });

  // Keyboard: Enter checks or continues, H opens the next hint.
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A' || tag === 'INPUT')
        return;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (done) pl.advance();
        else check();
      } else if (e.key === 'h' || e.key === 'H') {
        const t = nextHintTier(hints, saved.hintsUsed);
        if (t !== null && !done) openHint(t);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const solvedScope = mod && saved.solved ? fullScope(mod, state, config, scope) : {};
  const met = parMet(v.par, solvedScope);
  const stars = challengeStars(saved, met);
  const canShowSolution = saved.checks >= SHOW_SOLUTION_AFTER || !!mod?.placeholder;
  const parText = v.par
    ? Object.entries(v.par)
        .map(([k, n]) => `${n} ${k}`)
        .join(', ')
    : '';

  return (
    <article className="flex flex-col gap-5" data-testid="screen-challenge" data-variant={vk}>
      <header className="flex flex-wrap items-center gap-2.5">
        <StepTag>Challenge</StepTag>
        <BuildsOnChip labels={(ch.uses ?? []).map(pl.stepLabel)} />
        <span className="text-small font-semibold text-ink-2">{ch.title}</span>
      </header>
      <div
        className="prompt max-w-[720px] text-[24px] leading-[1.3] font-bold tracking-[-0.015em] md:text-prompt"
        data-testid="challenge-goal"
      >
        <Markdown>{renderTemplate(v.goal, scope)}</Markdown>
      </div>

      <div ref={boardRef}>
        {mod ? (
          <InteractiveFrame
            mod={mod}
            config={config}
            mode="challenge"
            state={state}
            disabled={done || readOnly}
            showingSolution={!!saved.usedSolution || !!saved.skipped}
            onStateChange={(s) => setSaved((x) => ({ ...x, state: s }))}
          />
        ) : widget && v.question ? (
          <div className="flex flex-col gap-4 rounded-xl border-2 border-outline bg-surface p-5 shadow-s3 md:p-7">
            <Markdown>{renderTemplate(v.question.prompt, scope)}</Markdown>
            <widget.View
              question={v.question}
              ctx={{ scope, seed: attempt.seed }}
              disabled={done || readOnly}
              answer={(saved.state as unknown) ?? null}
              onChange={(a: unknown) => setSaved((x) => ({ ...x, state: a }))}
            />
          </div>
        ) : (
          <p className="font-semibold">This challenge has neither an interactive nor a question.</p>
        )}
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          {!done ? (
            <>
              <Button
                onClick={check}
                className="min-h-[56px] min-w-[180px] text-[20px]"
                data-testid="challenge-check"
              >
                {saved.checks > 0 ? 'Check again' : 'Check'}
              </Button>
              {canShowSolution && (
                <Button variant="secondary" onClick={showSolution} data-testid="show-solution">
                  {mod?.placeholder ? 'Skip this challenge' : 'Show solution'}
                </Button>
              )}
              <span className="text-small font-semibold text-ink-2">
                {saved.checks === 0
                  ? 'Unlimited checks.'
                  : `${saved.checks} check${saved.checks === 1 ? '' : 's'} so far, unlimited.`}
                {!canShowSolution && ` “Show solution” appears after ${SHOW_SOLUTION_AFTER}.`}
              </span>
            </>
          ) : (
            <Button
              onClick={pl.advance}
              className="min-h-[56px] min-w-[180px] text-[20px]"
              data-testid="continue"
            >
              Continue
            </Button>
          )}
        </div>
      )}

      <div aria-live="polite" className="flex flex-col gap-3 empty:hidden">
        {saved.feedback && !done && (
          <FeedbackBanner
            tone="wrong"
            icon="cross"
            title="Not yet. One more go."
            line={saved.feedback}
            testId="challenge-feedback"
          />
        )}
        {saved.solved && (
          <div className="flex flex-col gap-2" data-testid="challenge-success">
            <FeedbackBanner
              tone="correct"
              icon="check"
              title={`Solved! Score ${saved.score}.`}
              line={
                stars === 3
                  ? v.par
                    ? `Three stars: no hints, and no more than par (${parText}).`
                    : 'Three stars: no hints.'
                  : stars === 2
                    ? `Two stars. Par is ${parText}: try it with fewer for the third.`
                    : 'One star. Solve it without hints for more.'
              }
            />
            <Stars count={stars} size="md" />
          </div>
        )}
        {saved.usedSolution && (
          <FeedbackBanner
            tone="info"
            icon="cross"
            title="Solution shown."
            line="This challenge scores 0. The explanation is below."
          />
        )}
        {saved.skipped && (
          <FeedbackBanner
            tone="info"
            icon="cross"
            title="Skipped."
            line="This interactive can’t be built by hand yet, so the challenge doesn’t count towards your score, ratings or stars."
          />
        )}
      </div>

      {done && <StagedExplanation text={renderTemplate(v.explanation, scope)} />}

      {!readOnly && !done && (
        <HintLadder hints={hints} used={saved.hintsUsed} disabled={done} onOpen={openHint} />
      )}
      {!readOnly && !done && mod?.placeholder && (
        <p className="text-small font-semibold text-ink-2">
          The hands-on view for this interactive is still being built. Until then you can skip this challenge;
          it won’t count against you.
        </p>
      )}
    </article>
  );
}
