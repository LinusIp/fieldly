import { all, create, type EvalFunction } from 'mathjs';

/**
 * Shared mathjs instance. Every answer, distractor, template, check and feedback expression
 * in the content goes through here.
 */
export const math = create(all, { number: 'number' });

/** `near(a, b, rel = 0.01)` — true when |a − b| ≤ rel × max(|b|, 1e-9). */
export function near(a: number, b: number, rel = 0.01): boolean {
  return Math.abs(a - b) <= rel * Math.max(Math.abs(b), 1e-9);
}

math.import({ near }, { override: true });

export type Scope = Record<string, unknown>;

const cache = new Map<string, EvalFunction>();

function compiled(expr: string): EvalFunction {
  let fn = cache.get(expr);
  if (!fn) {
    fn = math.compile(expr);
    cache.set(expr, fn);
  }
  return fn;
}

function isNode(v: unknown): v is { evaluate(scope?: Scope): unknown } {
  return typeof v === 'object' && v !== null && (v as { isNode?: boolean }).isNode === true;
}

/** Evaluate an expression. A result that is itself an expression tree (e.g. from `derivative`)
 *  is evaluated again in the same scope, so `derivative('x^2', 'x')` yields a number. */
export function evaluate(expr: string, scope: Scope = {}): unknown {
  // mathjs may write assignments into the scope; give it a copy.
  const s = { ...scope };
  let v = compiled(expr).evaluate(s);
  if (isNode(v)) v = v.evaluate(s);
  return v;
}

export function evalNumber(expr: string, scope: Scope = {}): number {
  const v = evaluate(expr, scope);
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  throw new Error(`Expression "${expr}" did not evaluate to a number (got ${describe(v)})`);
}

export function evalBoolean(expr: string, scope: Scope = {}): boolean {
  const v = evaluate(expr, scope);
  if (typeof v === 'boolean') return v;
  throw new Error(`Expression "${expr}" did not evaluate to a boolean (got ${describe(v)})`);
}

function describe(v: unknown): string {
  if (v === null || v === undefined) return String(v);
  if (typeof v === 'object') return (v as object).constructor?.name ?? 'object';
  return `${typeof v} ${String(v)}`;
}
