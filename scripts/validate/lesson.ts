/** Lesson rules (§2.2, §2.4, §2.7, §7.4, §7.7, §13.2). */
import {
  GENERATIVE_KINDS,
  type ChallengeScreen,
  type Lesson,
  type Question,
  type QuestionKind,
  type Screen,
  type Step,
} from '../../src/content/schema';
import type { Scope } from '../../src/engine/expr';
import { renderTemplate } from '../../src/engine/template';
import {
  validateCodeVariant,
  validateInteractiveRef,
  validateInteractiveVariant,
  validateTasks,
} from './interactive';
import { isGraded, validateQuestion, type QuestionCheck } from './questions';
import {
  numbersIn,
  proseWordCount,
  renderAndCheck,
  scopesOf,
  textLeaves,
  wordCount,
  type Reporter,
} from './util';

export interface LessonCheck {
  rep: Reporter;
  conceptIds: ReadonlySet<string>;
  misconceptions: ReadonlySet<string>;
  usedMisconceptions: Set<string>;
  unitBase?: number;
  runCode: boolean;
}

const TRACKS = ['easier', 'standard', 'harder'] as const;

function variantsOf(step: Step): [string, Question][] {
  return TRACKS.filter((k) => step.variants[k]).map((k) => [k, step.variants[k]!]);
}

function maxRun<T>(xs: T[]): number {
  let best = 0;
  let run = 0;
  xs.forEach((x, i) => {
    run = i > 0 && xs[i - 1] === x ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

export function validateLesson(lesson: Lesson, chk: LessonCheck): void {
  const { rep } = chk;
  const err = (m: string, w?: string) => rep.error(m, w);
  const warn = (m: string, w?: string) => rep.warn(m, w);

  for (const k of lesson.concepts) if (!chk.conceptIds.has(k)) err(`unknown concept "${k}"`);

  const scopes = scopesOf(lesson.params, lesson.derived, (m) => err(m));
  const screens = lesson.screens;
  const ids = new Set<string>();
  for (const s of [...screens, ...(lesson.extras ?? [])]) {
    if (ids.has(s.id)) err(`duplicate screen/step id "${s.id}"`);
    ids.add(s.id);
  }

  // ── Shape (§2.2) ───────────────────────────────────────────────────────────
  if (screens.length < 15 || screens.length > 25) err(`${screens.length} screens (needs 15–25)`);
  if (screens[0]?.type !== 'hook') err('the first screen must be a hook');
  if (screens[screens.length - 1]?.type !== 'recap') err('the last screen must be a recap');
  const count = (t: Screen['type']) => screens.filter((s) => s.type === t).length;
  if (count('explore') < 2) err(`${count('explore')} explore screens (needs ≥ 2)`);
  if (count('challenge') !== 2) err(`${count('challenge')} challenges (needs exactly 2)`);
  if (count('concept') / screens.length > 0.25) err('more than 25% of screens are concept cards');
  screens.forEach((s, i) => {
    if (s.type === 'concept' && screens[i - 1]?.type === 'concept') err('two concept cards in a row', s.id);
    if (s.type === 'concept' && proseWordCount(s.body) > 80)
      err(`concept card is ${proseWordCount(s.body)} words (limit 80)`, s.id);
    if (s.type === 'explore') {
      if (s.tasks.length < 2 || s.tasks.length > 5)
        err(`explore has ${s.tasks.length} tasks (needs 2–5)`, s.id);
      if (!s.tasks.some((t) => 'goal' in t)) err('explore needs at least one goal', s.id);
      if (wordCount(s.intro) > 40) warn(`explore intro is ${wordCount(s.intro)} words (limit 40)`, s.id);
    }
  });
  if (!(lesson.extras ?? []).some((x) => x.role === 'remediation'))
    err('needs ≥ 1 remediation step in extras');

  // ── Steps (§2.7, §7.4) ─────────────────────────────────────────────────────
  const questionScreens = screens.filter(
    (s): s is Extract<Screen, { type: 'question' }> => s.type === 'question',
  );
  const core = questionScreens.filter((s) => s.role === 'core');
  if (core.length < 6) err(`${core.length} core steps (needs ≥ 6)`);
  let prevStd = 0;
  const stdDiffs: number[] = [];
  for (const step of questionScreens) {
    if (step.role === 'core') {
      const { easier, standard, harder } = step.variants;
      if (!easier || !harder) err('core steps need easier, standard and harder variants', step.id);
      else if (!(easier.difficulty < standard.difficulty && standard.difficulty < harder.difficulty))
        err(
          `difficulty must strictly increase easier < standard < harder (got ${easier.difficulty}, ${standard.difficulty}, ${harder.difficulty})`,
          step.id,
        );
      if (standard.difficulty < 2 || standard.difficulty > 4) err('standard difficulty must be 2–4', step.id);
      if (standard.difficulty < prevStd)
        err('standard difficulties must not decrease through the lesson', step.id);
      prevStd = standard.difficulty;
      stdDiffs.push(standard.difficulty);
      if (!step.establishes) err('core steps need `establishes`', step.id);
      if (!step.standaloneContext) err('core steps need `standaloneContext`', step.id);
    } else if (step.variants.easier || step.variants.harder)
      err(`${step.role} steps have a standard variant only`, step.id);
    if (!chk.conceptIds.has(step.concept)) err(`unknown concept "${step.concept}"`, step.id);
  }
  for (const x of lesson.extras ?? []) {
    if (x.role === 'core' || x.role === 'check') err('extras are remediation or bonus steps', x.id);
    if (x.variants.easier || x.variants.harder) err(`${x.role} steps have a standard variant only`, x.id);
    if (x.role === 'remediation' && !core.some((c) => c.id === x.remediates))
      err(`remediates "${x.remediates}" is not a core step`, x.id);
    if (!chk.conceptIds.has(x.concept)) err(`unknown concept "${x.concept}"`, x.id);
  }
  if (chk.unitBase !== undefined && stdDiffs.length) {
    const mean = stdDiffs.reduce((a, b) => a + b, 0) / stdDiffs.length;
    if (Math.abs(mean - chk.unitBase) > 0.5)
      warn(
        `mean core standard difficulty ${mean.toFixed(2)} is more than 0.5 from the unit's base ${chk.unitBase}`,
      );
  }

  // ── Variety (§2.2) ─────────────────────────────────────────────────────────
  const kindsOn = (track: (typeof TRACKS)[number]): QuestionKind[] =>
    questionScreens.map((s) => (s.variants[track] ?? s.variants.standard).kind);
  const std = kindsOn('standard');
  if (new Set(std).size < 5) err(`standard track uses ${new Set(std).size} question kinds (needs ≥ 5)`);
  if (std.length && std.filter((k) => k === 'mcq').length / std.length > 0.35)
    err('mcq is more than 35% of question screens on the standard track');
  if (core.filter((s) => GENERATIVE_KINDS.includes(s.variants.standard.kind)).length < 2)
    err('needs ≥ 2 core steps with a generative kind on the standard track');
  if (maxRun(std) > 2) err('a question kind appears more than twice in a row on the standard track');
  for (const track of TRACKS) {
    const ks = kindsOn(track);
    if (ks.length && ks.filter((k) => k === 'mcq').length / ks.length > 0.5)
      err(`mcq is more than 50% of question screens on the ${track} track`);
    if (maxRun(ks) > 3) err(`a question kind appears more than 3 times in a row on the ${track} track`);
  }

  // ── Chain links (§2.4) ─────────────────────────────────────────────────────
  const order = new Map(screens.map((s, i) => [s.id, i]));
  let usesLinks = 0;
  let clueLinks = 0;
  for (const s of screens) {
    if (s.type !== 'question' && s.type !== 'challenge') continue;
    const at = order.get(s.id)!;
    for (const u of s.uses ?? []) {
      usesLinks++;
      const j = order.get(u);
      if (j === undefined || screens[j].type !== 'question')
        err(`uses "${u}", which is not a question step`, s.id);
      else if (j >= at) err(`uses "${u}", which comes later`, s.id);
    }
    if (s.type === 'question')
      for (const cf of s.clueFor ?? []) {
        clueLinks++;
        const j = order.get(cf);
        if (j === undefined || (screens[j].type !== 'question' && screens[j].type !== 'challenge'))
          err(`clueFor "${cf}" is not a later step or challenge`, s.id);
        else if (j <= at) err(`clueFor "${cf}" comes earlier`, s.id);
      }
  }
  if (usesLinks < 2) err(`needs ≥ 2 uses links (has ${usesLinks})`);
  if (clueLinks < 1) err('needs ≥ 1 clueFor link');
  const lastCore = core[core.length - 1];
  if (lastCore && (lastCore.uses ?? []).length < 2)
    err('the last core step must use ≥ 2 earlier steps', lastCore.id);

  // ── Questions, interactives and text, for every param set ──────────────────
  const qc = (where: string, sc: Scope[] = scopes): QuestionCheck => ({
    rep,
    where,
    scopes: sc,
    misconceptions: chk.misconceptions,
    usedMisconceptions: chk.usedMisconceptions,
  });
  const textCheck = (obj: unknown, where: string, sc: Scope[] = scopes) => {
    for (const scope of sc)
      for (const leaf of textLeaves(obj)) {
        const { error } = renderAndCheck(leaf.text, scope);
        if (error) rep.errorOnce(`${where}:${leaf.path}:${error}`, `${leaf.path}: ${error}`, where);
      }
  };

  for (const s of screens) {
    switch (s.type) {
      case 'hook':
        textCheck(
          {
            prompt: s.prompt,
            caption: s.reveal?.caption,
            instruction: s.reveal?.instruction,
            compare: s.compare,
          },
          s.id,
        );
        validateQuestion(s.predict, qc(`${s.id}.predict`));
        if (!s.reveal && !s.compare) err('a hook needs a reveal or a try-first comparison', s.id);
        if (s.reveal)
          for (const scope of scopes)
            validateTasks(s.reveal.interactive, s.reveal.tasks ?? [], scope, rep, `${s.id}.reveal`, (q, w) =>
              validateQuestion(q, qc(w, [scope])),
            );
        break;
      case 'explore':
        textCheck(
          {
            intro: s.intro,
            takeaway: s.takeaway,
            goals: s.tasks.map((t) => ('goal' in t ? [t.goal, t.hint] : null)),
          },
          s.id,
        );
        for (const scope of scopes)
          validateTasks(s.interactive, s.tasks, scope, rep, s.id, (q, w) =>
            validateQuestion(q, qc(w, [scope])),
          );
        break;
      case 'concept':
        textCheck({ body: s.body }, s.id);
        if (s.visual)
          for (const scope of scopes) validateInteractiveRef(s.visual, scope, rep, `${s.id}.visual`);
        break;
      case 'worked':
        if (!chk.conceptIds.has(s.concept)) err(`unknown concept "${s.concept}"`, s.id);
        textCheck(
          { problem: s.problem, steps: s.steps.map((x) => x.text.replace(/\[\[\??[^\]]*\]\]/g, '□')) },
          s.id,
        );
        for (const x of s.steps)
          for (const m of x.text.matchAll(/\[\[\??([^\]]*)\]\]/g))
            for (const scope of scopes) {
              try {
                renderTemplate(`{{${m[1].replace(/^=\s*/, '').split('±')[0].split('|')[0]}}}`, scope);
              } catch (e) {
                rep.errorOnce(`${s.id}:blank:${m[1]}`, `blank "${m[1]}": ${(e as Error).message}`, s.id);
              }
            }
        break;
      case 'question':
        textCheck({ establishes: s.establishes, standaloneContext: s.standaloneContext }, s.id);
        for (const [vk, q] of variantsOf(s)) validateQuestion(q, qc(`${s.id}.${vk}`));
        break;
      case 'challenge':
        validateChallenge(s, scopes, chk, qc);
        break;
      case 'recap':
        textCheck({ takeaways: s.takeaways, explain: s.explain }, s.id);
        break;
    }
  }
  for (const x of lesson.extras ?? [])
    for (const [vk, q] of variantsOf(x)) validateQuestion(q, qc(`${x.id}.${vk}`));

  validatePractice(lesson, chk);
}

function validateChallenge(
  ch: ChallengeScreen,
  lessonScopes: Scope[],
  chk: LessonCheck,
  qc: (where: string, sc?: Scope[]) => QuestionCheck,
): void {
  const { rep } = chk;
  if (!chk.conceptIds.has(ch.concept)) rep.error(`unknown concept "${ch.concept}"`, ch.id);
  const scopes = ch.params ? scopesOf(ch.params, ch.derived, (m) => rep.error(m, ch.id)) : lessonScopes;
  const vs = ch.variants;
  if (!(vs.easier.difficulty < vs.standard.difficulty && vs.standard.difficulty < vs.harder.difficulty))
    rep.error('challenge difficulty must strictly increase easier < standard < harder', ch.id);
  for (const vk of TRACKS) {
    const v = vs[vk];
    const where = `${ch.id}.${vk}`;
    for (const scope of scopes)
      for (const leaf of textLeaves({
        goal: v.goal,
        hints: v.hints,
        explanation: v.explanation,
        feedback: v.feedback?.map((f) => f.say),
      })) {
        const { error } = renderAndCheck(leaf.text, scope);
        if (error) rep.errorOnce(`${where}:${leaf.path}:${error}`, `${leaf.path}: ${error}`, where);
      }
    for (const f of v.feedback ?? [])
      if (f.misconception) {
        chk.usedMisconceptions.add(f.misconception);
        if (!chk.misconceptions.has(f.misconception))
          rep.error(`unknown misconception "${f.misconception}"`, where);
      }
    if (v.question) {
      if (ch.interactive)
        rep.error('a challenge is either interactive-backed or widget-backed, not both', where);
      if (v.question.kind === 'mcq' || v.question.kind === 'multi')
        rep.error('widget-backed challenges need a generative or arranging widget (not mcq/multi)', where);
      validateQuestion(v.question, qc(`${where}.question`, scopes));
      continue;
    }
    if (!ch.interactive) {
      rep.error(
        'interactive-backed challenges need `interactive` (or give each variant a `question`)',
        where,
      );
      continue;
    }
    for (const scope of scopes) validateInteractiveVariant(ch.interactive, v, scope, rep, where);
    if (ch.interactive === 'code-runner' && chk.runCode) validateCodeVariant(v, rep, where);
    if ((v.feedback ?? []).length < 3) rep.warn('challenges should have ≥ 3 feedback rules (§15.6)', where);
  }
}

function validatePractice(lesson: Lesson, chk: LessonCheck): void {
  const { rep } = chk;
  const pool = lesson.practice;
  if (pool.length < 12) rep.error(`practice pool has ${pool.length} items (needs ≥ 12)`);
  const kinds = new Set(pool.map((p) => p.kind));
  if (kinds.size < 3) rep.error(`practice pool uses ${kinds.size} kinds (needs ≥ 3)`);
  for (const k of lesson.concepts)
    if (!pool.some((p) => p.concept === k)) rep.error(`practice pool doesn't cover concept "${k}"`);
  if (pool.filter((p) => p.difficulty >= 4).length < 3)
    rep.error('practice pool needs ≥ 3 items at band ≥ 4');
  if (!pool.some((p) => p.difficulty === 5)) rep.error('practice pool needs ≥ 1 item at band 5');
  const ids = new Set<string>();
  for (const item of pool) {
    const where = `practice.${item.id}`;
    if (ids.has(item.id)) rep.error(`duplicate practice item id "${item.id}"`, where);
    ids.add(item.id);
    if (!chk.conceptIds.has(item.concept)) rep.error(`unknown concept "${item.concept}"`, where);
    if (/\bQ\d+\b|\babove\b/.test(item.prompt))
      rep.warn('practice items must stand alone (mentions "Qn" or "above")', where);
    const scopes = scopesOf(item.params, item.derived, (m) => rep.error(m, where));
    if (item.params) {
      const versions = new Set(
        scopes.map((s) => {
          try {
            return renderTemplate(item.prompt, s);
          } catch {
            return '';
          }
        }),
      );
      if (versions.size < 2) rep.error('params must give ≥ 2 visibly different versions', where);
    }
    const { concept: _c, params: _p, derived: _d, method: _m, ...question } = item;
    validateQuestion(question as Question, {
      rep,
      where,
      scopes,
      misconceptions: chk.misconceptions,
      usedMisconceptions: chk.usedMisconceptions,
    });
  }
}

/** Numbers in a worked example that match a whole param set (quality warning). */
export function workedExampleWarnings(lesson: Lesson, rep: Reporter): void {
  if (!lesson.params || !('sets' in lesson.params)) return;
  for (const s of lesson.screens) {
    if (s.type !== 'worked') continue;
    const nums = numbersIn([s.problem, ...s.steps.map((x) => x.text)].join(' '));
    for (const set of lesson.params.sets) {
      const vals = Object.values(set);
      if (vals.length > 0 && vals.every((v) => nums.has(v)))
        rep.warn(`worked example uses the same numbers as param set ${JSON.stringify(set)}`, s.id);
    }
  }
}

/** Kinds used anywhere in the lesson (for the unit-level find-the-error warning). */
export function kindsUsed(lesson: Lesson): Set<QuestionKind> {
  const out = new Set<QuestionKind>();
  for (const s of lesson.screens)
    if (s.type === 'question') for (const [, q] of variantsOf(s)) out.add(q.kind);
  for (const x of lesson.extras ?? []) for (const [, q] of variantsOf(x)) out.add(q.kind);
  for (const p of lesson.practice) out.add(p.kind);
  return out;
}

export { isGraded };
