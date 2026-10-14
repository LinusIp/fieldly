import type { Question } from '../content/schema';
import { evalNumber, type Scope } from './expr';
import { formatNumber } from './format';
import { mulberry32 } from './params';
import { renderTemplate } from './template';

export interface DisplayOption {
  /** Index in authored order: computed → [answer, ...distractors]; static → options[]. */
  index: number;
  text: string;
  correct: boolean;
  misconception?: string;
  value?: number;
}

export function isComputed(q: Question): boolean {
  return q.answer !== undefined;
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function formatNumericOption(value: number, unit?: string, sig?: number): string {
  const n = formatNumber(value, { sig });
  return unit ? `${n} ${unit}` : n;
}

/**
 * Build the four options in display order. Computed options are sorted ascending by value
 * (position gives no clue); static options are shuffled with a seed unless `fixedOrder`.
 */
export function buildOptions(q: Question, scope: Scope, seed: number): DisplayOption[] {
  if (q.answer) {
    const authored = [
      { ...q.answer, misconception: undefined as string | undefined, correct: true },
      ...(q.distractors ?? []).map((d) => ({ ...d, correct: false })),
    ];
    const opts = authored.map((o, index) => {
      const value = evalNumber(o.expr, scope);
      if (!Number.isFinite(value)) throw new Error(`option "${o.expr}" is not finite (${value})`);
      return {
        index,
        value,
        text: formatNumericOption(value, o.unit, o.sig),
        correct: o.correct,
        misconception: o.misconception,
      } satisfies DisplayOption;
    });
    return [...opts].sort((a, b) => a.value - b.value || a.index - b.index);
  }
  const opts: DisplayOption[] = (q.options ?? []).map((o, index) => ({
    index,
    text: renderTemplate(o.text, scope),
    correct: o.correct === true,
    misconception: o.misconception,
  }));
  if (q.fixedOrder) return opts;
  const rng = mulberry32(seed ^ hashString(q.id));
  const out = [...opts];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
