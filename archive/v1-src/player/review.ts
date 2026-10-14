/** Review mode (§3.3): due questions shown standalone, with a new seed so the numbers change. */
import type { Lesson, Question, Step } from '../content/schema';
import type { SubjectContent } from '../content/types';
import { updateRatings } from '../engine/elo';
import { drawParams, randomSeed } from '../engine/params';
import { recordReviewAnswer } from '../engine/review';
import { localDay } from '../storage/progress';
import type { Progress } from '../storage/schema';
import { conceptRating, subjectOf, subjectRating } from './attempt';

export interface ReviewItem {
  key: string;
  lesson: Lesson;
  step: Step;
  question: Question;
}

export function parseKey(key: string): { lessonId: string; questionId: string } | null {
  const i = key.indexOf('#');
  if (i < 0) return null;
  return { lessonId: key.slice(0, i), questionId: key.slice(i + 1) };
}

/** Find the lesson, step and question behind a review key; null if the content has gone. */
export function resolveReviewItem(key: string, subjects: Map<string, SubjectContent>): ReviewItem | null {
  const k = parseKey(key);
  if (!k) return null;
  const lesson = subjects.get(subjectOf(k.lessonId))?.lessons[k.lessonId];
  if (!lesson) return null;
  for (const step of lesson.chain)
    for (const q of [step.variants.easier, step.variants.standard, step.variants.harder])
      if (q?.id === k.questionId) return { key, lesson, step, question: q };
  return null;
}

export interface ReviewResult {
  seed: number;
  selected: number[];
  hintsUsed: number;
  score: number;
  misconceptions: string[];
}

/** Apply a review answer: Leitner box, ratings, question history, misconceptions, activity. */
export function applyReviewAnswer(
  progress: Progress,
  item: ReviewItem,
  r: ReviewResult,
  now: Date,
): Progress {
  const sid = subjectOf(item.lesson.id);
  const upd = updateRatings(
    { subject: subjectRating(progress, sid), concept: conceptRating(progress, sid, item.step.concept) },
    item.question.difficulty,
    r.score,
  );
  const prevQ = progress.questions[item.key];
  const misconceptions = { ...progress.misconceptions };
  for (const m of r.misconceptions)
    misconceptions[m] = { count: (misconceptions[m]?.count ?? 0) + 1, lastSeen: now.toISOString() };
  const day = localDay(now);
  return {
    ...progress,
    ratings: {
      subject: { ...progress.ratings.subject, [sid]: upd.subject },
      concept: { ...progress.ratings.concept, [item.step.concept]: upd.concept },
    },
    questions: {
      ...progress.questions,
      [item.key]: {
        lastScore: r.score,
        attempts: (prevQ?.attempts ?? 0) + 1,
        version: item.question.version ?? 1,
      },
    },
    misconceptions,
    review: recordReviewAnswer(progress.review, item.key, r.score, now, r.seed),
    activity: { ...progress.activity, [day]: (progress.activity[day] ?? 0) + 1 },
  };
}

/** A seed whose parameters differ from the ones last shown (when the lesson has any choice). */
export function freshSeed(lesson: Lesson, lastSeed: number | undefined, random = randomSeed): number {
  let seed = random();
  if (lastSeed === undefined || !lesson.params) return seed;
  const last = JSON.stringify(drawParams(lesson.params, lastSeed).values);
  for (let i = 0; i < 50 && JSON.stringify(drawParams(lesson.params, seed).values) === last; i++)
    seed = random();
  return seed;
}

/** Drop review entries whose question no longer exists. */
export function pruneReview(progress: Progress, subjects: Map<string, SubjectContent>): Progress {
  const review = { ...progress.review };
  let changed = false;
  for (const key of Object.keys(review)) {
    const k = parseKey(key);
    if (!k || !subjects.has(subjectOf(k.lessonId))) continue; // subject not loaded: keep
    if (!resolveReviewItem(key, subjects)) {
      delete review[key];
      changed = true;
    }
  }
  return changed ? { ...progress, review } : progress;
}
