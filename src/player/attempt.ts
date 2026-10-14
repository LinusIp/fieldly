/**
 * Pure attempt logic for the lesson player (§2, §3, §8). Every function takes the lesson and
 * progress and returns new values; the React layer only wires them to the store.
 */
import type { Lesson, Question, Step } from '../content/schema';
import { INITIAL_RATING, updateRatings } from '../engine/elo';
import type { Scope } from '../engine/expr';
import { buildOptions, type DisplayOption } from '../engine/options';
import { applyDerived, buildScope, randomSeed } from '../engine/params';
import { recordLessonAnswer } from '../engine/review';
import { computeStars, mean } from '../engine/scoring';
import { chooseVariant, modeFromHistory, targetP, type VariantKey } from '../engine/select';
import { renderTemplate } from '../engine/template';
import { localDay } from '../storage/progress';
import type { AttemptState, Progress } from '../storage/schema';

export function subjectOf(lessonId: string): string {
  return lessonId.split('.')[0];
}

export function stepMap(lesson: Lesson): Map<string, Step> {
  return new Map(lesson.chain.map((s) => [s.id, s]));
}

export function coreSteps(lesson: Lesson): Step[] {
  return lesson.chain.filter((s) => s.role === 'core');
}

/** "Q1"…"Q6" for core steps; remediation and bonus steps get descriptive labels. */
export function stepLabel(lesson: Lesson, stepId: string): string {
  const core = coreSteps(lesson);
  const i = core.findIndex((s) => s.id === stepId);
  if (i >= 0) return `Q${i + 1}`;
  const step = lesson.chain.find((s) => s.id === stepId);
  return step?.role === 'bonus' ? 'Bonus' : 'Extra practice';
}

export function questionKey(lessonId: string, questionId: string): string {
  return `${lessonId}#${questionId}`;
}

export function subjectRating(progress: Progress, subjectId: string): number {
  return progress.ratings.subject[subjectId] ?? INITIAL_RATING;
}

export function conceptRating(
  progress: Progress,
  subjectId: string,
  concept: string,
): { r: number; n: number } {
  return progress.ratings.concept[concept] ?? { r: subjectRating(progress, subjectId), n: 0 };
}

export function lessonScope(lesson: Lesson, seed: number): Scope {
  return buildScope(lesson.params, lesson.derived, seed);
}

/** The challenge has its own params, or inherits the lesson's (§7.5). */
export function challengeScope(lesson: Lesson, seed: number): Scope {
  const ch = lesson.challenge;
  if (ch.params) return buildScope(ch.params, ch.derived, (seed ^ 0x5bd1e995) >>> 0);
  return applyDerived(lessonScope(lesson, seed) as Record<string, number>, ch.derived);
}

/** Has the student opened any other lesson in this subject before? */
function isFirstInSubject(progress: Progress, lesson: Lesson): boolean {
  const sid = subjectOf(lesson.id);
  return !Object.entries(progress.lessons).some(
    ([id, l]) => id !== lesson.id && subjectOf(id) === sid && (l.status !== 'not-started' || l.attempt),
  );
}

export function newAttempt(lesson: Lesson, progress: Progress, now: Date, seed = randomSeed()): AttemptState {
  const sid = subjectOf(lesson.id);
  const ratingsBefore: Record<string, number> = {};
  for (const c of new Set([
    ...lesson.concepts,
    ...lesson.chain.map((s) => s.concept),
    lesson.challenge.concept,
  ]))
    ratingsBefore[c] = conceptRating(progress, sid, c).r;
  return {
    seed,
    stage: 'intro',
    stepIndex: 0,
    chosenVariants: {},
    insertedSteps: [],
    answers: {},
    facts: [],
    sequence: coreSteps(lesson).map((s) => s.id),
    factSteps: [],
    firstInSubject: isFirstInSubject(progress, lesson),
    ratingsBefore,
    lessonVersion: lesson.version,
    skippedSteps: [],
    startedAt: now.toISOString(),
  };
}

/** Scores of answered steps in sequence order (skipped bonus steps excluded). */
export function scoreHistory(attempt: AttemptState, upTo = attempt.sequence.length): number[] {
  return attempt.sequence
    .slice(0, upTo)
    .map((id) => attempt.answers[id]?.score)
    .filter((s): s is number => s !== undefined);
}

/** Choose (once) the variant for the step at `stepIndex` and store it. */
export function ensureVariant(lesson: Lesson, attempt: AttemptState, progress: Progress): AttemptState {
  const stepId = attempt.sequence[attempt.stepIndex];
  if (!stepId || attempt.chosenVariants[stepId]) return attempt;
  const step = stepMap(lesson).get(stepId);
  if (!step) return attempt;
  let variant: VariantKey = 'standard';
  if (step.role === 'core') {
    const rating = conceptRating(progress, subjectOf(lesson.id), step.concept).r;
    const mode = modeFromHistory(scoreHistory(attempt, attempt.stepIndex));
    const forceStandard = attempt.firstInSubject && attempt.stepIndex === 0;
    variant = chooseVariant(step.variants, rating, targetP(mode), { forceStandard });
  }
  return { ...attempt, chosenVariants: { ...attempt.chosenVariants, [stepId]: variant } };
}

export function currentQuestion(lesson: Lesson, attempt: AttemptState, stepId: string): Question | undefined {
  const step = stepMap(lesson).get(stepId);
  const v = attempt.chosenVariants[stepId] ?? 'standard';
  return step?.variants[v] ?? step?.variants.standard;
}

export function optionsFor(q: Question, scope: Scope, seed: number): DisplayOption[] {
  return buildOptions(q, scope, seed);
}

/** Auto-generated tier-2 hint from `uses` and the facts those steps established. */
export function buildsOnHint(lesson: Lesson, step: Step, q: Question, scope: Scope): string | null {
  if (q.hints.buildsOn) return renderTemplate(q.hints.buildsOn, scope);
  if (!step.uses?.length) return null;
  const steps = stepMap(lesson);
  const parts = step.uses.map((u) => {
    const s = steps.get(u);
    const fact = s?.establishes ? renderTemplate(s.establishes, scope) : '';
    return `${stepLabel(lesson, u)}: ${fact}`;
  });
  return `This builds on ${parts.join(' · ')}`;
}

export interface AnswerResult {
  stepId: string;
  question: Question;
  selected: number[];
  hintsUsed: number;
  score: number;
  /** Misconceptions behind the wrong options chosen. */
  misconceptions: string[];
}

/** Apply a finished step: ratings, question history, misconceptions, review queue, facts, insertions. */
export function applyAnswer(
  lesson: Lesson,
  attempt: AttemptState,
  progress: Progress,
  r: AnswerResult,
  scope: Scope,
  now: Date,
): { attempt: AttemptState; progress: Progress } {
  const sid = subjectOf(lesson.id);
  const step = stepMap(lesson).get(r.stepId)!;

  // Ratings.
  const cr = conceptRating(progress, sid, step.concept);
  const upd = updateRatings(
    { subject: subjectRating(progress, sid), concept: cr },
    r.question.difficulty,
    r.score,
  );
  const key = questionKey(lesson.id, r.question.id);
  const prevQ = progress.questions[key];
  const misconceptions = { ...progress.misconceptions };
  for (const m of r.misconceptions)
    misconceptions[m] = { count: (misconceptions[m]?.count ?? 0) + 1, lastSeen: now.toISOString() };
  const day = localDay(now);
  const nextProgress: Progress = {
    ...progress,
    ratings: {
      subject: { ...progress.ratings.subject, [sid]: upd.subject },
      concept: { ...progress.ratings.concept, [step.concept]: upd.concept },
    },
    questions: {
      ...progress.questions,
      [key]: { lastScore: r.score, attempts: (prevQ?.attempts ?? 0) + 1, version: r.question.version ?? 1 },
    },
    misconceptions,
    review: recordLessonAnswer(progress.review, key, r.score, now, attempt.seed),
    activity: { ...progress.activity, [day]: (progress.activity[day] ?? 0) + 1 },
  };

  // Attempt: answer, facts, inserted steps.
  let a: AttemptState = {
    ...attempt,
    answers: {
      ...attempt.answers,
      [r.stepId]: { selected: r.selected, hintsUsed: r.hintsUsed, score: r.score },
    },
  };
  if (step.establishes && !a.factSteps.includes(step.id)) {
    a = {
      ...a,
      facts: [...a.facts, renderTemplate(step.establishes, scope)],
      factSteps: [...a.factSteps, step.id],
    };
  }
  a = maybeInsert(lesson, a);
  return { attempt: a, progress: nextProgress };
}

/** After 2 misses in a row insert a remediation step; after 3 strong answers offer a bonus step. */
export function maybeInsert(lesson: Lesson, attempt: AttemptState): AttemptState {
  const idx = attempt.stepIndex;
  const history = scoreHistory(attempt, idx + 1);
  const mode = modeFromHistory(history);
  const inSeq = new Set(attempt.sequence);
  let insert: Step | undefined;
  if (mode === 'struggle') {
    const recent = attempt.sequence
      .slice(0, idx + 1)
      .filter((id) => attempt.answers[id]?.score !== undefined);
    const missed = recent.slice(-2);
    const nextCore = attempt.sequence.slice(idx + 1).find((id) => stepMap(lesson).get(id)?.role === 'core');
    const targets = [...missed.reverse(), ...(nextCore ? [nextCore] : [])];
    for (const t of targets) {
      insert = lesson.chain.find((s) => s.role === 'remediation' && s.remediates === t && !inSeq.has(s.id));
      if (insert) break;
    }
  } else if (mode === 'stretch') {
    insert = lesson.chain.find((s) => s.role === 'bonus' && !inSeq.has(s.id));
  }
  if (!insert) return attempt;
  const sequence = [...attempt.sequence];
  sequence.splice(idx + 1, 0, insert.id);
  return { ...attempt, sequence, insertedSteps: [...attempt.insertedSteps, insert.id] };
}

export function skipStep(attempt: AttemptState, stepId: string): AttemptState {
  return { ...attempt, skippedSteps: [...attempt.skippedSteps, stepId] };
}

/** Move to the next step, or to the challenge after the last one. */
export function advance(lesson: Lesson, attempt: AttemptState, progress: Progress): AttemptState {
  const next = attempt.stepIndex + 1;
  if (next >= attempt.sequence.length)
    return { ...attempt, stage: 'challenge', stepIndex: attempt.sequence.length };
  return ensureVariant(lesson, { ...attempt, stepIndex: next }, progress);
}

export function meanCoreScore(lesson: Lesson, attempt: AttemptState): number {
  return mean(coreSteps(lesson).map((s) => attempt.answers[s.id]?.score ?? 0));
}

/** Mark the lesson completed and compute stars; called when the summary is first reached. */
export function completeLesson(
  lesson: Lesson,
  attempt: AttemptState,
  progress: Progress,
  now: Date,
): { progress: Progress; stars: 0 | 1 | 2 | 3; meanCore: number } {
  const meanCore = meanCoreScore(lesson, attempt);
  const ch = attempt.challenge;
  const stars = computeStars({
    completed: true,
    meanCore,
    challengeSolved: !!ch?.solved && !ch.usedSolution,
    challengeUsedTier3: (ch?.hintsUsed ?? 0) >= 3,
  });
  const prev = progress.lessons[lesson.id];
  return {
    meanCore,
    stars,
    progress: {
      ...progress,
      lessons: {
        ...progress.lessons,
        [lesson.id]: {
          ...prev,
          status: 'completed',
          bestScore: Math.max(prev?.bestScore ?? 0, meanCore),
          stars: Math.max(prev?.stars ?? 0, stars) as 0 | 1 | 2 | 3,
          completedAt:
            prev?.completedAt && prev.status === 'completed' ? prev.completedAt : now.toISOString(),
          attempt: { ...attempt, stage: 'summary' },
          lastOpenedAt: now.toISOString(),
        },
      },
    },
  };
}

/** §3.5: when a question's version increases, its stored history is reset. */
export function resetStaleQuestions(lesson: Lesson, progress: Progress): Progress {
  let changed = false;
  const questions = { ...progress.questions };
  const review = { ...progress.review };
  for (const step of lesson.chain)
    for (const q of [step.variants.easier, step.variants.standard, step.variants.harder]) {
      if (!q) continue;
      const key = questionKey(lesson.id, q.id);
      const stored = questions[key];
      if (stored && stored.version < (q.version ?? 1)) {
        delete questions[key];
        delete review[key];
        changed = true;
      }
    }
  return changed ? { ...progress, questions, review } : progress;
}

/** Choose the challenge variant once (§3.2, same rule as steps, using the challenge's concept). */
export function ensureChallenge(
  lesson: Lesson,
  attempt: AttemptState,
  progress: Progress,
  initialState: (variant: VariantKey) => unknown,
): AttemptState {
  if (attempt.challenge) return attempt;
  const ch = lesson.challenge;
  const rating = conceptRating(progress, subjectOf(lesson.id), ch.concept).r;
  const mode = modeFromHistory(scoreHistory(attempt));
  const variant = chooseVariant(ch.variants, rating, targetP(mode));
  return {
    ...attempt,
    challenge: {
      variant,
      state: initialState(variant),
      hintsUsed: 0,
      checks: 0,
      solved: false,
      misconceptions: [],
    },
  };
}

/** Apply a solved challenge (or a shown solution) to ratings. */
export function applyChallengeScore(
  lesson: Lesson,
  progress: Progress,
  difficulty: number,
  score: number,
  now: Date,
): Progress {
  const sid = subjectOf(lesson.id);
  const concept = lesson.challenge.concept;
  const upd = updateRatings(
    { subject: subjectRating(progress, sid), concept: conceptRating(progress, sid, concept) },
    difficulty,
    score,
  );
  const day = localDay(now);
  return {
    ...progress,
    ratings: {
      subject: { ...progress.ratings.subject, [sid]: upd.subject },
      concept: { ...progress.ratings.concept, [concept]: upd.concept },
    },
    activity: { ...progress.activity, [day]: (progress.activity[day] ?? 0) + 1 },
  };
}

export function recordMisconception(progress: Progress, id: string, now: Date): Progress {
  const m = progress.misconceptions[id];
  return {
    ...progress,
    misconceptions: {
      ...progress.misconceptions,
      [id]: { count: (m?.count ?? 0) + 1, lastSeen: now.toISOString() },
    },
  };
}
