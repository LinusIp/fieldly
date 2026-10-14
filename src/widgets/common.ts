import { z } from 'zod';
import { DifficultySchema, HintsSchema, VerifyRuleSchema } from '../content/schema';
import { math, type Scope } from '../engine/expr';
import { formatNumber } from '../engine/format';
import { mulberry32 } from '../engine/params';

/** Fields every question has (§7.4); widget schemas add their own and are strict. */
export const commonFields = {
  id: z.string().min(1),
  version: z.number().int().min(1).optional(),
  difficulty: DifficultySchema,
  prompt: z.string(),
  graded: z.boolean().optional(),
  fixedOrder: z.boolean().optional(),
  verify: z.array(VerifyRuleSchema).optional(),
  hints: HintsSchema.optional(),
  explanation: z.string().optional(),
};

export const exprString = z.string().min(1);
export const numOrExpr = z.union([z.number(), z.string().min(1)]);

export function evalIn(expr: number | string, scope: Scope): number {
  if (typeof expr === 'number') return expr;
  const v = math.evaluate(expr, { ...scope });
  if (typeof v !== 'number') throw new Error(`"${expr}" is not a number`);
  return v;
}

/** Normalise typed math: Unicode minus, ×, ·, ÷ and spaces in numbers. */
export function normaliseInput(s: string): string {
  return s
    .replace(/[−–]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/√/g, 'sqrt')
    .replace(/π/g, 'pi')
    .trim();
}

/** Parse a typed number: decimals, fractions such as 1/6, mixed signs, e-notation, "2.5×10^-4". */
export function parseNumber(input: string): number | null {
  const s = normaliseInput(input)
    .replace(/\s+/g, '')
    .replace(/\*10\^\(?(-?\d+)\)?/, 'e$1')
    .replace(/,/g, '');
  if (!s) return null;
  if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return Number(s);
  const frac = s.match(/^([-+]?\d+(?:\.\d+)?)\/([-+]?\d+(?:\.\d+)?)$/);
  if (frac) {
    const d = Number(frac[2]);
    return d === 0 ? null : Number(frac[1]) / d;
  }
  return null;
}

/** Within tolerance: relative `tol` of the target (default 1%), or an absolute tolerance. */
export function withinTolerance(value: number, target: number, tol = 0.01, abs?: number): boolean {
  if (abs !== undefined) return Math.abs(value - target) <= abs;
  return Math.abs(value - target) <= Math.max(tol * Math.abs(target), 1e-9);
}

/** Significant figures typed in a number string ("0.0450" → 3). */
export function sigFigsOf(input: string): number {
  const s = normaliseInput(input).replace(/^[-+]/, '').replace(/e.*$/i, '');
  const digits = s.replace('.', '').replace(/^0+/, '');
  if (!s.includes('.')) return digits.replace(/0+$/, '').length || 1;
  return digits.length || 1;
}

export function fmt(x: number): string {
  return formatNumber(x, { sig: 4 });
}

/**
 * Two expressions are equivalent if they agree at 20 random points of `vars` (relative tolerance
 * 1e-6), skipping points where either side is undefined. At least 5 points must be usable.
 */
export function equivalent(
  a: string,
  b: string,
  vars: Record<string, [number, number]>,
  scopeA: Scope = {},
  scopeB: Scope = {},
  seed = 7,
): boolean {
  const ca = math.compile(normaliseInput(a));
  const cb = math.compile(normaliseInput(b));
  const rng = mulberry32(seed);
  let usable = 0;
  for (let i = 0; i < 20; i++) {
    const point: Scope = {};
    for (const [name, [lo, hi]] of Object.entries(vars)) point[name] = lo + (hi - lo) * rng();
    let va: unknown;
    let vb: unknown;
    try {
      va = ca.evaluate({ ...scopeA, ...point });
      vb = cb.evaluate({ ...scopeB, ...point });
    } catch {
      continue;
    }
    if (typeof va !== 'number' || typeof vb !== 'number' || !Number.isFinite(va) || !Number.isFinite(vb))
      continue;
    usable++;
    if (Math.abs(va - vb) > 1e-6 * Math.max(1, Math.abs(va), Math.abs(vb))) return false;
  }
  return usable >= 5;
}

/** Symbols and function names used in an expression. */
export function namesIn(expr: string): { symbols: Set<string>; functions: Set<string> } {
  const symbols = new Set<string>();
  const functions = new Set<string>();
  const node = math.parse(normaliseInput(expr));
  node.traverse((n) => {
    const f = n as unknown as { isFunctionNode?: boolean; fn?: { name?: string } };
    if (f.isFunctionNode && f.fn?.name) functions.add(f.fn.name);
  });
  node.traverse((n) => {
    const s = n as unknown as { isSymbolNode?: boolean; name?: string };
    if (s.isSymbolNode && s.name && !functions.has(s.name)) symbols.add(s.name);
  });
  return { symbols, functions };
}

/** Seeded Fisher–Yates permutation of 0…n−1. */
export function seededOrder(n: number, seed: number): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  const rng = mulberry32(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
