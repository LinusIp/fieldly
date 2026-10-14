import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { track } from '../analytics';
import { Markdown } from '../components/Markdown';
import { Button, CheckIcon, CrossIcon, Loading } from '../components/ui';
import type { Challenge } from '../content/schema';
import { evalBoolean, evalNumber, near, type Scope } from '../engine/expr';
import { challengeScore } from '../engine/scoring';
import type { VariantKey } from '../engine/select';
import { renderTemplate } from '../engine/template';
import { HintLadder, nextHintTier, type RenderedHints } from '../player/HintLadder';
import { loadChallenge } from './registry';
import { makeResolveCtx, type ChallengeModule } from './types';

export const SHOW_SOLUTION_AFTER = 5;

export interface ChallengeSaved {
  variant: string;
  state: unknown;
  hintsUsed: number;
  checks: number;
  solved: boolean;
  usedSolution?: boolean;
  score?: number;
  misconceptions?: string[];
  feedback?: string;
}

export interface ChallengeHostProps {
  lessonId: string;
  challenge: Challenge;
  scope: Scope;
  saved: ChallengeSaved;
  /** Auto-generated tier-2 hint from `uses` when the variant has no authored buildsOn. */
  buildsOnAuto: string | null;
  buildsOnLabels: string[];
  reducedMotion: boolean;
  debug: boolean;
  codeLang: 'python' | 'javascript';
  setSaved(fn: (s: ChallengeSaved) => ChallengeSaved): void;
  onSolved(score: number, difficulty: number): void;
  onMisconception(id: string): void;
  onContinue(): void;
  /** Extra sidebar content from the player (e.g. the Facts panel). */
  sidebar?: ReactNode;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModule = ChallengeModule<any, any, any, any>;

export function ChallengeHost(p: ChallengeHostProps) {
  const [mod, setMod] = useState<{ type: string; m?: AnyModule; error?: Error }>({ type: '' });
  useEffect(() => {
    let alive = true;
    loadChallenge(p.challenge.type).then(
      (m) => alive && setMod({ type: p.challenge.type, m }),
      (error: Error) => alive && setMod({ type: p.challenge.type, error }),
    );
    return () => {
      alive = false;
    };
  }, [p.challenge.type]);
  if (mod.type !== p.challenge.type || (!mod.m && !mod.error))
    return <Loading what="Loading the challenge" />;
  if (mod.error || !mod.m)
    return <p className="text-bad">Could not load the challenge: {mod.error?.message}</p>;
  return <HostInner {...p} mod={mod.m} />;
}

function HostInner(p: ChallengeHostProps & { mod: AnyModule }) {
  const { mod, challenge, scope, saved, setSaved } = p;
  const vk = saved.variant as VariantKey;
  const variant = challenge.variants[vk];
  const config = useMemo(() => {
    const c = mod.resolveConfig(
      mod.configSchema.parse(variant.config),
      makeResolveCtx(scope, evalNumber, renderTemplate),
    );
    return mod.withSolution ? mod.withSolution(c, mod.solutionSchema.parse(variant.solution)) : c;
  }, [mod, variant, scope]);
  const state = saved.state ?? mod.initialState(config);
  const done = saved.solved || !!saved.usedSolution;
  const solution = useMemo(() => mod.solutionSchema.parse(variant.solution), [mod, variant]);
  const [announce, setAnnounce] = useState('');
  const [busy, setBusy] = useState(false);

  const solvedState = useCallback(
    (current: unknown) => {
      const solved = mod.solutionState(solution, config);
      return mod.mergeSolution ? mod.mergeSolution(current ?? mod.initialState(config), solved) : solved;
    },
    [mod, solution, config],
  );

  const hints: RenderedHints = {
    nudge: renderTemplate(variant.hints.nudge, scope),
    buildsOn: variant.hints.buildsOn ? renderTemplate(variant.hints.buildsOn, scope) : p.buildsOnAuto,
    partial: renderTemplate(variant.hints.partial, scope),
  };

  useEffect(() => {
    if (!__DEBUG_HOOK__ || !p.debug) return;
    const w = window as unknown as { __fieldlyDebug?: Record<string, unknown> };
    w.__fieldlyDebug = {
      ...(w.__fieldlyDebug ?? {}),
      loadSolution: () => setSaved((s) => ({ ...s, state: solvedState(s.state) })),
    };
  }, [p.debug, solvedState, setSaved]);

  const check = async () => {
    if (done || busy) return;
    let state = saved.state ?? mod.initialState(config);
    if (mod.beforeCheck) {
      setBusy(true);
      setAnnounce('Running…');
      try {
        state = await mod.beforeCheck(state, config, { codeLang: p.codeLang });
        const st = state;
        setSaved((s) => ({ ...s, state: st }));
      } finally {
        setBusy(false);
      }
    }
    const builtIn = mod.builtInFeedback?.(state, config) ?? null;
    const full: Scope = { ...scope, ...mod.checkScope(state, config), near };
    const safeBool = (expr: string) => {
      try {
        return evalBoolean(expr, full);
      } catch {
        return false;
      }
    };
    const passed = !builtIn && safeBool(variant.check.expr);
    let feedback = '';
    let mis: string | undefined;
    if (!passed) {
      if (builtIn) feedback = builtIn;
      else {
        for (const f of variant.feedback ?? []) {
          if (safeBool(f.if)) {
            feedback = renderTemplate(f.say, full);
            mis = f.misconception;
            break;
          }
        }
        if (!feedback) feedback = 'Not yet — compare what you built with the goal.';
      }
    }
    track({
      type: 'challenge-checked',
      lessonId: p.lessonId,
      challengeId: challenge.id,
      variant: vk,
      passed,
    });
    if (passed) {
      const score = challengeScore({ solved: true, hintsUsed: saved.hintsUsed, usedSolution: false });
      setSaved((s) => ({ ...s, checks: s.checks + 1, solved: true, score, feedback: undefined }));
      p.onSolved(score, variant.difficulty);
      setAnnounce(`Solved. Score ${score}.`);
    } else {
      setSaved((s) => ({
        ...s,
        checks: s.checks + 1,
        feedback,
        misconceptions: mis ? [...(s.misconceptions ?? []), mis] : s.misconceptions,
      }));
      if (mis) p.onMisconception(mis);
      setAnnounce(`Not yet. ${feedback}`);
    }
  };

  const showSolution = () => {
    setSaved((s) => ({
      ...s,
      usedSolution: true,
      score: 0,
      state: solvedState(s.state),
      feedback: undefined,
    }));
    p.onSolved(0, variant.difficulty);
  };

  const openHint = (tier: number) => {
    const t = tier ?? nextHintTier(hints, saved.hintsUsed);
    if (t === null || t <= saved.hintsUsed) return;
    setSaved((s) => ({ ...s, hintsUsed: t }));
  };

  const Comp = mod.Component;
  const description = mod.describeState(state, config);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]" data-testid="challenge">
      <div className="min-w-0 space-y-4">
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Challenge</h2>
            {p.buildsOnLabels.length > 0 && (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                ↩ builds on {p.buildsOnLabels.join(', ')}
              </span>
            )}
          </div>
          <h3 className="mt-1 text-xl font-semibold">{challenge.title}</h3>
          <div className="mt-2 text-[1.05rem]" data-testid="challenge-goal">
            <Markdown>{renderTemplate(variant.goal, scope)}</Markdown>
          </div>
        </section>

        <div className="rounded-2xl border border-border bg-surface p-3 sm:p-4">
          <Comp
            config={config}
            state={state}
            disabled={done}
            showingSolution={!!saved.usedSolution}
            reducedMotion={p.reducedMotion}
            codeLang={p.codeLang}
            onStateChange={(st: unknown) => setSaved((s) => ({ ...s, state: st }))}
          />
          <div className="sr-only" aria-live="polite">
            {description}
          </div>
        </div>

        <div aria-live="polite" className="min-h-[1.5rem]">
          {saved.feedback && !done && (
            <div
              className="flex items-start gap-2 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad"
              data-testid="challenge-feedback"
            >
              <CrossIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <Markdown inline>{saved.feedback}</Markdown>
            </div>
          )}
          {saved.solved && (
            <div className="flex items-center gap-2 font-semibold text-ok" data-testid="challenge-success">
              <CheckIcon /> Solved — score {saved.score}.
            </div>
          )}
          {saved.usedSolution && (
            <div className="text-sm font-semibold text-muted">Solution shown — score 0.</div>
          )}
          <span className="sr-only">{announce}</span>
        </div>

        {done && (
          <div className="rounded-xl border border-border bg-bg p-4" data-testid="challenge-explanation">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Explanation</h3>
            <Markdown>{renderTemplate(variant.explanation, scope)}</Markdown>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {!done ? (
            <>
              <Button onClick={() => void check()} disabled={busy} data-testid="challenge-check">
                {busy ? 'Running…' : 'Check'}
              </Button>
              <span className="text-sm text-muted">
                {saved.checks} check{saved.checks === 1 ? '' : 's'} so far
              </span>
              {saved.checks >= SHOW_SOLUTION_AFTER && (
                <Button variant="secondary" onClick={showSolution} data-testid="show-solution">
                  Show solution
                </Button>
              )}
            </>
          ) : (
            <Button onClick={p.onContinue} data-testid="to-summary">
              Continue to summary
            </Button>
          )}
        </div>
      </div>
      <aside className="space-y-4">
        <HintLadder hints={hints} used={saved.hintsUsed} disabled={done} onOpen={openHint} />
        {p.sidebar}
        <p className="text-xs text-muted">
          Unlimited checks.{' '}
          {SHOW_SOLUTION_AFTER - Math.min(saved.checks, SHOW_SOLUTION_AFTER) > 0
            ? `"Show solution" appears after ${SHOW_SOLUTION_AFTER} checks.`
            : ''}
        </p>
      </aside>
    </div>
  );
}
