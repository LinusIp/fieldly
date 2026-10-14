import { z } from 'zod';
import { math, type Scope } from '../../engine/expr';
import { commonFields, equivalent, exprString, namesIn, normaliseInput } from '../common';
import type { Grade, WidgetModel } from '../types';

/**
 * `expression` (§9.2): type a formula. Equivalent if equal at 20 random points in `vars` (points
 * where either side is undefined are skipped). The answer may use lesson params; the learner's
 * expression may use only `vars`, `allowedSymbols` and constants (pi, e).
 */

const varRange = z.tuple([z.number(), z.number()]);

export const ExpressionSchema = z.strictObject({
  ...commonFields,
  kind: z.literal('expression'),
  answer: z.strictObject({ expr: exprString, vars: z.record(z.string(), varRange) }),
  allowedSymbols: z.array(z.string()).optional(),
  wrongAnswers: z.array(z.strictObject({ expr: exprString, misconception: z.string() })).optional(),
  /** Functions the learner may not use (e.g. `derivative`). */
  forbid: z.array(z.string()).optional(),
});

export type ExpressionQuestion = z.infer<typeof ExpressionSchema>;
export type ExpressionAnswer = string;

const CONSTANTS = new Set(['pi', 'e']);

/** The answer with lesson params replaced by their values, so it uses only the learner's symbols. */
export function substituteParams(expr: string, scope: Scope, keep: Set<string>): string {
  const node = math.parse(normaliseInput(expr)).transform((n) => {
    const s = n as unknown as { isSymbolNode?: boolean; name?: string };
    if (s.isSymbolNode && s.name && !keep.has(s.name) && typeof scope[s.name] === 'number')
      return new math.ConstantNode(scope[s.name] as number);
    return n;
  });
  return node.toString();
}

/** Why an input can't be graded, or null. */
export function expressionProblem(q: ExpressionQuestion, input: string): string | null {
  let names: ReturnType<typeof namesIn>;
  try {
    names = namesIn(input);
  } catch {
    return "That expression can't be read.";
  }
  const allowed = new Set([...Object.keys(q.answer.vars), ...(q.allowedSymbols ?? []), ...CONSTANTS]);
  for (const s of names.symbols) if (!allowed.has(s)) return `“${s}” isn't one of the symbols you can use.`;
  for (const f of names.functions) {
    if (q.forbid?.includes(f)) return `Don't use ${f}() here.`;
    if (!(f in math)) return `Unknown function ${f}().`;
  }
  return null;
}

export const expressionModel: WidgetModel<ExpressionQuestion, ExpressionAnswer> = {
  kind: 'expression',
  schema: ExpressionSchema,
  grade(q, answer, ctx): Grade {
    const input = normaliseInput(answer);
    const problem = expressionProblem(q, input);
    if (problem) return { correct: false, interpretation: problem };
    const vars = q.answer.vars;
    if (equivalent(q.answer.expr, input, vars, ctx.scope, {})) return { correct: true };
    for (const w of q.wrongAnswers ?? [])
      if (equivalent(w.expr, input, vars, ctx.scope, {}))
        return { correct: false, misconception: w.misconception };
    return { correct: false };
  },
  correctAnswer(q, ctx) {
    return substituteParams(q.answer.expr, ctx.scope, new Set(Object.keys(q.answer.vars)));
  },
  validate(q, ctx) {
    const errs: string[] = [];
    if (!equivalent(q.answer.expr, q.answer.expr, q.answer.vars, ctx.scope, ctx.scope))
      errs.push(`answer "${q.answer.expr}" can't be evaluated over its vars`);
    for (const w of q.wrongAnswers ?? [])
      if (equivalent(q.answer.expr, w.expr, q.answer.vars, ctx.scope, ctx.scope))
        errs.push(`wrong answer "${w.expr}" is equivalent to the answer`);
    return errs;
  },
  describe(_q, answer) {
    return `Typed ${answer}`;
  },
  tags(q) {
    return (q.wrongAnswers ?? []).map((w) => w.misconception);
  },
};
