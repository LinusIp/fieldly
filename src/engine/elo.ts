export type Difficulty = 1 | 2 | 3 | 4 | 5;

export const INITIAL_RATING = 1000;

/** Question rating from its difficulty band: D = 700 + 150 × difficulty. */
export function questionRating(difficulty: number): number {
  return 700 + 150 * difficulty;
}

/** Expected success p = 1 / (1 + 10^((D − R) / 400)). */
export function expectedScore(rating: number, difficulty: number): number {
  return 1 / (1 + 10 ** ((questionRating(difficulty) - rating) / 400));
}

export function kFactor(answersInConcept: number): number {
  return answersInConcept < 10 ? 40 : 20;
}

export interface RatingState {
  subject: number;
  concept: { r: number; n: number };
}

/**
 * Update after one scored step (§3.1). The expected score is computed from the concept rating,
 * which is what drove the variant choice.
 */
export function updateRatings(state: RatingState, difficulty: number, score: number): RatingState {
  const p = expectedScore(state.concept.r, difficulty);
  const k = kFactor(state.concept.n);
  return {
    concept: { r: state.concept.r + k * (score - p), n: state.concept.n + 1 },
    subject: state.subject + (k / 2) * (score - p),
  };
}
