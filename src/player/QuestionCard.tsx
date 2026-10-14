import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Markdown } from '../components/Markdown';
import { Button, CheckIcon, CrossIcon } from '../components/ui';
import type { DisplayOption } from '../engine/options';

export interface QuestionCardProps {
  label: string;
  banner?: ReactNode;
  buildsOnLabels: string[];
  context?: string;
  prompt: string;
  options: DisplayOption[];
  selected: number[];
  pick: number | null;
  onPick(index: number): void;
  done: boolean;
  score?: number;
  shortFor(misconception: string): string;
  explanation: string;
  onSubmit(): void;
  onContinue(): void;
  continueLabel?: string;
  debug?: boolean;
  footer?: ReactNode;
  /** Focus the card heading when it appears (new step). */
  autoFocus?: boolean;
}

export function resultText(score: number, selectedCount: number): string {
  if (score === 0) return 'Not this time — the correct answer is highlighted.';
  if (selectedCount > 1) return `Correct on the second try — score ${score}.`;
  if (score === 1) return 'Correct — score 1.0.';
  return `Correct with hints — score ${score}.`;
}

export function QuestionCard(p: QuestionCardProps) {
  const groupId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const explanationRef = useRef<HTMLDivElement>(null);
  const wrongPicks = p.selected.filter((i) => !p.options.find((o) => o.index === i)?.correct);
  const lastWrong =
    !p.done && wrongPicks.length > 0 ? p.options.find((o) => o.index === wrongPicks.at(-1)) : undefined;

  useEffect(() => {
    if (p.autoFocus) headingRef.current?.focus();
  }, [p.autoFocus, p.label, p.prompt]);

  useEffect(() => {
    if (p.done) explanationRef.current?.focus({ preventScroll: false });
  }, [p.done]);

  return (
    <article className="rounded-2xl border border-border bg-surface p-5 sm:p-6" data-testid="question-card">
      {p.banner}
      <header className="flex flex-wrap items-center gap-2">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-sm font-semibold uppercase tracking-wide text-muted outline-none"
        >
          {p.label}
        </h2>
        {p.buildsOnLabels.length > 0 && (
          <span
            className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent"
            data-testid="builds-on"
          >
            ↩ builds on {p.buildsOnLabels.join(', ')}
          </span>
        )}
      </header>

      {p.context && (
        <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
          <Markdown>{p.context}</Markdown>
        </div>
      )}

      <div className="mt-3 text-[1.05rem] leading-relaxed" id={`${groupId}-prompt`}>
        <Markdown>{p.prompt}</Markdown>
      </div>

      <div role="radiogroup" aria-labelledby={`${groupId}-prompt`} className="mt-4 grid gap-2">
        {p.options.map((o, pos) => {
          const isWrong = wrongPicks.includes(o.index);
          const isCorrectShown = p.done && o.correct;
          const disabled = p.done || isWrong;
          const checked = p.pick === o.index;
          let cls = 'border-border hover:border-accent';
          if (isCorrectShown) cls = 'border-ok bg-ok-soft';
          else if (isWrong) cls = 'border-bad bg-bad-soft';
          else if (checked) cls = 'border-accent bg-accent-soft';
          if (disabled && !isCorrectShown && !isWrong) cls += ' opacity-70';
          return (
            <label
              key={o.index}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-offset-2 ${cls} ${disabled ? 'cursor-default' : ''}`}
              data-option={pos}
              data-correct={p.debug && o.correct ? 'true' : undefined}
            >
              <input
                type="radio"
                name={groupId}
                className="sr-only"
                checked={checked}
                disabled={disabled}
                onChange={() => p.onPick(o.index)}
              />
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-bg text-xs font-semibold text-muted"
              >
                {pos + 1}
              </span>
              <span className="min-w-0 flex-1">
                <Markdown inline>{o.text}</Markdown>
                {isCorrectShown && (
                  <span className="ml-2 inline-flex items-center gap-1 text-sm font-semibold text-ok">
                    <CheckIcon /> Correct answer
                  </span>
                )}
                {isWrong && (
                  <span className="ml-2 inline-flex items-center gap-1 text-sm font-semibold text-bad">
                    <CrossIcon /> Your answer
                  </span>
                )}
                {p.debug && o.correct && !p.done && (
                  <span className="ml-2 text-xs text-warn">[debug: correct]</span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      <div aria-live="polite" className="mt-3 min-h-[1.5rem] text-sm">
        {lastWrong?.misconception && (
          <div
            className="flex items-start gap-2 rounded-lg bg-bad-soft px-3 py-2 text-bad"
            data-testid="misconception-feedback"
          >
            <CrossIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Not quite.</strong> <Markdown inline>{p.shortFor(lastWrong.misconception)}</Markdown>{' '}
              Try again or open a hint.
            </span>
          </div>
        )}
        {p.done && p.score !== undefined && (
          <div
            className={`flex items-center gap-2 font-semibold ${p.score > 0 ? 'text-ok' : 'text-bad'}`}
            data-testid="result"
          >
            {p.score > 0 ? <CheckIcon /> : <CrossIcon />} {resultText(p.score, p.selected.length)}
          </div>
        )}
      </div>

      {p.done && (
        <div
          ref={explanationRef}
          tabIndex={-1}
          className="mt-4 rounded-xl border border-border bg-bg p-4 outline-none"
          data-testid="explanation"
        >
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Explanation</h3>
          <Markdown>{p.explanation}</Markdown>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!p.done ? (
          <Button onClick={p.onSubmit} disabled={p.pick === null} data-testid="submit">
            Check answer <span className="text-xs opacity-80">(Enter)</span>
          </Button>
        ) : (
          <Button onClick={p.onContinue} data-testid="continue">
            {p.continueLabel ?? 'Continue'} <span className="text-xs opacity-80">(Enter)</span>
          </Button>
        )}
        {p.footer}
        {!p.done && <span className="text-xs text-muted">Keys: 1–4 choose · Enter check · H hint</span>}
      </div>
    </article>
  );
}

/** Keyboard shortcuts for the current question: 1–4, Enter, H. */
export function useQuestionKeys(opts: {
  active: boolean;
  options: DisplayOption[];
  disabledIndices: number[];
  done: boolean;
  onPick(index: number): void;
  onSubmit(): void;
  onContinue(): void;
  onHint(): void;
}) {
  const ref = useRef(opts);
  useEffect(() => {
    ref.current = opts;
  });
  useEffect(() => {
    if (!opts.active) return;
    const onKey = (e: KeyboardEvent) => {
      const o = ref.current;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
      if (tag === 'INPUT' && (t as HTMLInputElement).type !== 'radio') return;
      if (/^[1-4]$/.test(e.key) && !o.done) {
        const opt = o.options[Number(e.key) - 1];
        if (opt && !o.disabledIndices.includes(opt.index)) {
          e.preventDefault();
          o.onPick(opt.index);
        }
      } else if (e.key === 'Enter') {
        // Let focused buttons and links handle Enter themselves.
        if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return;
        e.preventDefault();
        if (o.done) o.onContinue();
        else o.onSubmit();
      } else if ((e.key === 'h' || e.key === 'H') && !o.done) {
        e.preventDefault();
        o.onHint();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opts.active]);
}
