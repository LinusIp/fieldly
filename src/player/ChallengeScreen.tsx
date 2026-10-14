import { useEffect, useMemo, useState } from 'react';
import { track } from '../analytics';
import { Markdown } from '../components/Markdown';
import { Button, CheckIcon, CrossIcon, Stars } from '../components/ui';
import type { ChallengeScreen as Challenge, ChallengeVariant, Question } from '../content/schema';
import { expectedScore } from '../engine/elo';
import type { Scope } from '../engine/expr';
import { challengeScore } from '../engine/scoring';
import { selectVariant, type VariantKey } from '../engine/select';
import { renderTemplate } from '../engine/template';
import { fullScope, resolveConfig, runCheck, solvedState } from '../interactives/check';
import { InteractiveFrame, useInteractiveModule } from '../interactives/InteractiveHost';
import type { AnyModule } from '../interactives/registry';
import type { AttemptState } from '../storage/schema';
import { widgetFor } from '../widgets/registry';
import { challengeScope, conceptRating, gradedScores, recordGraded } from './attempt';
import { usePlayer, withAttempt } from './context';
import { registerDebug } from './debug';
import { HintLadder, nextHintTier } from './HintLadder';
import { buildsOnText, BuildsOnChip, noteMisconception } from './QuestionScreen';
import { StagedExplanation } from './QuestionRunner';

export const SHOW_SOLUTION_AFTER = 5;

type Saved = AttemptState['challenges'][string];

/** ★ solved · ★★ without hints · ★★★ also at or under `par` (§9.5, §8.1). */
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
  if (!saved) return <p className="text-muted">Preparing the challenge…</p>;
  if (interactiveType && error)
    return <p className="text-bad">Could not load the interactive: {error.message}</p>;
  if (interactiveType && !mod) return <p className="text-muted">Loading the interactive…</p>;
  return <ChallengeInner ch={ch} saved={saved} mod={mod} key={`${ch.id}:${saved.variant}`} />;
}

function ChallengeInner({ ch, saved, mod }: { ch: Challenge; saved: Saved; mod?: AnyModule }) {
  const pl = usePlayer();
  const { lesson, lctx, attempt, readOnly } = pl;
  const vk = saved.variant as VariantKey;
  const v = ch.variants[vk];
  const scope = useMemo(() => challengeScope(lesson, ch, attempt.seed), [lesson, ch, attempt.seed]);
  const config = useMemo(
    () => (mod ? resolveConfig(mod, v.config, scope, v.solution) : undefined),
    [mod, v.config, v.solution, scope],
  );
  const widget = v.question ? widgetFor(v.question.kind) : undefined;
  const state = mod ? (saved.state ?? mod.initialState(config)) : saved.state;
  const done = saved.solved || !!saved.usedSolution;
  const [announce, setAnnounce] = useState('');

  const setSaved = (fn: (s: Saved) => Saved, also?: (p: typeof pl.progress) => typeof pl.progress) =>
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

  const rate = (score: number) => (p: typeof pl.progress) =>
    recordGraded(p, lctx, {
      stepId: ch.id,
      question: asQuestion(ch, vk, v),
      concept: ch.concept,
      score,
      record: { answer: null, hintsUsed: saved.hintsUsed, attempts: saved.checks + 1 },
      context: 'lesson',
      usedSolution: score === 0 && !saved.solved,
    });

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
      feedback = passed ? undefined : (g.interpretation ?? 'Not yet — compare your answer with the goal.');
    } else return;
    track({ type: 'challenge-checked', lessonId: lesson.id, challengeId: ch.id, variant: vk, passed });
    if (passed) {
      const score = challengeScore({ solved: true, hintTier: saved.hintsUsed, usedSolution: false });
      setSaved(
        (s) => ({ ...s, checks: s.checks + 1, solved: true, score, feedback: undefined }),
        rate(score),
      );
      setAnnounce(`Solved. Score ${score}.`);
    } else {
      setSaved(
        (s) => ({ ...s, checks: s.checks + 1, feedback }),
        misconception ? (p) => noteMisconception(p, lctx, misconception) : undefined,
      );
      setAnnounce(`Not yet. ${feedback ?? ''}`);
    }
  };

  const showSolution = () => {
    if (done || readOnly) return;
    const solved = mod
      ? solvedState(mod, state, v.solution, config)
      : widget && v.question
        ? widget.correctAnswer(v.question, { scope, seed: attempt.seed })
        : state;
    setSaved((s) => ({ ...s, usedSolution: true, score: 0, state: solved, feedback: undefined }), rate(0));
  };

  const openHint = (tier: number) => {
    if (done || readOnly || tier <= saved.hintsUsed) return;
    setSaved((s) => ({ ...s, hintsUsed: tier }));
  };

  // Debug hook: put the interactive (or the widget) into its solution state.
  useEffect(() => {
    if (!__DEBUG_HOOK__ || readOnly || done) return;
    const load = () => {
      const st = mod
        ? solvedState(mod, state, v.solution, config)
        : widget && v.question
          ? widget.correctAnswer(v.question, { scope, seed: attempt.seed })
          : state;
      setSaved((s) => ({ ...s, state: st }));
    };
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
  const stars = challengeStars(saved, parMet(v.par, solvedScope));
  const canShowSolution = saved.checks >= SHOW_SOLUTION_AFTER || !!mod?.placeholder;

  return (
    <article className="space-y-4" data-testid="screen-challenge" data-variant={vk}>
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Challenge</h2>
          <BuildsOnChip labels={(ch.uses ?? []).map(pl.stepLabel)} />
        </div>
        <h3 className="mt-1 text-xl font-semibold">{ch.title}</h3>
        <div className="mt-2 text-[1.05rem]" data-testid="challenge-goal">
          <Markdown>{renderTemplate(v.goal, scope)}</Markdown>
        </div>
      </section>

      {mod ? (
        <InteractiveFrame
          mod={mod}
          config={config}
          mode="challenge"
          state={state}
          disabled={done || readOnly}
          showingSolution={!!saved.usedSolution}
          onStateChange={(s) => setSaved((x) => ({ ...x, state: s }))}
        />
      ) : widget && v.question ? (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-3">
            <Markdown>{renderTemplate(v.question.prompt, scope)}</Markdown>
          </div>
          <widget.View
            question={v.question}
            ctx={{ scope, seed: attempt.seed }}
            disabled={done || readOnly}
            answer={(saved.state as unknown) ?? null}
            onChange={(a: unknown) => setSaved((x) => ({ ...x, state: a }))}
          />
        </div>
      ) : (
        <p className="text-bad">This challenge has neither an interactive nor a question.</p>
      )}

      <div aria-live="polite" className="min-h-[1.5rem] text-sm">
        {saved.feedback && !done && (
          <div
            className="flex items-start gap-2 rounded-lg bg-bad-soft px-3 py-2 text-bad"
            data-testid="challenge-feedback"
          >
            <CrossIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <Markdown inline>{saved.feedback}</Markdown>
          </div>
        )}
        {saved.solved && (
          <div
            className="flex flex-wrap items-center gap-3 font-semibold text-ok"
            data-testid="challenge-success"
          >
            <span className="flex items-center gap-2">
              <CheckIcon /> Solved — score {saved.score}.
            </span>
            <Stars count={stars} size="md" />
            {v.par && stars < 3 && saved.hintsUsed === 0 && (
              <span className="text-sm font-normal text-muted">
                Par:{' '}
                {Object.entries(v.par)
                  .map(([k, n]) => `${n} ${k}`)
                  .join(', ')}{' '}
                — try it with fewer for ★★★.
              </span>
            )}
          </div>
        )}
        {saved.usedSolution && <p className="font-semibold text-muted">Solution shown — score 0.</p>}
        <span className="sr-only">{announce}</span>
      </div>

      {done && <StagedExplanation text={renderTemplate(v.explanation, scope)} />}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          {!done ? (
            <>
              <Button onClick={check} data-testid="challenge-check">
                Check <span className="text-xs opacity-80">(Enter)</span>
              </Button>
              <span className="text-sm text-muted">
                {saved.checks} check{saved.checks === 1 ? '' : 's'} so far · unlimited
              </span>
              {canShowSolution && (
                <Button variant="secondary" onClick={showSolution} data-testid="show-solution">
                  Show solution
                </Button>
              )}
            </>
          ) : (
            <Button onClick={pl.advance} data-testid="continue">
              Continue <span className="text-xs opacity-80">(Enter)</span>
            </Button>
          )}
        </div>
      )}
      {!readOnly && !done && !canShowSolution && (
        <p className="text-xs text-muted">“Show solution” appears after {SHOW_SOLUTION_AFTER} checks.</p>
      )}
      {!readOnly && !done && mod?.placeholder && (
        <p className="text-xs text-muted">
          Until the hands-on view is built you can’t build this one yourself, so “Show solution” is available
          now (it scores 0).
        </p>
      )}

      {!readOnly && <HintLadder hints={hints} used={saved.hintsUsed} disabled={done} onOpen={openHint} />}
    </article>
  );
}
