/**
 * Content validator (§13.2). `npm run content:check` runs it; `build-content.ts` reuses it.
 * Errors fail CI; warnings are printed.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import katex from 'katex';
import YAML from 'yaml';
import type { z } from 'zod';
import { challengeLogic } from '../src/challenges/logic';
import { makeResolveCtx } from '../src/challenges/types';
import {
  ConceptsSchema,
  LessonSchema,
  MisconceptionsSchema,
  SubjectSchema,
  SubjectsListSchema,
  type Lesson,
  type Misconception,
  type Question,
  type Step,
  type Subject,
} from '../src/content/schema';
import type { ContentIndex, LessonMeta, SubjectContent, SubjectMeta } from '../src/content/types';
import { evalBoolean, evalNumber, evaluate, type Scope } from '../src/engine/expr';
import { buildOptions } from '../src/engine/options';
import { applyDerived, enumerateParamValues, mulberry32 } from '../src/engine/params';
import { renderTemplate } from '../src/engine/template';
import { flushCodeChecks, runCodeChecks } from './code-check';

export interface Issue {
  file: string;
  where?: string;
  message: string;
}

export interface ValidationResult {
  errors: Issue[];
  warnings: Issue[];
  index: ContentIndex;
  subjects: Record<string, SubjectContent>;
}

const EXPLANATION_LABELS = ['**Answer:**', '**Why:**', '**Common mistakes:**', '**Connects to:**'];

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

function formatZodError(err: z.ZodError): string {
  return err.issues
    .slice(0, 8)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
}

/** Every `$…$` and `$$…$$` segment in a Markdown string. */
export function mathSegments(src: string): { tex: string; display: boolean }[] {
  const out: { tex: string; display: boolean }[] = [];
  // Strip fenced and inline code first — `$` there is not math.
  let s = src.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex: string) => {
    out.push({ tex, display: true });
    return ' ';
  });
  for (const m of s.matchAll(/(?<!\\)\$([^$]+?)(?<!\\)\$/g)) out.push({ tex: m[1], display: false });
  return out;
}

export function checkKatex(src: string): string | null {
  for (const seg of mathSegments(src)) {
    try {
      katex.renderToString(seg.tex, { throwOnError: true, displayMode: seg.display, strict: 'ignore' });
    } catch (e) {
      return `KaTeX: ${(e as Error).message.split('\n')[0]} in "${seg.tex.trim().slice(0, 80)}"`;
    }
  }
  return null;
}

function readYaml(file: string): unknown {
  return YAML.parse(readFileSync(file, 'utf8'), { prettyErrors: true, merge: true });
}

function numbersIn(s: string): Set<number> {
  const out = new Set<number>();
  for (const m of s.matchAll(/(?<![\w.])\d+(?:\.\d+)?(?![\w.]*\d)/g)) out.add(Number(m[0]));
  return out;
}

class Collector {
  errors: Issue[] = [];
  warnings: Issue[] = [];
  constructor(private root: string) {}
  rel(file: string): string {
    return relative(this.root, file).replace(/\\/g, '/');
  }
  error(file: string, message: string, where?: string) {
    this.errors.push({ file: this.rel(file), where, message });
  }
  warn(file: string, message: string, where?: string) {
    this.warnings.push({ file: this.rel(file), where, message });
  }
}

function allQuestions(step: Step): [string, Question][] {
  return (['easier', 'standard', 'harder'] as const)
    .filter((k) => step.variants[k])
    .map((k) => [k, step.variants[k]!]);
}

interface SubjectCtx {
  subject: Subject;
  conceptIds: Set<string>;
  misconceptions: Map<string, Misconception>;
  listedLessonIds: Set<string>;
  usedMisconceptions: Set<string>;
  unitBase: Map<string, number>;
}

export function validateContent(contentDir: string, opts: { runCode?: boolean } = {}): ValidationResult {
  const root = resolve(contentDir, '..');
  const c = new Collector(root);
  const index: ContentIndex = { builtAt: new Date().toISOString(), subjects: [] };
  const subjects: Record<string, SubjectContent> = {};

  const subjectsFile = join(contentDir, 'subjects.yaml');
  if (!existsSync(subjectsFile)) {
    c.error(subjectsFile, 'missing subjects.yaml');
    return { errors: c.errors, warnings: c.warnings, index, subjects };
  }
  let subjectIds: string[] = [];
  try {
    const parsed = SubjectsListSchema.safeParse(readYaml(subjectsFile));
    if (!parsed.success) c.error(subjectsFile, formatZodError(parsed.error));
    else subjectIds = parsed.data;
  } catch (e) {
    c.error(subjectsFile, (e as Error).message);
  }
  if (new Set(subjectIds).size !== subjectIds.length) c.error(subjectsFile, 'duplicate subject id');

  // Pass 1: syllabus manifests, concepts, misconceptions.
  const ctxs = new Map<string, SubjectCtx>();
  const allListedLessons = new Set<string>();
  const seenIds = new Map<string, string>();
  const claim = (id: string, file: string, what: string) => {
    const prev = seenIds.get(id);
    if (prev) c.error(file, `duplicate id "${id}" (${what}; also ${prev})`);
    else seenIds.set(id, what);
  };

  for (const sid of subjectIds) {
    const dir = join(contentDir, sid);
    const subjectFile = join(dir, 'subject.yaml');
    const conceptsFile = join(dir, 'concepts.yaml');
    const miscFile = join(dir, 'misconceptions.yaml');
    if (!existsSync(subjectFile)) {
      c.error(subjectFile, `subject "${sid}" has no subject.yaml`);
      continue;
    }
    let subject: Subject;
    try {
      const parsed = SubjectSchema.safeParse(readYaml(subjectFile));
      if (!parsed.success) {
        c.error(subjectFile, formatZodError(parsed.error));
        continue;
      }
      subject = parsed.data;
    } catch (e) {
      c.error(subjectFile, (e as Error).message);
      continue;
    }
    if (subject.id !== sid) c.error(subjectFile, `id "${subject.id}" does not match directory "${sid}"`);
    claim(subject.id, subjectFile, 'subject');

    const conceptIds = new Set<string>();
    if (!existsSync(conceptsFile)) c.error(conceptsFile, 'missing concepts.yaml');
    else {
      try {
        const parsed = ConceptsSchema.safeParse(readYaml(conceptsFile));
        if (!parsed.success) c.error(conceptsFile, formatZodError(parsed.error));
        else
          for (const k of parsed.data) {
            if (conceptIds.has(k.id)) c.error(conceptsFile, `duplicate concept "${k.id}"`);
            conceptIds.add(k.id);
          }
        subjects[sid] = {
          id: sid,
          concepts: parsed.success ? parsed.data : [],
          misconceptions: [],
          lessons: {},
        };
      } catch (e) {
        c.error(conceptsFile, (e as Error).message);
      }
    }
    subjects[sid] ??= { id: sid, concepts: [], misconceptions: [], lessons: {} };

    const misconceptions = new Map<string, Misconception>();
    if (existsSync(miscFile)) {
      try {
        const raw = readYaml(miscFile) ?? [];
        const parsed = MisconceptionsSchema.safeParse(raw);
        if (!parsed.success) c.error(miscFile, formatZodError(parsed.error));
        else
          for (const m of parsed.data) {
            if (misconceptions.has(m.id)) c.error(miscFile, `duplicate misconception "${m.id}"`);
            misconceptions.set(m.id, m);
          }
        subjects[sid].misconceptions = [...misconceptions.values()];
      } catch (e) {
        c.error(miscFile, (e as Error).message);
      }
    }

    const listed = new Set<string>();
    const unitBase = new Map<string, number>();
    const meta: SubjectMeta = {
      id: subject.id,
      title: subject.title,
      short: subject.short,
      description: subject.description,
      prerequisites: subject.prerequisites,
      background: subject.background,
      units: [],
    };
    let prevLesson: string | undefined;
    subject.units.forEach((unit, ui) => {
      const expectedUnit = `${sid}.u${ui + 1}`;
      if (unit.id !== expectedUnit) c.error(subjectFile, `unit id "${unit.id}" should be "${expectedUnit}"`);
      claim(unit.id, subjectFile, 'unit');
      unitBase.set(unit.id, unit.baseDifficulty);
      const unitMeta = {
        id: unit.id,
        title: unit.title,
        baseDifficulty: unit.baseDifficulty,
        lessons: [] as LessonMeta[],
      };
      unit.lessons.forEach((l, li) => {
        const expected = `${unit.id}.l${li + 1}`;
        if (l.id !== expected) c.error(subjectFile, `lesson id "${l.id}" should be "${expected}"`);
        claim(l.id, subjectFile, 'lesson');
        listed.add(l.id);
        allListedLessons.add(l.id);
        for (const k of l.concepts)
          if (!conceptIds.has(k)) c.error(subjectFile, `unknown concept "${k}"`, l.id);
        unitMeta.lessons.push({
          id: l.id,
          title: l.title,
          concepts: l.concepts,
          prerequisites: l.prerequisites ?? (prevLesson ? [prevLesson] : []),
          available: false,
        });
        prevLesson = l.id;
      });
      meta.units.push(unitMeta);
    });
    index.subjects.push(meta);
    ctxs.set(sid, {
      subject,
      conceptIds,
      misconceptions,
      listedLessonIds: listed,
      usedMisconceptions: new Set(),
      unitBase,
    });
  }

  // Subject prerequisites and misconception `lessons` refer to known things.
  for (const [sid, ctx] of ctxs) {
    const subjectFile = join(contentDir, sid, 'subject.yaml');
    for (const p of ctx.subject.prerequisites)
      if (!ctxs.has(p)) c.error(subjectFile, `prerequisite subject "${p}" does not exist`);
    for (const unit of ctx.subject.units)
      for (const l of unit.lessons)
        for (const p of l.prerequisites ?? [])
          if (!allListedLessons.has(p))
            c.error(subjectFile, `prerequisite lesson "${p}" is not listed`, l.id);
    for (const m of ctx.misconceptions.values())
      for (const l of m.lessons)
        if (!allListedLessons.has(l))
          c.error(join(contentDir, sid, 'misconceptions.yaml'), `lesson "${l}" is not listed`, m.id);
  }

  // Pass 2: lesson files.
  for (const [sid, ctx] of ctxs) {
    const dir = join(contentDir, sid);
    const lessonFiles: string[] = [];
    for (const u of readdirSync(dir)) {
      const ud = join(dir, u);
      if (!statSync(ud).isDirectory()) continue;
      for (const f of readdirSync(ud))
        if (f.endsWith('.yaml') || f.endsWith('.yml')) lessonFiles.push(join(ud, f));
    }
    for (const file of lessonFiles) {
      const m = relative(dir, file)
        .replace(/\\/g, '/')
        .match(/^(u\d+)\/(l\d+)\.ya?ml$/);
      if (!m) {
        c.error(file, 'lesson files must be named <subject>/u<N>/l<M>.yaml');
        continue;
      }
      const expectedId = `${sid}.${m[1]}.${m[2]}`;
      let lesson: Lesson;
      try {
        const parsed = LessonSchema.safeParse(readYaml(file));
        if (!parsed.success) {
          c.error(file, formatZodError(parsed.error));
          continue;
        }
        lesson = parsed.data;
      } catch (e) {
        c.error(file, (e as Error).message);
        continue;
      }
      if (lesson.id !== expectedId)
        c.error(file, `id "${lesson.id}" does not match file path (${expectedId})`);
      if (!ctx.listedLessonIds.has(lesson.id))
        c.error(file, `lesson "${lesson.id}" is not listed in subject.yaml`);
      if (lesson.summary.next && !allListedLessons.has(lesson.summary.next))
        c.error(file, `summary.next "${lesson.summary.next}" is not a listed lesson`);
      const errorsBefore = c.errors.length;
      validateLesson(c, file, lesson, ctx, opts);
      subjects[sid].lessons[lesson.id] = lesson;
      // Mark available in the index.
      for (const u of index.subjects.find((s) => s.id === sid)!.units)
        for (const l of u.lessons)
          if (l.id === lesson.id) {
            l.available = c.errors.length === errorsBefore;
            l.estimatedMinutes = lesson.estimatedMinutes;
            l.coreSteps = lesson.chain.filter((s) => s.role === 'core').length;
          }
    }
    for (const m of ctx.misconceptions.keys())
      if (!ctx.usedMisconceptions.has(m))
        c.warn(join(dir, 'misconceptions.yaml'), `misconception "${m}" is defined but never used`);
  }

  // Python reference solutions run in one batch at the end.
  if (opts.runCode !== false) {
    const note = flushCodeChecks();
    if (note) c.warn(contentDir, note);
  }

  return { errors: c.errors, warnings: c.warnings, index, subjects };
}

function validateLesson(
  c: Collector,
  file: string,
  lesson: Lesson,
  ctx: SubjectCtx,
  opts: { runCode?: boolean },
): void {
  const err = (msg: string, where?: string) => c.error(file, msg, where);
  const warn = (msg: string, where?: string) => c.warn(file, msg, where);

  for (const k of lesson.concepts) if (!ctx.conceptIds.has(k)) err(`unknown concept "${k}"`, 'concepts');

  // ── Structure ──────────────────────────────────────────────────────────────
  const stepIds = new Set<string>();
  const questionIds = new Set<string>();
  const core = lesson.chain.filter((s) => s.role === 'core');
  const coreIndex = new Map(core.map((s, i) => [s.id, i]));
  if (core.length !== 6) err(`expected exactly 6 core steps, found ${core.length}`);

  let usesLinks = 0;
  let clueLinks = 0;
  let prevStandard = 0;
  const standardDiffs: number[] = [];

  for (const step of lesson.chain) {
    const where = step.id;
    if (stepIds.has(step.id)) err(`duplicate step id "${step.id}"`, where);
    stepIds.add(step.id);
    if (!ctx.conceptIds.has(step.concept)) err(`unknown concept "${step.concept}"`, where);
    else if (!lesson.concepts.includes(step.concept))
      warn(`concept "${step.concept}" is not in the lesson's concepts list`, where);

    if (step.role === 'core') {
      const { easier, standard, harder } = step.variants;
      if (!easier || !harder) err('core steps need easier, standard and harder variants', where);
      else if (!(easier.difficulty < standard.difficulty && standard.difficulty < harder.difficulty))
        err(
          `difficulty must strictly increase easier < standard < harder (got ${easier.difficulty}, ${standard.difficulty}, ${harder.difficulty})`,
          where,
        );
      if (standard.difficulty < 2 || standard.difficulty > 4)
        err(`standard difficulty must be 2–4 (got ${standard.difficulty})`, where);
      if (standard.difficulty < prevStandard)
        err(`standard difficulties must be non-decreasing through the chain`, where);
      prevStandard = standard.difficulty;
      standardDiffs.push(standard.difficulty);
      if (!step.establishes) err('core steps need `establishes`', where);
      const i = coreIndex.get(step.id)!;
      for (const u of step.uses ?? []) {
        const j = coreIndex.get(u);
        if (j === undefined) err(`uses "${u}" is not a core step`, where);
        else if (j >= i) err(`uses "${u}" must point to an earlier step`, where);
        usesLinks++;
      }
      for (const u of step.clueFor ?? []) {
        const j = coreIndex.get(u);
        if (j === undefined) err(`clueFor "${u}" is not a core step`, where);
        else if (j <= i) err(`clueFor "${u}" must point to a later step`, where);
        clueLinks++;
      }
    } else {
      if (step.variants.easier || step.variants.harder)
        err(`${step.role} steps have a standard variant only`, where);
      if (step.role === 'remediation') {
        if (!step.remediates) err('remediation steps need `remediates`', where);
        else if (!coreIndex.has(step.remediates))
          err(`remediates "${step.remediates}" is not a core step`, where);
      }
      for (const u of step.uses ?? []) if (!coreIndex.has(u)) err(`uses "${u}" is not a core step`, where);
      if (step.clueFor?.length) err(`${step.role} steps cannot have clueFor`, where);
    }
    if ((step.uses?.length ?? 0) > 0 && !step.standaloneContext)
      err('steps with `uses` need `standaloneContext` (review mode)', where);

    for (const [vk, q] of allQuestions(step)) {
      const qw = `${step.id}.${vk}`;
      if (questionIds.has(q.id)) err(`duplicate question id "${q.id}"`, qw);
      questionIds.add(q.id);
      validateQuestionStructure(c, file, q, qw, ctx);
    }
  }

  if (usesLinks < 2) err(`a lesson needs ≥ 2 \`uses\` links (found ${usesLinks})`);
  if (clueLinks < 1) err('a lesson needs ≥ 1 `clueFor` link');
  const last = core[core.length - 1];
  if (last && (last.uses?.length ?? 0) < 2) err('the last core step must use ≥ 2 earlier steps', last.id);

  // Challenge structure.
  const ch = lesson.challenge;
  const logic = challengeLogic[ch.type];
  if (!ctx.conceptIds.has(ch.concept)) err(`unknown concept "${ch.concept}"`, 'challenge');
  for (const u of ch.uses ?? [])
    if (!coreIndex.has(u)) err(`challenge uses "${u}" is not a core step`, 'challenge');
  const cv = ch.variants;
  if (!(cv.easier.difficulty < cv.standard.difficulty && cv.standard.difficulty < cv.harder.difficulty))
    err('challenge variant difficulty must strictly increase', 'challenge');
  if (!logic) err(`unknown challenge type "${ch.type}"`, 'challenge');
  const parsedConfigs: Record<string, unknown> = {};
  const parsedSolutions: Record<string, unknown> = {};
  for (const vk of ['easier', 'standard', 'harder'] as const) {
    const v = cv[vk];
    const where = `challenge.${vk}`;
    for (const f of v.feedback ?? []) {
      if (f.misconception) {
        if (!ctx.misconceptions.has(f.misconception))
          err(`unknown misconception "${f.misconception}"`, where);
        ctx.usedMisconceptions.add(f.misconception);
      }
    }
    if (!logic) continue;
    const pc = logic.configSchema.safeParse(v.config);
    if (!pc.success) err(`config: ${formatZodError(pc.error)}`, where);
    else parsedConfigs[vk] = pc.data;
    const ps = logic.solutionSchema.safeParse(v.solution);
    if (!ps.success) err(`solution: ${formatZodError(ps.error)}`, where);
    else parsedSolutions[vk] = ps.data;
  }

  // ── Quality warnings ───────────────────────────────────────────────────────
  if (wordCount(lesson.intro) > 300) warn(`intro is ${wordCount(lesson.intro)} words (limit 300)`, 'intro');
  for (const step of lesson.chain)
    for (const [vk, q] of allQuestions(step))
      if (wordCount(q.prompt) > 80)
        warn(`prompt is ${wordCount(q.prompt)} words (limit 80)`, `${step.id}.${vk}`);
  const unitId = lesson.id.split('.').slice(0, 2).join('.');
  const base = ctx.unitBase.get(unitId);
  if (base !== undefined && standardDiffs.length > 0) {
    const meanStd = standardDiffs.reduce((a, b) => a + b, 0) / standardDiffs.length;
    if (Math.abs(meanStd - base) > 0.5)
      warn(`mean standard difficulty ${meanStd.toFixed(2)} is more than 0.5 from the unit's base ${base}`);
  }
  if (lesson.params && 'sets' in lesson.params) {
    const nums = numbersIn(lesson.workedExample);
    for (const set of lesson.params.sets) {
      const vals = Object.values(set);
      if (vals.length > 0 && vals.every((v) => nums.has(v)))
        warn(`worked example uses the same numbers as param set ${JSON.stringify(set)}`, 'workedExample');
    }
  }

  // ── Numbers & rendering ───────────────────────────────────────────────────
  const scopes: Scope[] = [];
  for (const values of enumerateParamValues(lesson.params)) {
    try {
      scopes.push(applyDerived(values, lesson.derived));
    } catch (e) {
      err(`derived: ${(e as Error).message} with ${JSON.stringify(values)}`);
    }
  }
  const reported = new Set<string>();
  const once = (key: string, msg: string, where?: string) => {
    if (reported.has(key)) return;
    reported.add(key);
    err(msg, where);
  };
  const onceWarn = (key: string, msg: string, where?: string) => {
    if (reported.has(key)) return;
    reported.add(key);
    warn(msg, where);
  };
  const renderCheck = (src: string | undefined, scope: Scope, where: string, label: string) => {
    if (!src) return;
    let out: string;
    try {
      out = renderTemplate(src, scope);
    } catch (e) {
      once(
        `${where}:${label}:tpl`,
        `${label}: ${(e as Error).message} (params ${JSON.stringify(scope)})`,
        where,
      );
      return;
    }
    const k = checkKatex(out);
    if (k) once(`${where}:${label}:katex`, `${label}: ${k}`, where);
  };

  for (const scope of scopes) {
    renderCheck(lesson.intro, scope, 'intro', 'intro');
    renderCheck(lesson.workedExample, scope, 'workedExample', 'workedExample');
    lesson.summary.keyTakeaways.forEach((t, i) => renderCheck(t, scope, 'summary', `keyTakeaways[${i}]`));
    for (const step of lesson.chain) {
      renderCheck(step.establishes, scope, step.id, 'establishes');
      renderCheck(step.standaloneContext, scope, step.id, 'standaloneContext');
      for (const [vk, q] of allQuestions(step)) {
        const where = `${step.id}.${vk}`;
        renderCheck(q.prompt, scope, where, 'prompt');
        renderCheck(q.hints.nudge, scope, where, 'hints.nudge');
        renderCheck(q.hints.buildsOn, scope, where, 'hints.buildsOn');
        renderCheck(q.hints.partial, scope, where, 'hints.partial');
        renderCheck(q.explanation, scope, where, 'explanation');
        (q.options ?? []).forEach((o, i) => renderCheck(o.text, scope, where, `options[${i}]`));
        try {
          const opts4 = buildOptions(q, scope, 1);
          const texts = opts4.map((o) => o.text);
          const dup = texts.find((t, i) => texts.indexOf(t) !== i);
          if (dup !== undefined)
            once(
              `${where}:dup:${JSON.stringify(scope)}`,
              `two options both display "${dup}" (params ${JSON.stringify(scope)})`,
              where,
            );
        } catch (e) {
          once(`${where}:opts`, `options: ${(e as Error).message} (params ${JSON.stringify(scope)})`, where);
        }
      }
    }
  }

  // verify pairs: numerically equal at 20 random points.
  for (const step of lesson.chain)
    for (const [vk, q] of allQuestions(step))
      for (const [vi, pair] of (q.verify ?? []).entries()) {
        const where = `${step.id}.${vk}`;
        const rng = mulberry32(1234 + vi);
        for (const scope of scopes.slice(0, 20)) {
          let bad: string | null = null;
          for (let t = 0; t < 20 && !bad; t++) {
            const s: Scope = { ...scope };
            for (const [name, [lo, hi]] of Object.entries(pair.vars ?? {})) s[name] = lo + (hi - lo) * rng();
            try {
              const l = evalNumber(pair.lhs, s);
              const r = evalNumber(pair.rhs, s);
              if (!Number.isFinite(l) || !Number.isFinite(r))
                bad = `non-finite value at ${JSON.stringify(s)}`;
              else if (Math.abs(l - r) > 1e-9 * Math.max(1, Math.abs(l), Math.abs(r)))
                bad = `lhs ${l} ≠ rhs ${r} at ${JSON.stringify(s)}`;
            } catch (e) {
              bad = (e as Error).message;
            }
          }
          if (bad) {
            err(`verify[${vi}] "${pair.lhs}" vs "${pair.rhs}": ${bad}`, where);
            break;
          }
        }
      }

  // Challenge numbers: solution passes check for every param set; feedback ifs are boolean.
  const chScopes: Scope[] = [];
  if (ch.params) {
    for (const values of enumerateParamValues(ch.params, 50)) {
      try {
        chScopes.push(applyDerived(values, ch.derived));
      } catch (e) {
        err(`challenge derived: ${(e as Error).message}`, 'challenge');
      }
    }
  } else {
    for (const s of scopes) {
      try {
        chScopes.push(applyDerived(s as Record<string, number>, ch.derived));
      } catch (e) {
        err(`challenge derived: ${(e as Error).message}`, 'challenge');
      }
    }
  }
  for (const vk of ['easier', 'standard', 'harder'] as const) {
    const v = ch.variants[vk];
    const where = `challenge.${vk}`;
    for (const scope of chScopes) {
      renderCheck(v.goal, scope, where, 'goal');
      renderCheck(v.hints.nudge, scope, where, 'hints.nudge');
      renderCheck(v.hints.buildsOn, scope, where, 'hints.buildsOn');
      renderCheck(v.hints.partial, scope, where, 'hints.partial');
      renderCheck(v.explanation, scope, where, 'explanation');
      (v.feedback ?? []).forEach((f, i) => renderCheck(f.say, scope, where, `feedback[${i}].say`));
      if (!logic || parsedConfigs[vk] === undefined || parsedSolutions[vk] === undefined) continue;
      try {
        const ctxR = makeResolveCtx(scope, evalNumber, renderTemplate);
        const resolved = logic.resolveConfig(parsedConfigs[vk], ctxR);
        const config = logic.withSolution ? logic.withSolution(resolved, parsedSolutions[vk]) : resolved;
        const solScope = logic.solutionScope(parsedSolutions[vk], config);
        const full = { ...scope, ...solScope };
        const ok = evalBoolean(v.check.expr, full);
        if (!ok)
          once(
            `${where}:check`,
            `solution does not pass check "${v.check.expr}" (params ${JSON.stringify(scope)}; solution scope ${JSON.stringify(numericOnly(solScope))})`,
            where,
          );
        (v.feedback ?? []).forEach((f, i) => {
          const r = evaluate(f.if, full);
          if (typeof r !== 'boolean')
            once(`${where}:fb${i}`, `feedback[${i}].if "${f.if}" is not boolean`, where);
        });
        // A correct solution must not trigger a feedback rule ahead of success — harmless, but
        // also check the empty/initial state does not crash checkScope.
        const initialScope = logic.checkScope(logic.initialState(config), config);
        // A challenge that is already solved before the student does anything teaches nothing.
        if (ch.type !== 'code-runner' && evalBoolean(v.check.expr, { ...scope, ...initialScope }))
          onceWarn(`${where}:initial`, 'the starting state already passes the check', where);
      } catch (e) {
        once(`${where}:eval`, `challenge: ${(e as Error).message} (params ${JSON.stringify(scope)})`, where);
      }
    }
  }
  if (opts.runCode !== false && logic && ch.type === 'code-runner') {
    for (const vk of ['easier', 'standard', 'harder'] as const) {
      const pc = parsedConfigs[vk];
      const ps = parsedSolutions[vk];
      if (pc === undefined || ps === undefined) continue;
      runCodeChecks(pc, ps, (issue) => {
        if (issue.level === 'error') err(issue.message, `challenge.${vk}`);
        else warn(issue.message, `challenge.${vk}`);
      });
    }
  }
}

function numericOnly(s: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== 'function'));
}

function validateQuestionStructure(c: Collector, file: string, q: Question, where: string, ctx: SubjectCtx) {
  const err = (msg: string) => c.error(file, msg, where);
  const tags: string[] = [];
  if (q.options && (q.answer || q.distractors))
    err('use either static `options` or computed `answer`/`distractors`');
  else if (q.options) {
    if (q.options.length !== 4) err(`static questions need exactly 4 options (found ${q.options.length})`);
    const correct = q.options.filter((o) => o.correct);
    if (correct.length !== 1) err(`exactly 1 option must be correct (found ${correct.length})`);
    for (const o of q.options) {
      if (o.correct && o.misconception) err('the correct option must not have a misconception');
      if (!o.correct) {
        if (!o.misconception) err(`wrong option "${o.text}" needs a misconception tag`);
        else tags.push(o.misconception);
      }
    }
    if (q.fixedOrder === undefined) {
      /* default: shuffled */
    }
  } else if (q.answer) {
    if (q.fixedOrder) err('`fixedOrder` applies to static options only');
    const d = q.distractors ?? [];
    if (d.length !== 3) err(`computed questions need exactly 3 distractors (found ${d.length})`);
    for (const x of d) tags.push(x.misconception);
  } else err('question needs `options` or `answer` + `distractors`');

  for (const t of tags) {
    if (!ctx.misconceptions.has(t)) err(`unknown misconception "${t}"`);
    ctx.usedMisconceptions.add(t);
  }
  const dupTag = tags.find((t, i) => tags.indexOf(t) !== i);
  if (dupTag) c.warn(file, `misconception "${dupTag}" is used twice in one question`, where);

  for (const label of EXPLANATION_LABELS)
    if (!q.explanation.includes(label)) err(`explanation is missing ${label}`);
}

export function printIssues(result: { errors: Issue[]; warnings: Issue[] }): void {
  const fmt = (i: Issue) => `  ${i.file}${i.where ? ` [${i.where}]` : ''}: ${i.message}`;
  if (result.warnings.length) {
    console.log(`\n⚠ ${result.warnings.length} warning(s):`);
    for (const w of result.warnings) console.log(fmt(w));
  }
  if (result.errors.length) {
    console.log(`\n✖ ${result.errors.length} error(s):`);
    for (const e of result.errors) console.log(fmt(e));
  }
}

export function summarize(result: ValidationResult): string {
  let total = 0;
  let available = 0;
  for (const s of result.index.subjects)
    for (const u of s.units)
      for (const l of u.lessons) {
        total++;
        if (l.available) available++;
      }
  return `${result.index.subjects.length} subjects, ${total} lessons listed, ${available} playable`;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const dir = resolve(process.argv[2] ?? join(import.meta.dirname, '..', 'content'));
  const result = validateContent(dir);
  printIssues(result);
  console.log(
    `\ncontent:check — ${summarize(result)}; ${result.errors.length} errors, ${result.warnings.length} warnings.`,
  );
  process.exit(result.errors.length ? 1 : 0);
}
