/** Question checks shared by lesson steps, predictions, practice items, speed items and widget challenges. */
import type { Question } from '../../src/content/schema';
import { evaluate, evalNumber, type Scope } from '../../src/engine/expr';
import { mulberry32 } from '../../src/engine/params';
import { widgetModels } from '../../src/widgets/models';
import { initialScopeOf, validateInteractiveRef } from './interactive';
import { renderAndCheck, textLeaves, wordCount, type Reporter } from './util';

export const EXPLANATION_LABELS = ['**Answer:**', '**Why:**', '**Common mistakes:**', '**Connects to:**'];

export interface QuestionCheck {
  rep: Reporter;
  where: string;
  scopes: Scope[];
  misconceptions: ReadonlySet<string>;
  usedMisconceptions: Set<string>;
  /** Speed-round items have no hints or explanations (§7.7). */
  speed?: boolean;
}

const TAG_DUPLICATES_ALLOWED = new Set(['categorize', 'hotspot']);

export function isGraded(q: Question): boolean {
  return q.graded !== false && q.kind !== 'explain';
}

export function validateQuestion(q: Question, chk: QuestionCheck): void {
  const { rep, where } = chk;
  const model = widgetModels[q.kind];
  if (!model) {
    rep.error(`no "${q.kind}" widget exists yet`, where);
    return;
  }
  const parsed = model.schema.safeParse(q);
  if (!parsed.success) {
    rep.error(
      parsed.error.issues
        .slice(0, 6)
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; '),
      where,
    );
    return;
  }
  const question = parsed.data as Question;

  if (isGraded(question) && !chk.speed) {
    if (!question.hints) rep.error('graded questions need hints (nudge and partial)', where);
    if (!question.explanation) rep.error('graded questions need an explanation', where);
    else
      for (const label of EXPLANATION_LABELS)
        if (!question.explanation.includes(label)) rep.error(`explanation is missing ${label}`, where);
  }
  if (wordCount(question.prompt) > 80)
    rep.warn(`prompt is ${wordCount(question.prompt)} words (limit 80)`, where);

  const tags = model.tags(question);
  for (const t of tags) {
    chk.usedMisconceptions.add(t);
    if (!chk.misconceptions.has(t)) rep.error(`unknown misconception "${t}"`, where);
  }
  if (!TAG_DUPLICATES_ALLOWED.has(question.kind)) {
    const seen = new Set<string>();
    for (const t of tags) {
      if (seen.has(t))
        rep.warnOnce(`${where}:dup:${t}`, `misconception "${t}" is used twice in one question`, where);
      seen.add(t);
    }
  }

  const skip = new Set(model.nonTextKeys ?? []);
  chk.scopes.forEach((scope, si) => {
    const ctx = { scope, seed: 1000 + si };
    const tag = JSON.stringify(scope);
    for (const leaf of textLeaves(question, '', skip)) {
      const { error } = renderAndCheck(leaf.text, scope);
      if (error) rep.errorOnce(`${where}:${leaf.path}:${error}`, `${leaf.path}: ${error}`, where);
    }
    try {
      for (const t of model.texts?.(question, ctx) ?? []) {
        const { error } = renderAndCheck(t, scope);
        if (error) rep.errorOnce(`${where}:texts:${error}`, error, where);
      }
      for (const msg of model.validate(question, ctx))
        rep.errorOnce(`${where}:v:${msg}`, `${msg} (params ${tag})`, where);
      if (isGraded(question)) {
        const g = model.grade(question, model.correctAnswer(question, ctx), ctx);
        if (!g.correct)
          rep.errorOnce(
            `${where}:self`,
            `the correct answer does not grade as correct (params ${tag})`,
            where,
          );
      }
    } catch (e) {
      rep.errorOnce(`${where}:x:${(e as Error).message}`, `${(e as Error).message} (params ${tag})`, where);
    }
    validateVerify(question, scope, chk, tag);
  });

  // Interactive surfaces (hotspot `on`, interactive widget `on`) must be valid configs.
  const on = (question as { on?: unknown }).on;
  if (on) for (const scope of chk.scopes) validateInteractiveRef(on, scope, rep, `${where}.on`);
}

function validateVerify(q: Question, scope: Scope, chk: QuestionCheck, tag: string): void {
  const { rep, where } = chk;
  const on = (q as { on?: unknown }).on;
  (q.verify ?? []).forEach((rule, vi) => {
    try {
      if ('expr' in rule) {
        // Rules for hotspot/interactive questions see the interactive's initial-state scope (§7.4).
        const extra = on ? (initialScopeOf(on, scope) ?? {}) : {};
        const r = evaluate(rule.expr, { ...scope, ...extra });
        if (r !== true)
          rep.errorOnce(
            `${where}:verify${vi}`,
            `verify[${vi}] "${rule.expr}" is not true (params ${tag})`,
            where,
          );
        return;
      }
      const rng = mulberry32(1234 + vi);
      for (let t = 0; t < 20; t++) {
        const s: Scope = { ...scope };
        for (const [name, [lo, hi]] of Object.entries(rule.vars ?? {})) s[name] = lo + (hi - lo) * rng();
        const l = evalNumber(rule.lhs, s);
        const r = evalNumber(rule.rhs, s);
        if (!Number.isFinite(l) || !Number.isFinite(r))
          throw new Error(`non-finite value at ${JSON.stringify(s)}`);
        if (Math.abs(l - r) > 1e-9 * Math.max(1, Math.abs(l), Math.abs(r)))
          throw new Error(`lhs ${l} ≠ rhs ${r} at ${JSON.stringify(s)}`);
      }
    } catch (e) {
      rep.errorOnce(`${where}:verify${vi}`, `verify[${vi}]: ${(e as Error).message}`, where);
    }
  });
}
