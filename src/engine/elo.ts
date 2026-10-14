/** Elo-style ratings (§3.1). */

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export const INITIAL_RATING = 1000;

/** Question rating from its band, centred on the unit's base difficulty b: D = 780 + 150 × (difficulty − b). */
export function questionRating(difficulty: number, base: number): number {
  return 780 + 150 * (difficulty - base);
}

/**
 * Expected success p = 1 / (1 + 10^((D − R) / 400)). For an mcq with k options, correct for
 * guessing: p' = 1/k + (1 − 1/k) × p.
 */
export function expectedScore(rating: number, difficulty: number, base: number, options?: number): number {
  const p = 1 / (1 + 10 ** ((questionRating(difficulty, base) - rating) / 400));
  return options && options > 1 ? 1 / options + (1 - 1 / options) * p : p;
}

export function kFactor(answersInConcept: number): number {
  return answersInConcept < 10 ? 40 : 20;
}

export interface RatingState {
  subject: number;
  concept: { r: number; n: number };
}

/**
 * Update after one graded step (§3.1). The expected score uses the concept rating, which is what
 * drove the variant choice; the subject rating moves by K/2.
 */
export function updateRatings(
  state: RatingState,
  item: { difficulty: number; base: number; options?: number },
  score: number,
): RatingState {
  const p = expectedScore(state.concept.r, item.difficulty, item.base, item.options);
  const k = kFactor(state.concept.n);
  return {
    concept: { r: state.concept.r + k * (score - p), n: state.concept.n + 1 },
    subject: state.subject + (k / 2) * (score - p),
  };
}
