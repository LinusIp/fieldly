/** Leitner review scheduling (§3.3). */

export type Box = 1 | 2 | 3 | 4 | 5;
export interface ReviewItem {
  box: Box;
  due: string; // ISO timestamp
}
export type ReviewQueue = Record<string, ReviewItem>;

export const BOX_INTERVAL_DAYS: Record<Box, number> = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
export const ENTER_THRESHOLD = 0.6;
export const PROMOTE_THRESHOLD = 0.8;
export const SESSION_SIZE = 10;

const DAY = 24 * 60 * 60 * 1000;

function dueFrom(now: Date, box: Box): string {
  return new Date(now.getTime() + BOX_INTERVAL_DAYS[box] * DAY).toISOString();
}

/** After a step is answered in a lesson: a score below 0.6 puts the item in box 1. */
export function recordLessonAnswer(queue: ReviewQueue, key: string, score: number, now: Date): ReviewQueue {
  if (score >= ENTER_THRESHOLD) return queue;
  return { ...queue, [key]: { box: 1, due: dueFrom(now, 1) } };
}

/** After a review answer: ≥ 0.8 moves up a box (past box 5 the item retires); otherwise back to box 1. */
export function recordReviewAnswer(queue: ReviewQueue, key: string, score: number, now: Date): ReviewQueue {
  const item = queue[key];
  const next = { ...queue };
  if (score >= PROMOTE_THRESHOLD) {
    const box = (item?.box ?? 1) + 1;
    if (box > 5) {
      delete next[key];
      return next;
    }
    next[key] = { box: box as Box, due: dueFrom(now, box as Box) };
  } else {
    next[key] = { box: 1, due: dueFrom(now, 1) };
  }
  return next;
}

/** Items due now, oldest due first, up to `limit`. */
export function dueItems(queue: ReviewQueue, now: Date, limit = SESSION_SIZE): string[] {
  return Object.entries(queue)
    .filter(([, it]) => new Date(it.due).getTime() <= now.getTime())
    .sort((a, b) => a[1].due.localeCompare(b[1].due) || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([k]) => k);
}

export function dueCount(queue: ReviewQueue, now: Date): number {
  return Object.values(queue).filter((it) => new Date(it.due).getTime() <= now.getTime()).length;
}
