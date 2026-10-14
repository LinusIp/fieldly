import { z } from 'zod';
import { evalNumber, type Scope } from '../../engine/expr';
import { commonFields, equivalent, namesIn, normaliseInput, parseNumber, withinTolerance } from '../common';
import type { Grade, WidgetModel } from '../types';

/**
 * `blanks` (§9.2): fill blanks inside a sentence or derivation. Blank syntax in `text`:
 * - `[[expr]]` numeric (1% relative tolerance), `[[expr ± tol]]` numeric with absolute tolerance;
 * - `[[= expr]]` an expression, equivalent at random points over its free symbols;
 * - `[[a|b|c]]` a choice; the first option is correct (shown shuffled).
 * The same syntax powers `worked` screens, where `[[?…]]` marks a fadeable span (§7.4).
 */

export type Blank =
  | { type: 'number'; expr: string; abs?: number }
  | { type: 'expression'; expr: string }
  | { type: 'choice'; options: string[] };

export interface BlankSegment {
  text?: string;
  blank?: Blank;
  /** `[[?…]]` in worked steps: shown filled at low ratings. */
  fadeable?: boolean;
}

const BLANK = /\[\[(\??)([^\]]+)\]\]/g;

export function parseBlank(src: string): Blank {
  const s = src.trim();
  if (s.startsWith('=')) return { type: 'expression', expr: s.slice(1).trim() };
  if (s.includes('|')) return { type: 'choice', options: s.split('|').map((o) => o.trim()) };
  const pm = s.split('±');
  if (pm.length === 2) return { type: 'number', expr: pm[0].trim(), abs: Number(pm[1].trim()) };
  return { type: 'number', expr: s };
}

/** Split text into literal segments and blanks. */
export function segmentsOf(text: string): BlankSegment[] {
  const out: BlankSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(BLANK)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    out.push({ blank: parseBlank(m[2]), fadeable: m[1] === '?' });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function blanksOf(text: string): Blank[] {
  return segmentsOf(text).flatMap((s) => (s.blank ? [s.blank] : []));
}

/** Free symbols of an expression blank (those not set by params) get a sampling range. */
function freeVars(expr: string, scope: Scope): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  for (const s of namesIn(expr).symbols) if (!(s in scope) && s !== 'pi' && s !== 'e') out[s] = [0.5, 2.5];
  return out;
}

/** Grade one blank's typed value. */
export function gradeBlank(b: Blank, input: string, scope: Scope): boolean {
  if (b.type === 'choice') return input === b.options[0];
  if (b.type === 'number') {
    const x = parseNumber(input);
    return x !== null && withinTolerance(x, evalNumber(b.expr, scope), 0.01, b.abs);
  }
  try {
    return equivalent(b.expr, normaliseInput(input), freeVars(b.expr, scope), scope, {});
  } catch {
    return false;
  }
}

/** The displayed correct value of a blank. */
export function blankAnswer(b: Blank, scope: Scope): string {
  if (b.type === 'choice') return b.options[0];
  if (b.type === 'number') return String(Number(evalNumber(b.expr, scope).toPrecision(8)));
  return b.expr;
}

export const BlanksSchema = z.strictObject({
  ...commonFields,
  kind: z.literal('blanks'),
  text: z.string().min(1),
});

export type BlanksQuestion = z.infer<typeof BlanksSchema>;
export type BlanksAnswer = string[];

export const blanksModel: WidgetModel<BlanksQuestion, BlanksAnswer> = {
  kind: 'blanks',
  schema: BlanksSchema,
  nonTextKeys: ['text'],
  texts(q) {
    return [q.text.replace(BLANK, ' □ ')];
  },
  grade(q, answer, ctx): Grade {
    const parts = blanksOf(q.text).map((b, i) => gradeBlank(b, answer[i] ?? '', ctx.scope));
    return { correct: parts.length > 0 && parts.every(Boolean), parts };
  },
  correctAnswer(q, ctx) {
    return blanksOf(q.text).map((b) => (b.type === 'expression' ? b.expr : blankAnswer(b, ctx.scope)));
  },
  validate(q, ctx) {
    const errs: string[] = [];
    const bs = blanksOf(q.text);
    if (bs.length === 0) errs.push('blanks text has no [[…]] blank');
    for (const b of bs) {
      try {
        if (b.type === 'number') {
          const v = evalNumber(b.expr, ctx.scope);
          if (!Number.isFinite(v)) errs.push(`blank "${b.expr}" is not finite`);
          if (b.abs !== undefined && !(b.abs > 0)) errs.push(`blank "${b.expr}" has a bad tolerance`);
        } else if (b.type === 'choice') {
          if (b.options.length < 2) errs.push('a choice blank needs ≥ 2 options');
          if (new Set(b.options).size !== b.options.length) errs.push('a choice blank repeats an option');
        } else if (!gradeBlank(b, b.expr, ctx.scope))
          errs.push(`expression blank "${b.expr}" can't be evaluated`);
      } catch (e) {
        errs.push(`blank "${'expr' in b ? b.expr : ''}": ${(e as Error).message}`);
      }
    }
    return errs;
  },
  describe(_q, answer) {
    return `Filled: ${answer.join(', ')}`;
  },
  tags() {
    return [];
  },
};
