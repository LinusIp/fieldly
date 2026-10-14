import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { track } from '../analytics';
import { Markdown } from '../components/Markdown';
import { Badge, Button } from '../components/ui';
import type { Question, Step } from '../content/schema';
import { stepScore } from '../engine/scoring';
import { renderTemplate } from '../engine/template';
import {
  advance,
  applyAnswer,
  buildsOnHint,
  currentQuestion,
  ensureVariant,
  optionsFor,
  skipStep,
  stepLabel,
  stepMap,
} from './attempt';
import { usePlayer, withAttempt } from './context';
import { setDebugApi } from './debug';
import { FactsDrawer, FactsPanel } from './FactsPanel';
import { HintLadder, nextHintTier, type RenderedHints } from './HintLadder';
import { ProgressDots, type DotInfo } from './ProgressDots';
import { QuestionCard, useQuestionKeys } from './QuestionCard';

export function Practice() {
  const { lesson, attempt, setAttempt } = usePlayer();
  const stepId = attempt.sequence[attempt.stepIndex];
  const needsVariant = stepId !== undefined && !attempt.chosenVariants[stepId];

  useEffect(() => {
    if (needsVariant) setAttempt((a, p) => ensureVariant(lesson, a, p));
  }, [needsVariant, lesson, setAttempt]);

  const step = stepId ? stepMap(lesson).get(stepId) : undefined;
  if (!step || needsVariant) return <PracticeLayout card={null} hints={null} />;
  return <CurrentStep key={stepId} step={step} />;
}

/** Main column (answered steps + current question) and sidebar (dots, hints, facts). */
function PracticeLayout({ card, hints }: { card: ReactNode; hints: ReactNode }) {
  const { lesson, attempt } = usePlayer();
  const dots: DotInfo[] = attempt.sequence.map((id, i) => ({
    id,
    label: stepLabel(lesson, id),
    score: attempt.answers[id]?.score,
    skipped: attempt.skippedSteps.includes(id),
    current: i === attempt.stepIndex,
  }));
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 max-w-[760px] space-y-3">
        <details className="rounded-xl border border-border bg-surface px-4 py-2 text-sm">
          <summary className="cursor-pointer py-1 font-medium text-muted">
            Re-read the intro and worked example
          </summary>
          <div className="py-2">
            <Markdown>{lesson.intro}</Markdown>
            <div className="mt-3 rounded-lg bg-accent-soft/50 p-3">
              <Markdown>{lesson.workedExample}</Markdown>
            </div>
          </div>
        </details>
        {attempt.sequence.slice(0, attempt.stepIndex).map((id) => (
          <AnsweredStep key={id} stepId={id} />
        ))}
        {card}
      </div>
      <aside className="space-y-4 pb-20 lg:pb-0" aria-label="Lesson sidebar">
        <ProgressDots dots={dots} />
        {hints}
        <div className="hidden lg:block">
          <FactsPanel facts={attempt.facts} />
        </div>
      </aside>
      <FactsDrawer facts={attempt.facts} />
    </div>
  );
}

function renderHints(q: Question, step: Step, ctx: ReturnType<typeof usePlayer>): RenderedHints {
  return {
    nudge: renderTemplate(q.hints.nudge, ctx.scope),
    buildsOn: buildsOnHint(ctx.lesson, step, q, ctx.scope),
    partial: renderTemplate(q.hints.partial, ctx.scope),
  };
}

function CurrentStep({ step }: { step: Step }) {
  const ctx = usePlayer();
  const { lesson, attempt, scope, setAttempt, update, misconceptions, debug } = ctx;
  const q = currentQuestion(lesson, attempt, step.id)!;
  const options = useMemo(() => optionsFor(q, scope, attempt.seed), [q, scope, attempt.seed]);
  const ans = attempt.answers[step.id] ?? { selected: [], hintsUsed: 0 };
  const done = ans.score !== undefined;
  const [pick, setPick] = useState<number | null>(null);
  const hints = useMemo(() => renderHints(q, step, ctx), [q, step, ctx]);
  const prompt = useMemo(() => renderTemplate(q.prompt, scope), [q, scope]);
  const explanation = useMemo(() => renderTemplate(q.explanation, scope), [q, scope]);
  const wrongPicks = ans.selected.filter((i) => !options.find((o) => o.index === i)?.correct);
  const isLast = attempt.stepIndex === attempt.sequence.length - 1;

  useEffect(() => {
    setDebugApi({ correctIndex: options.findIndex((o) => o.correct) });
  }, [options]);

  const submit = () => {
    if (pick === null || done) return;
    const opt = options.find((o) => o.index === pick)!;
    const selected = [...ans.selected, pick];
    if (opt.correct || selected.length >= 2) {
      const score = stepScore({
        correct: opt.correct,
        attempt: selected.length as 1 | 2,
        hintsUsed: ans.hintsUsed,
      });
      const mis = selected
        .map((i) => options.find((o) => o.index === i)!)
        .filter((o) => !o.correct && o.misconception)
        .map((o) => o.misconception!);
      update((p) => {
        const a = p.lessons[lesson.id]?.attempt;
        if (!a) return p;
        const r = applyAnswer(
          lesson,
          a,
          p,
          { stepId: step.id, question: q, selected, hintsUsed: ans.hintsUsed, score, misconceptions: mis },
          scope,
          new Date(),
        );
        return withAttempt(r.progress, lesson.id, r.attempt);
      });
      track({
        type: 'question-answered',
        lessonId: lesson.id,
        questionId: q.id,
        score,
        attempts: selected.length,
        hintsUsed: ans.hintsUsed,
        review: false,
      });
    } else {
      setAttempt((a) => ({
        ...a,
        answers: { ...a.answers, [step.id]: { selected, hintsUsed: ans.hintsUsed } },
      }));
    }
    setPick(null);
  };

  const openHint = (tier?: number) => {
    if (done) return;
    const t = tier ?? nextHintTier(hints, ans.hintsUsed);
    if (t === null || t <= ans.hintsUsed) return;
    setAttempt((a) => ({
      ...a,
      answers: { ...a.answers, [step.id]: { selected: ans.selected, hintsUsed: t } },
    }));
    track({ type: 'hint-opened', lessonId: lesson.id, questionId: q.id, tier: t });
  };

  const next = () => setAttempt((a, p) => advance(lesson, a, p));
  const skip = () => setAttempt((a, p) => advance(lesson, skipStep(a, step.id), p));

  useQuestionKeys({
    active: true,
    options,
    disabledIndices: wrongPicks,
    done,
    onPick: setPick,
    onSubmit: submit,
    onContinue: next,
    onHint: () => openHint(),
  });

  let banner = null;
  if (step.role === 'remediation') {
    const target = step.remediates ? stepLabel(lesson, step.remediates) : '';
    banner = (
      <div className="mb-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn" role="note">
        <strong>Extra practice.</strong> A quick question on the idea behind {target}, before you go on.
      </div>
    );
  } else if (step.role === 'bonus') {
    banner = (
      <div className="mb-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent" role="note">
        <strong>Bonus question.</strong> You're on a roll — try a harder one, or skip it.
      </div>
    );
  }

  return (
    <PracticeLayout
      hints={<HintLadder hints={hints} used={ans.hintsUsed} disabled={done} onOpen={openHint} />}
      card={
        <QuestionCard
          label={stepLabel(lesson, step.id)}
          banner={banner}
          buildsOnLabels={(step.uses ?? []).map((u) => stepLabel(lesson, u))}
          prompt={prompt}
          options={options}
          selected={ans.selected}
          pick={pick}
          onPick={setPick}
          done={done}
          score={ans.score}
          shortFor={(m) => (misconceptions.get(m) ? renderTemplate(misconceptions.get(m)!.short, scope) : '')}
          explanation={explanation}
          onSubmit={submit}
          onContinue={next}
          continueLabel={isLast ? 'Continue to the challenge' : 'Continue'}
          debug={debug}
          autoFocus
          footer={
            step.role === 'bonus' && !done ? (
              <Button variant="ghost" onClick={skip} data-testid="skip-bonus">
                Skip bonus
              </Button>
            ) : null
          }
        />
      }
    />
  );
}

function AnsweredStep({ stepId }: { stepId: string }) {
  const { lesson, attempt, scope } = usePlayer();
  const step = stepMap(lesson).get(stepId);
  const label = stepLabel(lesson, stepId);
  if (!step) return null;
  if (attempt.skippedSteps.includes(stepId))
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-2 text-sm text-muted">
        {label} — skipped
      </div>
    );
  const q = currentQuestion(lesson, attempt, stepId)!;
  const ans = attempt.answers[stepId];
  const options = optionsFor(q, scope, attempt.seed);
  const correct = options.find((o) => o.correct)!;
  const picks = (ans?.selected ?? []).map((i) => options.find((o) => o.index === i)!);
  const score = ans?.score ?? 0;
  return (
    <details
      className="group rounded-xl border border-border bg-surface px-4 py-2"
      data-testid="answered-step"
    >
      <summary className="flex cursor-pointer items-center gap-3 py-1 text-sm">
        <span className="font-semibold text-muted">{label}</span>
        <Badge tone={score >= 0.8 ? 'ok' : score > 0 ? 'warn' : 'bad'}>
          {score > 0 ? '✓' : '✕'} {score}
        </Badge>
        <span className="line-clamp-1 flex-1 text-muted">
          {renderTemplate(q.prompt, scope)
            .replace(/\$[^$]*\$/g, '…')
            .slice(0, 110)}
        </span>
      </summary>
      <div className="space-y-2 py-2 text-sm">
        <Markdown>{renderTemplate(q.prompt, scope)}</Markdown>
        <p>
          <span className="text-muted">Your answer{picks.length > 1 ? 's' : ''}: </span>
          {picks.map((o, i) => (
            <span key={i}>
              {i > 0 && ', then '}
              <Markdown inline>{o.text}</Markdown> {o.correct ? '✓' : '✕'}
            </span>
          ))}
        </p>
        <p>
          <span className="text-muted">Correct answer: </span>
          <Markdown inline>{correct.text}</Markdown>
        </p>
        <div className="rounded-lg bg-bg p-3">
          <Markdown>{renderTemplate(q.explanation, scope)}</Markdown>
        </div>
      </div>
    </details>
  );
}
