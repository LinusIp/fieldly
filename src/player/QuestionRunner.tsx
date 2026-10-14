import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { track } from '../analytics';
import { Markdown } from '../components/Markdown';
import { Button, CheckIcon, CrossIcon } from '../components/ui';
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
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      className={`mt-4 rounded-xl border p-4 outline-none ${highlight ? 'border-2 border-warn bg-warn-soft/40' : 'border-border bg-bg'}`}
      data-testid="explanation"
    >
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
        {highlight ? 'You were sure — read this closely' : 'Explanation'}
      </h3>
      {steps.slice(0, shown).map((s, i) => (
        <Markdown key={i}>{s}</Markdown>
      ))}
      {shown < steps.length && (
        <button
          type="button"
          className="mt-2 text-sm font-semibold text-accent underline"
          onClick={() => setShown((n) => n + 1)}
        >
          Show next step
        </button>
      )}
    </div>
  );
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
  header?: ReactNode;
  readOnly?: boolean;
  /** Keyboard shortcuts and the debug hook follow the active runner. */
  active?: boolean;
  onContinue?(): void;
  continueLabel?: string;
  analytics?: { lessonId: string; questionId: string };
  misconceptionShort?(id: string): string | undefined;
}

const NEUTRAL = 'Not quite — try again, or open a hint.';

export function QuestionRunner(p: QuestionRunnerProps) {
  const { question: q, scope, seed, mode, record, readOnly = false, active = true } = p;
  const widget = widgetFor(q.kind);
  const ctx: WidgetCtx = useMemo(() => ({ scope, seed }), [scope, seed]);
  const done = isDone(record);
  const [draft, setDraft] = useState<unknown>(record && !done ? record.answer : null);
  const [asking, setAsking] = useState(false);
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
      <p className="text-bad" role="alert">
        This question uses a “{q.kind}” widget that isn’t available yet.
      </p>
    );
  const View = widget.View;
  const correctAnswer = done ? safe(() => widget.correctAnswer(q, ctx)) : undefined;
  const finalGrade = done && record ? safe(() => widget.grade(q, record.answer, ctx)) : undefined;
  const showResult = done && record && mode !== 'prediction';
  const confidentError =
    !!record?.confidence && record.confidence === 'sure' && (record.attempts > 1 || record.correct === false);

  return (
    <div data-testid="question" data-kind={q.kind} data-done={done ? 'true' : 'false'}>
      {p.header}
      <div className="text-[1.05rem] leading-relaxed">
        <Markdown>{renderTemplate(q.prompt, scope)}</Markdown>
      </div>
      <div className="mt-4">
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

      <div aria-live="polite" className="mt-3 min-h-[1.5rem] text-sm">
        {firstGrade && !done && (
          <div
            className="flex items-start gap-2 rounded-lg bg-bad-soft px-3 py-2 text-bad"
            data-testid="feedback"
          >
            <CrossIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {firstGrade.misconception && p.misconceptionShort ? (
                <>
                  <strong>Not quite.</strong> {p.misconceptionShort(firstGrade.misconception) ?? ''}{' '}
                  {firstGrade.interpretation ?? ''} Try again, or open a hint.
                </>
              ) : firstGrade.interpretation ? (
                <>
                  <strong>Not quite.</strong> {firstGrade.interpretation} Try again, or open a hint.
                </>
              ) : (
                NEUTRAL
              )}
            </span>
          </div>
        )}
        {done && mode === 'prediction' && (
          <p className="font-semibold text-accent" data-testid="prediction-locked">
            Prediction locked in.
          </p>
        )}
        {showResult && record && !isExplain && (
          <div data-testid="result">
            {mode === 'graded' && isEstimate ? (
              <p className="font-semibold">
                {finalGrade?.interpretation} Score {record.score ?? 0}.
              </p>
            ) : (
              <p
                className={`flex items-center gap-2 font-semibold ${record.correct ? 'text-ok' : 'text-bad'}`}
              >
                {record.correct ? <CheckIcon /> : <CrossIcon />}
                {mode === 'graded'
                  ? resultText(record)
                  : record.correct
                    ? 'Correct.'
                    : 'Not this time — the answer is shown.'}
              </p>
            )}
            {finalGrade?.note && <p className="mt-1 text-muted">{finalGrade.note}</p>}
            {!record.correct && finalGrade?.misconception && p.misconceptionShort && (
              <p className="mt-1 text-bad">{p.misconceptionShort(finalGrade.misconception)}</p>
            )}
            {mode === 'ask' && <p className="mt-1 text-xs text-muted">Explore questions aren’t scored.</p>}
          </div>
        )}
      </div>

      {asking && (
        <div
          className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 px-3 py-2"
          data-testid="confidence"
        >
          <span className="text-sm font-semibold">How sure are you?</span>
          <Button variant="secondary" onClick={() => submit('sure')}>
            Sure
          </Button>
          <Button variant="secondary" onClick={() => submit('unsure')}>
            Unsure
          </Button>
        </div>
      )}

      {showResult && q.explanation && (
        <StagedExplanation text={renderTemplate(q.explanation, scope)} highlight={confidentError} />
      )}

      {hints && !readOnly && !isExplain && (
        <div className="mt-4">
          <HintLadder hints={hints} used={hintsUsed} disabled={done} onOpen={openHint} scored={scored} />
        </div>
      )}

      {!readOnly && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!done ? (
            <Button onClick={tryCheck} disabled={draft === null || asking} data-testid="submit">
              {mode === 'prediction' ? 'Commit prediction' : isExplain ? 'Done' : 'Check'}{' '}
              <span className="text-xs opacity-80">(Enter)</span>
            </Button>
          ) : (
            p.onContinue && (
              <Button onClick={p.onContinue} data-testid="continue">
                {p.continueLabel ?? 'Continue'} <span className="text-xs opacity-80">(Enter)</span>
              </Button>
            )
          )}
          {!done && twoAttempts && (
            <span className="text-xs text-muted">
              Attempt {(record?.attempts ?? 0) + 1} of 2{hints ? ' · H for a hint' : ''}
            </span>
          )}
        </div>
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
