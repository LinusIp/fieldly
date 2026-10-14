/**
 * Content validator (§13.2). `npm run content:check` runs it; `build-content.ts` reuses it.
 * Errors fail CI; warnings are printed.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ConceptsSchema,
  LessonSchema,
  MisconceptionsSchema,
  MixedSetSchema,
  PuzzlePackSchema,
  SpeedRoundSchema,
  SubjectSchema,
  SubjectsListSchema,
  type Lesson,
  type Misconception,
  type MixedSet,
  type PuzzlePack,
  type Question,
  type SpeedRound,
  type Subject,
} from '../src/content/schema';
import type { ContentIndex, PuzzleContent, SubjectContent, SubjectMeta } from '../src/content/types';
import { flushCodeChecks } from './code-check';
import { validateInteractiveVariant } from './validate/interactive';
import { kindsUsed, validateLesson, workedExampleWarnings } from './validate/lesson';
import { validateQuestion } from './validate/questions';
import {
  Collector,
  formatZodError,
  readYaml,
  renderAndCheck,
  reporterFor,
  scopesOf,
  textLeaves,
  type Issue,
} from './validate/util';

export type { Issue } from './validate/util';
export { checkKatex, mathSegments } from './validate/util';

export interface ValidationResult {
  errors: Issue[];
  warnings: Issue[];
  index: ContentIndex;
  subjects: Record<string, SubjectContent>;
  puzzles: PuzzleContent;
}

interface SubjectCtx {
  subject: Subject;
  dir: string;
  conceptIds: Set<string>;
  misconceptions: Map<string, Misconception>;
  listedLessonIds: Set<string>;
  usedMisconceptions: Set<string>;
  unitBase: Map<string, number>;
}

function yamlFilesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .map((f) => join(dir, f));
}

export function validateContent(contentDir: string, opts: { runCode?: boolean } = {}): ValidationResult {
  const root = resolve(contentDir, '..');
  const c = new Collector(root);
  const index: ContentIndex = { builtAt: new Date().toISOString(), subjects: [] };
  const subjects: Record<string, SubjectContent> = {};
  const puzzles: PuzzleContent = {};
  const result = () => ({ errors: c.errors, warnings: c.warnings, index, subjects, puzzles });

  const subjectsFile = join(contentDir, 'subjects.yaml');
  if (!existsSync(subjectsFile)) {
    c.error(subjectsFile, 'missing subjects.yaml');
    return result();
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

  // ── Pass 1: syllabus manifests, concepts, misconceptions ─────────────────────
  const ctxs = new Map<string, SubjectCtx>();
  const allListedLessons = new Map<string, string>(); // lesson id → subject id
  const conceptsBySubject = new Map<string, Map<string, string[]>>(); // slug → requires
  for (const sid of subjectIds) {
    const dir = join(contentDir, sid);
    const subjectFile = join(dir, 'subject.yaml');
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

    const conceptsFile = join(dir, 'concepts.yaml');
    const concepts = new Map<string, string[]>();
    subjects[sid] = { id: sid, concepts: [], misconceptions: [], lessons: {}, mixed: {}, speed: {} };
    if (!existsSync(conceptsFile)) c.error(conceptsFile, 'missing concepts.yaml');
    else
      try {
        const parsed = ConceptsSchema.safeParse(readYaml(conceptsFile));
        if (!parsed.success) c.error(conceptsFile, formatZodError(parsed.error));
        else {
          for (const k of parsed.data) {
            if (concepts.has(k.id)) c.error(conceptsFile, `duplicate concept "${k.id}"`);
            concepts.set(k.id, k.requires ?? []);
          }
          subjects[sid].concepts = parsed.data;
        }
      } catch (e) {
        c.error(conceptsFile, (e as Error).message);
      }
    conceptsBySubject.set(sid, concepts);

    const miscFile = join(dir, 'misconceptions.yaml');
    const misconceptions = new Map<string, Misconception>();
    if (existsSync(miscFile))
      try {
        const parsed = MisconceptionsSchema.safeParse(readYaml(miscFile) ?? []);
        if (!parsed.success) c.error(miscFile, formatZodError(parsed.error));
        else {
          for (const m of parsed.data) {
            if (misconceptions.has(m.id)) c.error(miscFile, `duplicate misconception "${m.id}"`);
            misconceptions.set(m.id, m);
          }
          subjects[sid].misconceptions = parsed.data;
        }
      } catch (e) {
        c.error(miscFile, (e as Error).message);
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
      mixed: [],
      speed: [],
      puzzles: [],
    };
    let tryFirstCount = 0;
    subject.units.forEach((unit, ui) => {
      if (unit.id !== `${sid}.u${ui + 1}`)
        c.error(subjectFile, `unit id "${unit.id}" should be "${sid}.u${ui + 1}"`);
      unitBase.set(unit.id, unit.baseDifficulty);
      let prevLesson: string | undefined;
      const unitMeta: SubjectMeta['units'][number] = {
        id: unit.id,
        title: unit.title,
        baseDifficulty: unit.baseDifficulty,
        checkpointItems: unit.checkpoint?.items ?? 12,
        lessons: [],
      };
      unit.lessons.forEach((l, li) => {
        if (l.id !== `${unit.id}.l${li + 1}`)
          c.error(subjectFile, `lesson id "${l.id}" should be "${unit.id}.l${li + 1}"`);
        if (allListedLessons.has(l.id)) c.error(subjectFile, `duplicate lesson id "${l.id}"`);
        listed.add(l.id);
        allListedLessons.set(l.id, sid);
        for (const k of l.concepts)
          if (!concepts.has(k)) c.error(subjectFile, `unknown concept "${k}"`, l.id);
        if (l.tryFirst) tryFirstCount++;
        unitMeta.lessons.push({
          id: l.id,
          title: l.title,
          concepts: l.concepts,
          prerequisites: l.prerequisites ?? (prevLesson ? [prevLesson] : []),
          tryFirst: l.tryFirst ?? false,
          available: false,
        });
        prevLesson = l.id;
      });
      meta.units.push(unitMeta);
    });
    if (tryFirstCount < 3) c.warn(subjectFile, `only ${tryFirstCount} tryFirst lessons (§2.8 suggests 3–5)`);
    index.subjects.push(meta);
    ctxs.set(sid, {
      subject,
      dir,
      conceptIds: new Set(concepts.keys()),
      misconceptions,
      listedLessonIds: listed,
      usedMisconceptions: new Set(),
      unitBase,
    });
  }

  // Cross-references: prerequisites, concept `requires` (bare or "<subject>/<slug>"), misconception lessons.
  for (const [sid, ctx] of ctxs) {
    const subjectFile = join(ctx.dir, 'subject.yaml');
    for (const p of ctx.subject.prerequisites)
      if (!ctxs.has(p)) c.error(subjectFile, `prerequisite subject "${p}" does not exist`);
    for (const unit of ctx.subject.units)
      for (const l of unit.lessons)
        for (const p of l.prerequisites ?? [])
          if (!allListedLessons.has(p))
            c.error(subjectFile, `prerequisite lesson "${p}" is not listed`, l.id);
    const conceptsFile = join(ctx.dir, 'concepts.yaml');
    for (const [slug, reqs] of conceptsBySubject.get(sid) ?? [])
      for (const r of reqs) {
        const [rs, rslug] = r.includes('/') ? r.split('/', 2) : [sid, r];
        if (!conceptsBySubject.get(rs)?.has(rslug))
          c.error(conceptsFile, `requires unknown concept "${r}"`, slug);
        if (rs === sid && rslug === slug) c.error(conceptsFile, 'a concept cannot require itself', slug);
      }
    for (const m of ctx.misconceptions.values())
      for (const l of m.lessons)
        if (!allListedLessons.has(l))
          c.error(join(ctx.dir, 'misconceptions.yaml'), `lesson "${l}" is not listed`, m.id);
  }

  // ── Pass 2: lessons, mixed sets, speed rounds ──────────────────────────────
  for (const [sid, ctx] of ctxs) {
    const lessonFiles: string[] = [];
    for (const u of readdirSync(ctx.dir)) {
      const ud = join(ctx.dir, u);
      if (statSync(ud).isDirectory() && !['mixed', 'speed'].includes(u)) lessonFiles.push(...yamlFilesIn(ud));
    }
    const unitKinds = new Map<string, Set<string>>();
    for (const file of lessonFiles) {
      const m = relative(ctx.dir, file)
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
      const recap = lesson.screens[lesson.screens.length - 1];
      if (recap?.type === 'recap' && recap.next && !allListedLessons.has(recap.next))
        c.error(file, `recap.next "${recap.next}" is not a listed lesson`);
      const errorsBefore = c.errors.length;
      const rep = reporterFor(c, file);
      const unitId = lesson.id.split('.').slice(0, 2).join('.');
      validateLesson(lesson, {
        rep,
        conceptIds: ctx.conceptIds,
        misconceptions: new Set(ctx.misconceptions.keys()),
        usedMisconceptions: ctx.usedMisconceptions,
        unitBase: ctx.unitBase.get(unitId),
        runCode: opts.runCode !== false,
      });
      workedExampleWarnings(lesson, rep);
      const kinds = unitKinds.get(unitId) ?? new Set<string>();
      for (const k of kindsUsed(lesson)) kinds.add(k);
      unitKinds.set(unitId, kinds);
      subjects[sid].lessons[lesson.id] = lesson;
      for (const u of index.subjects.find((s) => s.id === sid)!.units)
        for (const l of u.lessons)
          if (l.id === lesson.id) {
            l.available = c.errors.length === errorsBefore;
            l.estimatedMinutes = lesson.estimatedMinutes;
            l.screens = lesson.screens.length;
            l.coreSteps = lesson.screens.filter((s) => s.type === 'question' && s.role === 'core').length;
            l.practiceItems = lesson.practice.length;
          }
    }
    for (const [unitId, kinds] of unitKinds)
      if (!kinds.has('find-the-error'))
        c.warn(join(ctx.dir, 'subject.yaml'), `unit ${unitId} has no find-the-error question`);

    validateMixedAndSpeed(
      c,
      sid,
      ctx,
      subjects[sid],
      index.subjects.find((s) => s.id === sid)!,
      allListedLessons,
    );

    const unused = [...ctx.misconceptions.keys()].filter((m) => !ctx.usedMisconceptions.has(m));
    if (Object.keys(subjects[sid].lessons).length === 0 && unused.length > 0)
      c.warn(
        join(ctx.dir, 'misconceptions.yaml'),
        `${unused.length} misconceptions are defined; no lesson uses them yet`,
      );
    else
      for (const m of unused)
        c.warn(join(ctx.dir, 'misconceptions.yaml'), `misconception "${m}" is defined but never used`);
    // Learners see a misconception's name in the recap and on the profile: one a lesson uses needs one.
    for (const m of ctx.usedMisconceptions)
      if (!ctx.misconceptions.get(m)?.name)
        c.warn(join(ctx.dir, 'misconceptions.yaml'), `misconception "${m}" is used but has no name`);
    // The profile's "Revisit" links come from `lessons`: add every lesson that actually tags the
    // misconception, in syllabus order, after the ones listed by hand.
    for (const mis of ctx.misconceptions.values()) {
      const used = [...ctx.listedLessonIds].filter((id) => {
        const l = subjects[sid].lessons[id];
        return l !== undefined && lessonTags(l).has(mis.id);
      });
      mis.lessons = [...new Set([...mis.lessons, ...used])];
    }
  }

  // ── Pass 3: puzzle packs ────────────────────────────────────────────────────
  validatePuzzles(c, contentDir, puzzles, index, allListedLessons, ctxs);

  if (opts.runCode !== false) {
    const note = flushCodeChecks();
    if (note) c.warn(contentDir, note);
  }
  return result();
}

function validateMixedAndSpeed(
  c: Collector,
  sid: string,
  ctx: SubjectCtx,
  content: SubjectContent,
  meta: SubjectMeta,
  allListedLessons: Map<string, string>,
): void {
  for (const file of yamlFilesIn(join(ctx.dir, 'mixed'))) {
    let set: MixedSet;
    try {
      const parsed = MixedSetSchema.safeParse(readYaml(file));
      if (!parsed.success) {
        c.error(file, formatZodError(parsed.error));
        continue;
      }
      set = parsed.data;
    } catch (e) {
      c.error(file, (e as Error).message);
      continue;
    }
    for (const l of set.lessons)
      if (!ctx.listedLessonIds.has(l)) c.error(file, `lesson "${l}" is not listed in ${sid}`);
    const perMethod = new Map(set.methods.map((m) => [m, 0]));
    for (const l of set.lessons)
      for (const item of content.lessons[l]?.practice ?? [])
        if (item.method !== undefined) {
          if (!perMethod.has(item.method))
            c.error(
              file,
              `${l} practice item ${item.id} has method "${item.method}", not one of this set's methods`,
            );
          else perMethod.set(item.method, perMethod.get(item.method)! + 1);
        }
    // Counts are only enforced once every listed lesson exists.
    if (set.lessons.every((l) => content.lessons[l]))
      for (const [m, n] of perMethod)
        if (n < 2) c.error(file, `method "${m}" has ${n} tagged items (needs ≥ 2)`);
    content.mixed[set.id] = set;
    meta.mixed.push({ id: set.id, title: set.title, lessons: set.lessons });
  }
  for (const file of yamlFilesIn(join(ctx.dir, 'speed'))) {
    let round: SpeedRound;
    try {
      const parsed = SpeedRoundSchema.safeParse(readYaml(file));
      if (!parsed.success) {
        c.error(file, formatZodError(parsed.error));
        continue;
      }
      round = parsed.data;
    } catch (e) {
      c.error(file, (e as Error).message);
      continue;
    }
    if (!allListedLessons.has(round.unlockAfter))
      c.error(file, `unlockAfter "${round.unlockAfter}" is not a listed lesson`);
    if (!ctx.conceptIds.has(round.concept)) c.error(file, `unknown concept "${round.concept}"`);
    const rep = reporterFor(c, file);
    for (const item of round.items) {
      const { params, derived, ...q } = item;
      const scopes = scopesOf(params, derived, (m) => rep.error(m, item.id));
      validateQuestion({ ...q, difficulty: 2 } as Question, {
        rep,
        where: item.id,
        scopes,
        misconceptions: new Set(ctx.misconceptions.keys()),
        usedMisconceptions: ctx.usedMisconceptions,
        speed: true,
      });
    }
    content.speed[round.id] = round;
    meta.speed.push({ id: round.id, title: round.title, unlockAfter: round.unlockAfter });
  }
}

function validatePuzzles(
  c: Collector,
  contentDir: string,
  out: PuzzleContent,
  index: ContentIndex,
  allListedLessons: Map<string, string>,
  ctxs: Map<string, SubjectCtx>,
): void {
  const dir = join(contentDir, 'puzzles');
  if (!existsSync(dir)) return;
  for (const type of readdirSync(dir)) {
    const td = join(dir, type);
    if (!statSync(td).isDirectory()) continue;
    for (const file of yamlFilesIn(td)) {
      let pack: PuzzlePack;
      try {
        const parsed = PuzzlePackSchema.safeParse(readYaml(file));
        if (!parsed.success) {
          c.error(file, formatZodError(parsed.error));
          continue;
        }
        pack = parsed.data;
      } catch (e) {
        c.error(file, (e as Error).message);
        continue;
      }
      if (pack.interactive !== type)
        c.error(file, `interactive "${pack.interactive}" does not match its folder "${type}"`);
      if (out[pack.id]) c.error(file, `duplicate pack id "${pack.id}"`);
      const sid = allListedLessons.get(pack.unlockAfter);
      if (!sid) c.error(file, `unlockAfter "${pack.unlockAfter}" is not a listed lesson`);
      const rep = reporterFor(c, file);
      const misconceptions = sid ? new Set(ctxs.get(sid)!.misconceptions.keys()) : new Set<string>();
      const ids = new Set<string>();
      let prev = 0;
      pack.levels.forEach((lv, i) => {
        if (ids.has(lv.id)) rep.error(`duplicate level id "${lv.id}"`, lv.id);
        ids.add(lv.id);
        if (lv.difficulty < prev) rep.error('level difficulty must not decrease', lv.id);
        prev = lv.difficulty;
        if (i >= pack.levels.length - 3 && lv.difficulty < 4)
          rep.error('the last 3 levels need band ≥ 4', lv.id);
        for (const f of lv.feedback ?? []) {
          if (!f.misconception) continue;
          if (!misconceptions.has(f.misconception))
            rep.error(`unknown misconception "${f.misconception}"`, lv.id);
          else ctxs.get(sid!)!.usedMisconceptions.add(f.misconception);
        }
        const scopes = scopesOf(lv.params, lv.derived, (m) => rep.error(m, lv.id));
        for (const scope of scopes) {
          const texts = {
            title: lv.title,
            goal: lv.goal,
            hints: lv.hints,
            explanation: lv.explanation,
            feedback: lv.feedback?.map((f) => f.say),
          };
          for (const leaf of textLeaves(texts)) {
            const { error } = renderAndCheck(leaf.text, scope);
            if (error) rep.errorOnce(`${lv.id}:${leaf.path}`, `${leaf.path}: ${error}`, lv.id);
          }
          validateInteractiveVariant(pack.interactive, lv, scope, rep, lv.id);
        }
      });
      out[pack.id] = pack;
      index.subjects
        .find((s) => s.id === sid)
        ?.puzzles.push({
          id: pack.id,
          title: pack.title,
          interactive: pack.interactive,
          unlockAfter: pack.unlockAfter,
          levels: pack.levels.length,
        });
    }
  }
}

/** Every misconception id a lesson tags (options, wrong answers, cards, targets, challenge feedback). */
function lessonTags(lesson: Lesson): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if (k === 'misconception' && typeof x === 'string') out.add(x);
        else if (k === 'wrongTargets' && x && typeof x === 'object')
          for (const t of Object.values(x)) {
            if (typeof t === 'string') out.add(t);
          }
        else walk(x);
      }
  };
  walk(lesson);
  return out;
}

export function summarize(r: ValidationResult): string {
  const lessons = r.index.subjects.reduce((n, s) => n + s.units.reduce((m, u) => m + u.lessons.length, 0), 0);
  const playable = r.index.subjects.reduce(
    (n, s) => n + s.units.reduce((m, u) => m + u.lessons.filter((l) => l.available).length, 0),
    0,
  );
  return `${r.index.subjects.length} subjects, ${lessons} lessons listed, ${playable} playable, ${Object.keys(r.puzzles).length} puzzle packs`;
}

export function printIssues(r: { errors: Issue[]; warnings: Issue[] }): void {
  const fmt = (i: Issue) => `  ${i.file}${i.where ? ` [${i.where}]` : ''}: ${i.message}`;
  if (r.warnings.length) {
    console.log(`\n⚠ ${r.warnings.length} warning(s):`);
    for (const w of r.warnings) console.log(fmt(w));
  }
  if (r.errors.length) {
    console.log(`\n✖ ${r.errors.length} error(s):`);
    for (const e of r.errors) console.log(fmt(e));
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const contentDir = resolve(process.argv[2] ?? join(import.meta.dirname, '..', 'content'));
  const r = validateContent(contentDir);
  printIssues(r);
  console.log(`\ncontent:check — ${summarize(r)}; ${r.errors.length} errors, ${r.warnings.length} warnings.`);
  process.exit(r.errors.length ? 1 : 0);
}
