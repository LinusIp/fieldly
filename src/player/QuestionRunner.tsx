import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { track } from '../analytics';
import { Markdown } from '../components/Markdown';
import { pop, shake } from '../components/motion';
import { ArrowDownIcon, ArrowUpIcon, Button, CheckIcon, CrossIcon } from '../components/ui';
import type { Question } from '../content/schema';
import type { Scope } from '../engine/expr';
import { stepScore } from '../engine/scoring';
import { renderTemplate } from '../engine/template';
import { useProgress } from '../storage/progress';
import type { AnswerRecord } from '../storage/schema';
import { widgetFor } from '../widgets/registry';
import type { Grade, WidgetCtx } from '../widgets/types';
import { registerDebug } from './debug';
import { HintLadder, nextHintTier, type RenderedHints } from './HintLadder';

/**
 * - `graded`: a chain step — two attempts, hints, scoring (§2.5–2.6).
 * - `ask`: an explore `ask` task — the same, but never scored.
 * - `prediction`: commit once; never right or wrong at commit time.
 */
export type RunnerMode = 'graded' | 'ask' | 'prediction';

/** A finished question has `correct` set (predictions and explanations too). */
export function isDone(r: AnswerRecord | undefined): boolean {
  return r?.correct !== undefined;
}

export function resultText(r: AnswerRecord): string {
  const s = r.score ?? 0;
  if (s === 0) return 'Not this time — the correct answer is shown.';
  if (r.attempts > 1) return `Correct on the second try — score ${s}.`;
  if (s === 1) return 'Correct — score 1.0.';
  return `Correct with hints — score ${s}.`;
}

/** A widget's describe() text without its leading verb ("Chose …", "Answered …"). */
export function answerText(described: string): string {
  return described.replace(
    /^(Answered|Chose|Typed|Estimated|Tapped|Picked|Wrote:|Filled:|Selected:|Order:)\s*/,
    '',
  );
}

/** Split a long explanation into steps ("Show next step", §2.5): blocks separated by blank lines. */
export function explanationSteps(text: string): string[] {
  const blocks = text.trim().split(/\n\s*\n/);
  if (blocks.length < 4) return [text];
  return [blocks.slice(0, 2).join('\n\n'), ...blocks.slice(2)];
}

export function StagedExplanation({ text, highlight = false }: { text: string; highlight?: boolean }) {
  const steps = useMemo(() => explanationSteps(text), [text]);
  const [shown, setShown] = useState(1);
  return (
    <section
      className={`rounded-lg p-5 ${highlight ? 'border-[3px] border-wrong bg-surface' : 'border-2 border-outline bg-surface-sunk'}`}
      data-testid="explanation"
    >
      <h3 className="mb-2 text-h3">{highlight ? 'You were sure — this one is worth a close read' : 'Why'}</h3>
      <div className="flex flex-col gap-3">
        {steps.slice(0, shown).map((s, i) => (
          <Markdown key={i}>{s}</Markdown>
        ))}
      </div>
      {shown < steps.length && (
        <Button variant="secondary" className="mt-3" onClick={() => setShown((n) => n + 1)}>
          Show next step
        </Button>
      )}
    </section>
  );
}

type BannerTone = 'wrong' | 'correct' | 'info';
type BannerIcon = 'up' | 'down' | 'cross' | 'check';

/** Feedback banner (§10.5): an icon tile, a short verdict in 800 and one line underneath. */
export function FeedbackBanner({
  tone,
  icon,
  title,
  line,
  testId = 'feedback',
}: {
  tone: BannerTone;
  icon: BannerIcon;
  title: ReactNode;
  line?: ReactNode;
  testId?: string;
}) {
  const fill = { wrong: 'bg-wrong-tint', correct: 'bg-correct-tint', info: 'bg-surface-tint' }[tone];
  const tile = { wrong: 'bg-wrong', correct: 'bg-correct', info: 'bg-volt' }[tone];
  const Icon = { up: ArrowUpIcon, down: ArrowDownIcon, cross: CrossIcon, check: CheckIcon }[icon];
  return (
    <div
      role="status"
      className={`anim-slide-up flex items-center gap-3.5 rounded-lg border-2 border-outline px-4 py-3.5 ${fill}`}
      data-testid={testId}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border-2 border-outline text-on-fill ${tile}`}
      >
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <div className="flex min-w-0 flex-col">
        <strong className="font-extrabold">{title}</strong>
        {line && <span>{line}</span>}
      </div>
    </div>
  );
}

/** "Too high." → up arrow; "Too low." → down arrow (§10.5). */
function directionOf(interpretation?: string): BannerIcon {
  if (!interpretation) return 'cross';
  if (/^too high/i.test(interpretation)) return 'up';
  if (/^too low/i.test(interpretation)) return 'down';
  return 'cross';
}

export interface QuestionRunnerProps {
  question: Question;
  scope: Scope;
  seed: number;
  mode: RunnerMode;
  record?: AnswerRecord;
  /** Persist the record; `final` once the question is finished. */
  onRecord(r: AnswerRecord, final: boolean, grade: Grade): void;
  /** Auto-generated tier-2 hint (from `uses` + Facts) when the question has no authored one. */
  buildsOnAuto?: string | null;
  /** Step tag and chain chip row. */
  header?: ReactNode;
  /** Smaller prompt type, for questions inside explore missions. */
  compact?: boolean;
  readOnly?: boolean;
  /** Keyboard shortcuts and the debug hook follow the active runner. */
  active?: boolean;
  onContinue?(): void;
  continueLabel?: string;
  analytics?: { lessonId: string; questionId: string };
  misconceptionShort?(id: string): string | undefined;
  /** The card to pop on a correct answer (§10.6). */
  popRef?: RefObject<HTMLElement | null>;
}

export function QuestionRunner(p: QuestionRunnerProps) {
  const { question: q, scope, seed, mode, record, readOnly = false, active = true, compact = false } = p;
  const widget = widgetFor(q.kind);
  const ctx: WidgetCtx = useMemo(() => ({ scope, seed }), [scope, seed]);
  const done = isDone(record);
  const [draft, setDraft] = useState<unknown>(record && !done ? record.answer : null);
  const [asking, setAsking] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);
  const confidencePrompts = useProgress((s) => s.progress.settings.confidencePrompts);
  const hintsUsed = record?.hintsUsed ?? 0;
  const isExplain = q.kind === 'explain';
  const isEstimate = q.kind === 'estimate';
  const scored = mode === 'graded' && !isExplain;
  const twoAttempts = (mode === 'graded' || mode === 'ask') && !isExplain && !isEstimate;

  const hints: RenderedHints | null =
    q.hints && mode !== 'prediction'
      ? {
          nudge: renderTemplate(q.hints.nudge, scope),
          buildsOn: q.hints.buildsOn ? renderTemplate(q.hints.buildsOn, scope) : (p.buildsOnAuto ?? null),
          partial: renderTemplate(q.hints.partial, scope),
        }
      : null;

  const onChange = useCallback((a: unknown) => setDraft(a), []);

  const firstGrade = useMemo<Grade | null>(() => {
    if (!widget || !record || done || record.attempts === 0) return null;
    try {
      return widget.grade(q, record.answer, ctx);
    } catch {
      return { correct: false };
    }
  }, [widget, record, done, q, ctx]);

  const submit = (confidence?: 'sure' | 'unsure') => {
    if (!widget || done || readOnly || draft === null) return;
    setAsking(false);
    let grade: Grade;
    try {
      grade = widget.grade(q, draft, ctx);
    } catch {
      grade = { correct: false };
    }
    const attempts = (record?.attempts ?? 0) + 1;
    const base: AnswerRecord = {
      ...record,
      answer: draft,
      hintsUsed,
      attempts,
      misconception: grade.misconception,
      seen: grade.misconception ? [...new Set([...(record?.seen ?? []), grade.misconception])] : record?.seen,
      confidence: record?.confidence ?? confidence,
    };
    let final = true;
    if (mode === 'prediction' || isExplain) base.correct = isExplain ? true : grade.correct;
    else if (isEstimate) {
      base.correct = grade.correct;
      if (scored)
        base.score = Math.min(
          grade.score ?? 0,
          stepScore({ correct: true, attempt: 1, hintTier: hintsUsed }),
        );
    } else if (grade.correct) {
      base.correct = true;
      if (scored)
        base.score = stepScore({ correct: true, attempt: attempts > 1 ? 2 : 1, hintTier: hintsUsed });
    } else if (attempts < 2 && twoAttempts) final = false;
    else {
      base.correct = false;
      if (scored) base.score = 0;
    }
    p.onRecord(base, final, grade);
    if (mode !== 'prediction' && !isExplain) {
      if (base.correct) pop(p.popRef?.current ?? answerRef.current);
      else if (!isEstimate) shake(answerRef.current);
    }
    if (final && scored && p.analytics)
      track({
        type: 'question-answered',
        ...p.analytics,
        score: base.score ?? 0,
        attempts,
        hintsUsed,
        review: false,
      });
  };

  const tryCheck = () => {
    if (draft === null || done) return;
    if (confidencePrompts && scored && !record?.confidence && (record?.attempts ?? 0) === 0) setAsking(true);
    else submit();
  };

  const openHint = (tier: number) => {
    if (!hints || done || readOnly || tier <= hintsUsed) return;
    p.onRecord({ ...(record ?? { answer: null, attempts: 0 }), hintsUsed: tier }, false, { correct: false });
    if (p.analytics) track({ type: 'hint-opened', ...p.analytics, tier });
  };

  // Keyboard: Enter checks or continues, H opens the next hint (§2.5).
  const keyRef = useRef({ tryCheck, openHint, done, hints, hintsUsed, onContinue: p.onContinue });
  useEffect(() => {
    keyRef.current = { tryCheck, openHint, done, hints, hintsUsed, onContinue: p.onContinue };
  });
  useEffect(() => {
    if (!active || readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A' || t?.isContentEditable)
        return;
      const k = keyRef.current;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (k.done) k.onContinue?.();
        else k.tryCheck();
      } else if ((e.key === 'h' || e.key === 'H') && tag !== 'INPUT' && !k.done && k.hints) {
        const next = nextHintTier(k.hints, k.hintsUsed);
        if (next !== null) {
          e.preventDefault();
          k.openHint(next);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, readOnly]);

  // Debug hook: fill in a correct answer.
  useEffect(() => {
    if (!__DEBUG_HOOK__ || !active || readOnly || done || !widget) return;
    return registerDebug('answerCurrent', () => setDraft(widget.correctAnswer(q, ctx)));
  }, [active, readOnly, done, widget, q, ctx]);

  if (!widget)
    return (
      <p className="font-semibold" role="alert">
        This question uses a “{q.kind}” widget that isn’t available yet.
      </p>
    );
  const View = widget.View;
  const correctAnswer = done ? safe(() => widget.correctAnswer(q, ctx)) : undefined;
  const finalGrade = done && record ? safe(() => widget.grade(q, record.answer, ctx)) : undefined;
  const showResult = done && record && mode !== 'prediction';
  const confidentError = record?.confidence === 'sure' && (record.attempts > 1 || record.correct === false);
  const short = (id?: string) => (id ? p.misconceptionShort?.(id) : undefined);

  let banner: ReactNode = null;
  if (firstGrade && !done) {
    const icon = directionOf(firstGrade.interpretation);
    const verdict =
      icon === 'up'
        ? 'Too high. One more go.'
        : icon === 'down'
          ? 'Too low. One more go.'
          : firstGrade.interpretation && !short(firstGrade.misconception)
            ? firstGrade.interpretation
            : 'Not quite. One more go.';
    banner = (
      <FeedbackBanner
        tone="wrong"
        icon={icon}
        title={verdict}
        line={short(firstGrade.misconception) ?? 'Try again, or open a hint.'}
      />
    );
  } else if (done && mode === 'prediction') {
    banner = (
      <FeedbackBanner
        tone="info"
        icon="check"
        title="Prediction locked in."
        line="Now let’s see what really happens."
        testId="prediction-locked"
      />
    );
  } else if (showResult && record && !isExplain) {
    if (mode === 'graded' && isEstimate)
      banner = (
        <FeedbackBanner
          tone={(record.score ?? 0) >= 0.6 ? 'correct' : 'info'}
          icon="check"
          title={`Score ${record.score ?? 0}.`}
          line={finalGrade?.interpretation}
          testId="result"
        />
      );
    else if (record.correct)
      banner = (
        <FeedbackBanner
          tone="correct"
          icon="check"
          title={
            mode === 'graded'
              ? (record.score ?? 0) === 1
                ? 'Nice! Score 1.0.'
                : resultText(record)
              : 'Correct.'
          }
          line={finalGrade?.note ?? (mode === 'ask' ? 'Explore questions aren’t scored.' : undefined)}
          testId="result"
        />
      );
    else
      banner = (
        <FeedbackBanner
          tone="wrong"
          icon="cross"
          title="Not this time — the answer is shown."
          line={
            short(finalGrade?.misconception) ??
            (mode === 'ask' ? 'Explore questions aren’t scored.' : undefined)
          }
          testId="result"
        />
      );
  }

  return (
    <div
      className="flex flex-col gap-5"
      data-testid="question"
      data-kind={q.kind}
      data-done={done ? 'true' : 'false'}
    >
      {p.header}
      <div
        className={`prompt max-w-[720px] ${compact ? 'text-h3' : 'text-[24px] leading-[1.3] font-bold tracking-[-0.015em] md:text-prompt'}`}
      >
        <Markdown>{renderTemplate(q.prompt, scope)}</Markdown>
      </div>
      <div ref={answerRef}>
        <View
          question={q}
          ctx={ctx}
          disabled={done || readOnly}
          answer={done ? (record?.answer ?? null) : draft}
          onChange={onChange}
          marks={firstGrade && record ? { answer: record.answer, grade: firstGrade } : undefined}
          reveal={showResult ? { correct: correctAnswer, learner: record?.answer ?? null } : undefined}
        />
      </div>

      {asking && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-outline bg-surface-tint px-4 py-3"
          data-testid="confidence"
        >
          <span className="font-extrabold">How sure are you?</span>
          <Button variant="secondary" onClick={() => submit('sure')}>
            Sure
          </Button>
          <Button variant="secondary" onClick={() => submit('unsure')}>
            Unsure
          </Button>
        </div>
      )}

      {!readOnly && !asking && (
        <div className="flex flex-wrap items-center gap-3">
          {!done ? (
            <Button
              variant={firstGrade ? 'accent' : 'primary'}
              onClick={tryCheck}
              disabled={draft === null}
              className="min-h-[56px] min-w-[180px] text-[20px]"
              data-testid="submit"
            >
              {mode === 'prediction'
                ? 'Lock in my prediction'
                : isExplain
                  ? 'Done'
                  : firstGrade
                    ? 'Try again'
                    : 'Check'}
            </Button>
          ) : (
            p.onContinue && (
              <Button
                onClick={p.onContinue}
                className="min-h-[56px] min-w-[180px] text-[20px]"
                data-testid="continue"
              >
                {p.continueLabel ?? 'Continue'}
              </Button>
            )
          )}
          {!done && twoAttempts && (
            <span className="text-small font-semibold text-ink-2">
              Try {(record?.attempts ?? 0) + 1} of 2. Press Enter to check.
            </span>
          )}
        </div>
      )}

      <div aria-live="polite" className="empty:hidden">
        {banner}
      </div>

      {showResult && q.explanation && (
        <StagedExplanation text={renderTemplate(q.explanation, scope)} highlight={confidentError} />
      )}

      {hints && !readOnly && !isExplain && !done && (
        <HintLadder hints={hints} used={hintsUsed} disabled={done} onOpen={openHint} scored={scored} />
      )}
    </div>
  );
}

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}
