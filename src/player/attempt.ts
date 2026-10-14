/**
 * Lesson attempts (§8.1, §3): pure functions over the lesson, the attempt state and stored
 * progress. The React player calls these; tests exercise them directly.
 */
import type { ChallengeScreen, Lesson, Question, Screen, Step } from '../content/schema';
import { nsId, type SubjectContent } from '../content/types';
import { expectedScore, INITIAL_RATING, updateRatings } from '../engine/elo';
import type { Scope } from '../engine/expr';
import { nextMastery } from '../engine/mastery';
import { implicitCredit, updateMemory, weakestPrerequisite } from '../engine/memory';
import { buildScope } from '../engine/params';
import { computeStars, isCompleted, mean, type ChallengeOutcome } from '../engine/scoring';
import { selectVariant, type VariantKey } from '../engine/select';
import { renderTemplate } from '../engine/template';
import type { AnswerRecord, AttemptState, Progress } from '../storage/schema';
import { hashString } from '../widgets/common';

export interface LessonCtx {
  lesson: Lesson;
  subjectId: string;
  /** The unit's baseDifficulty (§3.1). */
  base: number;
  /** concept slug → required concept ids (bare or "<subject>/<slug>"). */
  requires: Map<string, string[]>;
}

export function lessonCtx(lesson: Lesson, subject: SubjectContent, base: number): LessonCtx {
  return {
    lesson,
    subjectId: subject.id,
    base,
    requires: new Map(subject.concepts.map((c) => [c.id, c.requires ?? []])),
  };
}

export type Entry = Screen | (Step & { type: 'question' });

/** Screens plus extras (as question steps), by id. */
export function entryMap(lesson: Lesson): Map<string, Entry> {
  const m = new Map<string, Entry>(lesson.screens.map((s) => [s.id, s]));
  for (const x of lesson.extras ?? []) m.set(x.id, { ...x, type: 'question' });
  return m;
}

export function newAttempt(
  lesson: Lesson,
  seed: number,
  firstInSubject: boolean,
  now = new Date(),
): AttemptState {
  return {
    lessonVersion: lesson.version,
    seed,
    screenIndex: 0,
    chosenVariants: {},
    insertedSteps: [],
    answers: {},
    explore: {},
    challenges: {},
    facts: [],
    sequence: lesson.screens.map((s) => s.id),
    skipped: [],
    firstInSubject,
    startedAt: now.toISOString(),
  };
}

export function lessonScope(lesson: Lesson, seed: number): Scope {
  return buildScope(lesson.params, lesson.derived, seed);
}

/** A challenge with its own params draws separately from the same seed (§8.1). */
export function challengeScope(lesson: Lesson, ch: ChallengeScreen, seed: number): Scope {
  return ch.params
    ? buildScope(ch.params, ch.derived, (seed ^ hashString(ch.id)) >>> 0)
    : lessonScope(lesson, seed);
}

export function conceptKey(ctx: LessonCtx, slug: string): string {
  return nsId(ctx.subjectId, slug);
}

export function conceptRating(progress: Progress, ctx: LessonCtx, slug: string): number {
  return (
    progress.ratings.concept[conceptKey(ctx, slug)]?.r ??
    progress.ratings.subject[ctx.subjectId] ??
    INITIAL_RATING
  );
}

export function isStep(e: Entry | undefined): e is Step & { type: 'question' } {
  return e?.type === 'question';
}

export function questionOf(step: Step, attempt: AttemptState): Question {
  const v = attempt.chosenVariants[step.id] ?? 'standard';
  return step.variants[v] ?? step.variants.standard;
}

/** Scores of graded steps answered so far, in play order. */
export function gradedScores(lesson: Lesson, attempt: AttemptState): number[] {
  const map = entryMap(lesson);
  return attempt.sequence
    .map((id) => ({ e: map.get(id), r: attempt.answers[id] }))
    .filter((x) => isStep(x.e) && x.r?.score !== undefined)
    .map((x) => x.r!.score!);
}

/**
 * Choose the variant for a core step when it is reached (§3.2) and store it, so a refresh never
 * changes it. Check, remediation and bonus steps always use `standard`.
 */
export function ensureVariant(
  ctx: LessonCtx,
  attempt: AttemptState,
  progress: Progress,
  stepId: string,
): AttemptState {
  if (attempt.chosenVariants[stepId]) return attempt;
  const step = entryMap(ctx.lesson).get(stepId);
  if (!isStep(step)) return attempt;
  let variant: VariantKey = 'standard';
  if (step.role === 'core') {
    const std = step.variants.standard;
    const options = std.kind === 'mcq' ? mcqOptionCount(std) : undefined;
    const p = expectedScore(conceptRating(progress, ctx, step.concept), std.difficulty, ctx.base, options);
    const firstCore =
      ctx.lesson.screens.find((s) => s.type === 'question' && s.role === 'core')?.id === stepId;
    variant = selectVariant(
      p,
      gradedScores(ctx.lesson, attempt),
      attempt.firstInSubject && firstCore,
    ).variant;
    if (!step.variants[variant]) variant = 'standard';
  }
  return { ...attempt, chosenVariants: { ...attempt.chosenVariants, [stepId]: variant } };
}

function mcqOptionCount(q: Question): number {
  const opts = (q as { options?: unknown[] }).options;
  const distractors = (q as { distractors?: unknown[] }).distractors;
  return opts ? opts.length : 1 + (distractors?.length ?? 0);
}

/** Insert an extra step right after the current screen (if not already inserted). */
export function insertAfterCurrent(attempt: AttemptState, stepId: string): AttemptState {
  if (attempt.sequence.includes(stepId)) return attempt;
  const seq = [...attempt.sequence];
  seq.splice(attempt.screenIndex + 1, 0, stepId);
  return { ...attempt, sequence: seq, insertedSteps: [...attempt.insertedSteps, stepId] };
}

/**
 * After a graded core/check answer: two misses in a row insert the remediation for the missed
 * step; three strong answers in a row offer the bonus step (§3.2).
 */
export function maybeInsertExtras(ctx: LessonCtx, attempt: AttemptState, answeredId: string): AttemptState {
  const scores = gradedScores(ctx.lesson, attempt);
  const n = scores.length;
  const extras = ctx.lesson.extras ?? [];
  if (n >= 2 && scores[n - 1] < 0.5 && scores[n - 2] < 0.5) {
    // The missed core step: the one just answered, or the core step a missed remediation supports.
    const answered = entryMap(ctx.lesson).get(answeredId);
    const target = isStep(answered) && answered.role === 'remediation' ? answered.remediates : answeredId;
    const rem = extras.find(
      (x) => x.role === 'remediation' && x.remediates === target && !attempt.sequence.includes(x.id),
    );
    if (rem) return insertAfterCurrent(attempt, rem.id);
  }
  if (n >= 3 && scores.slice(-3).every((s) => s >= 0.8)) {
    const bonus = extras.find((x) => x.role === 'bonus' && !attempt.sequence.includes(x.id));
    if (bonus) return insertAfterCurrent(attempt, bonus.id);
  }
  return attempt;
}

export interface GradedInfo {
  stepId: string;
  question: Question;
  concept: string;
  score: number;
  record: AnswerRecord;
  misconception?: string;
  /** Where the answer came from, for mastery (§3.4). */
  context: 'lesson' | 'practice' | 'review' | 'checkpoint';
  /** "Show solution" was used (like a tier-3 hint, it sets `freshNext`, §2.5). */
  usedSolution?: boolean;
}

/**
 * Record a graded answer in stored progress: concept + subject ratings (§3.1), memory with
 * implicit credit and failure propagation (§3.3), mastery (§3.4), misconception counts and the
 * per-item history.
 */
export function recordGraded(
  progress: Progress,
  ctx: LessonCtx,
  info: GradedInfo,
  now = new Date(),
): Progress {
  const key = conceptKey(ctx, info.concept);
  const prevConcept = progress.ratings.concept[key];
  const subjectR = progress.ratings.subject[ctx.subjectId] ?? INITIAL_RATING;
  const options = info.question.kind === 'mcq' ? mcqOptionCount(info.question) : undefined;
  const next = updateRatings(
    { subject: subjectR, concept: { r: prevConcept?.r ?? subjectR, n: prevConcept?.n ?? 0 } },
    { difficulty: info.question.difficulty, base: ctx.base, options },
    info.score,
  );
  const itemId = `${ctx.lesson.id}#${info.question.id}`;
  const concept = {
    // A concept first met in a lesson starts from the subject rating; remember that for the recap.
    ...(prevConcept ??
      (info.context === 'lesson' ? { ratingAtLessonStart: { [ctx.lesson.id]: subjectR } } : {})),
    r: next.concept.r,
    n: next.concept.n,
    recent: [...(prevConcept?.recent ?? []), { itemId, score: info.score }].slice(-4),
  };
  const memory = { ...progress.memory };
  const prevMem = memory[key];
  memory[key] = { ...updateMemory(prevMem, info.score, now), dueOverride: undefined };
  const prereqs = (ctx.requires.get(info.concept) ?? []).map((r) => nsId(ctx.subjectId, r));
  const prereqInfo = prereqs.map((id) => ({
    id,
    rating: progress.ratings.concept[id]?.r ?? 0,
    memory: memory[id],
  }));
  Object.assign(memory, implicitCredit(prereqInfo, info.score, now));
  const weak = weakestPrerequisite(prereqInfo, info.score, now);
  if (weak && memory[weak]) memory[weak] = { ...memory[weak], dueOverride: true };
  if (info.record.hintsUsed >= 3 || info.usedSolution) memory[key] = { ...memory[key], freshNext: true };

  const mastery = { ...progress.mastery };
  const m = nextMastery(mastery[key], concept, { score: info.score, context: info.context, at: now });
  if (m) mastery[key] = m;

  const misconceptions = { ...progress.misconceptions };
  if (info.misconception) {
    const mk = nsId(ctx.subjectId, info.misconception);
    misconceptions[mk] = { count: (misconceptions[mk]?.count ?? 0) + 1, lastSeen: now.toISOString() };
  }
  const items = { ...progress.items };
  const prevItem = items[itemId];
  items[itemId] = {
    lastScore: info.score,
    attempts: (prevItem?.attempts ?? 0) + 1,
    lastAt: now.toISOString(),
    version: info.question.version ?? 1,
  };
  return {
    ...progress,
    ratings: {
      subject: { ...progress.ratings.subject, [ctx.subjectId]: next.subject },
      concept: { ...progress.ratings.concept, [key]: concept },
    },
    memory,
    mastery,
    misconceptions,
    items,
  };
}

/** Push a step's `establishes` fact (rendered) once. */
export function pushFact(attempt: AttemptState, fact: string | undefined, scope: Scope): AttemptState {
  if (!fact) return attempt;
  const text = renderTemplate(fact, scope);
  return attempt.facts.includes(text) ? attempt : { ...attempt, facts: [...attempt.facts, text] };
}

/** Core steps in the lesson, in order. */
export function coreSteps(lesson: Lesson): (Step & { type: 'question' })[] {
  return lesson.screens.filter(
    (s): s is Step & { type: 'question' } => s.type === 'question' && s.role === 'core',
  );
}

export function challengeOutcomes(lesson: Lesson, attempt: AttemptState): ChallengeOutcome[] {
  return lesson.screens
    .filter((s) => s.type === 'challenge')
    .map((s) => {
      const c = attempt.challenges[s.id];
      return {
        attempted: !!c && (c.checks > 0 || c.solved || !!c.usedSolution || !!c.skipped),
        solved: !!c?.solved && !c.usedSolution,
        usedTier3: (c?.hintsUsed ?? 0) >= 3,
        skipped: !!c?.skipped,
      };
    });
}

export interface LessonResult {
  completed: boolean;
  meanCore: number;
  stars: 0 | 1 | 2 | 3;
}

export function lessonResult(lesson: Lesson, attempt: AttemptState): LessonResult {
  const core = coreSteps(lesson);
  const scores = core.map((s) => attempt.answers[s.id]?.score);
  const coreAnswered = scores.every((x) => x !== undefined);
  const challenges = challengeOutcomes(lesson, attempt);
  const completed = isCompleted(coreAnswered, challenges);
  const meanCore = mean(scores.filter((x): x is number => x !== undefined));
  // A challenge skipped because its interactive isn't built yet doesn't count for or against stars.
  const rated = challenges.filter((c) => !c.skipped);
  return { completed, meanCore, stars: computeStars({ completed, meanCore, challenges: rated }) };
}

/** Store the lesson's result when the recap is reached; keeps the best stars and score. */
export function finishLesson(
  progress: Progress,
  lesson: Lesson,
  attempt: AttemptState,
  now = new Date(),
): Progress {
  const r = lessonResult(lesson, attempt);
  const prev = progress.lessons[lesson.id];
  const wasCompleted = prev?.status === 'completed';
  return {
    ...progress,
    lessons: {
      ...progress.lessons,
      [lesson.id]: {
        status: r.completed || wasCompleted ? 'completed' : 'in-progress',
        bestScore: Math.max(prev?.bestScore ?? 0, r.completed ? r.meanCore : 0),
        stars: Math.max(prev?.stars ?? 0, r.stars) as 0 | 1 | 2 | 3,
        practised: prev?.practised ?? false,
        completedAt: r.completed && !wasCompleted ? now.toISOString() : prev?.completedAt,
        attempt,
        lastOpenedAt: now.toISOString(),
      },
    },
  };
}

/** A stored attempt the player can show: every id in its sequence exists and the index is in range. */
export function attemptFits(lesson: Lesson, attempt: AttemptState): boolean {
  const map = entryMap(lesson);
  return (
    attempt.sequence.length > 0 &&
    attempt.screenIndex < attempt.sequence.length &&
    attempt.sequence.every((id) => map.has(id))
  );
}

/**
 * Open (or resume) the lesson: a new attempt when there is none or the lesson version changed
 * (§12), the ratings at the start for the recap, and status / lastOpenedAt.
 */
export function openLesson(progress: Progress, ctx: LessonCtx, seed: number, now = new Date()): Progress {
  const { lesson } = ctx;
  const lp = progress.lessons[lesson.id];
  let attempt = lp?.attempt;
  let concept = progress.ratings.concept;
  if (!attempt || attempt.lessonVersion !== lesson.version || !attemptFits(lesson, attempt)) {
    const prefix = `${ctx.subjectId}.`;
    const firstInSubject = !Object.entries(progress.lessons).some(
      ([id, l]) => id !== lesson.id && id.startsWith(prefix) && l.status !== 'not-started',
    );
    attempt = newAttempt(lesson, seed, firstInSubject, now);
    concept = { ...concept };
    for (const c of lesson.concepts) {
      const key = conceptKey(ctx, c);
      const prev = concept[key];
      if (prev)
        concept[key] = { ...prev, ratingAtLessonStart: { ...prev.ratingAtLessonStart, [lesson.id]: prev.r } };
    }
  }
  return {
    ...progress,
    ratings: { ...progress.ratings, concept },
    lessons: {
      ...progress.lessons,
      [lesson.id]: {
        status: lp?.status === 'completed' || lp?.status === 'tested-out' ? lp.status : 'in-progress',
        bestScore: lp?.bestScore ?? 0,
        stars: lp?.stars ?? 0,
        practised: lp?.practised ?? false,
        completedAt: lp?.completedAt,
        attempt,
        lastOpenedAt: now.toISOString(),
      },
    },
  };
}

/** Move to the next screen: choose the variant of a step when it is reached (§3.2). */
export function advanceAttempt(ctx: LessonCtx, attempt: AttemptState, progress: Progress): AttemptState {
  const i = Math.min(attempt.screenIndex + 1, attempt.sequence.length - 1);
  return ensureVariant(ctx, { ...attempt, screenIndex: i }, progress, attempt.sequence[i]);
}

export interface FactEntry {
  /** The step or explore screen that established it. */
  id: string;
  /** "Q1", or "From exploring" for explore takeaways. */
  label: string;
  text: string;
}

/**
 * The Facts panel in play order (§2.4): `establishes` of answered steps and takeaways of finished
 * explore screens, each labelled with where it came from.
 */
export function factEntries(
  lesson: Lesson,
  attempt: AttemptState,
  scope: Scope,
  label: (id: string) => string,
): FactEntry[] {
  const map = entryMap(lesson);
  const out: FactEntry[] = [];
  const seen = new Set<string>();
  for (const id of attempt.sequence.slice(0, attempt.screenIndex + 1)) {
    const e = map.get(id);
    let text: string | undefined;
    let lab = '';
    if (isStep(e) && e.establishes && attempt.answers[id]?.correct !== undefined) {
      text = renderTemplate(e.establishes, scope);
      lab = label(id);
    } else if (e?.type === 'explore' && (attempt.explore[id]?.taskIndex ?? 0) >= e.tasks.length) {
      text = renderTemplate(e.takeaway, scope);
      lab = 'From exploring';
    }
    if (text && !seen.has(text)) {
      seen.add(text);
      out.push({ id, label: lab, text });
    }
  }
  return out;
}
