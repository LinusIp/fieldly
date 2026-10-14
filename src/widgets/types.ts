import type { FC } from 'react';
import type { ZodType } from 'zod';
import type { Question, QuestionKind } from '../content/schema';
import type { Scope } from '../engine/expr';

/**
 * Question widget contract (§9.1). `model.ts` holds schemas, grading and validation — plain
 * TypeScript, no React — so the Node validator can import it; `view.tsx` is the React component.
 */

export interface WidgetCtx {
  /** Params + derived (and, for hotspot/interactive questions, nothing else). */
  scope: Scope;
  /** Seed for per-attempt shuffles (options, cards, items). */
  seed: number;
}

export interface Grade {
  correct: boolean;
  /** Per-part correctness for multi-part widgets (cards, items, cells, blanks). */
  parts?: boolean[];
  /** Matched misconception id, if any. */
  misconception?: string;
  /** Interpretive feedback (§2.5) as plain text: "too high", "that's the series value". */
  interpretation?: string;
  /** Partial-credit widgets (estimate) give their own score; others score by §2.6. */
  score?: number;
  /** Accepted, with a note (e.g. right value, wrong significant figures). */
  note?: string;
}

export interface WidgetModel<Q extends Question = Question, A = unknown> {
  kind: QuestionKind;
  /** The whole question object, including the kind-specific fields. */
  schema: ZodType<Q>;
  grade(q: Q, answer: A, ctx: WidgetCtx): Grade;
  /** An answer that grades correct — for reveals, the debug API and the validator's self-check. */
  correctAnswer(q: Q, ctx: WidgetCtx): A;
  /** Validator hook: errors for this param set (§13.2). */
  validate(q: Q, ctx: WidgetCtx): string[];
  /** Plain-text summary of an answer, for screen readers and the Explanations tab. */
  describe(q: Q, answer: A, ctx: WidgetCtx): string;
  /** Misconception ids the question uses, with where they come from (for reference checks). */
  tags(q: Q): string[];
  /** Kind-specific keys that hold code or blank syntax rather than Markdown (skipped by the generic text check). */
  nonTextKeys?: string[];
  /** Displayed Markdown for those keys, made checkable (e.g. blanks replaced by □), before templating. */
  texts?(q: Q, ctx: WidgetCtx): string[];
}

export interface WidgetViewProps<Q extends Question = Question, A = unknown> {
  question: Q;
  ctx: WidgetCtx;
  disabled: boolean;
  /** Current (possibly partial) answer; null = nothing yet. */
  answer: A | null;
  onChange(answer: A | null): void;
  /** After a wrong first attempt: which parts were right (marks stay visible). */
  marks?: Grade;
  /** After the final attempt: show both. */
  reveal?: { correct: A; learner: A | null };
}

export interface WidgetModule<Q extends Question = Question, A = unknown> extends WidgetModel<Q, A> {
  View: FC<WidgetViewProps<Q, A>>;
}
