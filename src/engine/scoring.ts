/** Score for one multiple-choice step (§2.4). `hintsUsed` counts hint tiers opened (0–3). */
export function stepScore(outcome: { correct: boolean; attempt: 1 | 2; hintsUsed: number }): number {
  if (!outcome.correct) return 0;
  if (outcome.attempt === 2) return 0.3;
  switch (outcome.hintsUsed) {
    case 0:
      return 1;
    case 1:
      return 0.8;
    case 2:
      return 0.6;
    default:
      return 0.3;
  }
}

/** Score for a challenge (§7.5). */
export function challengeScore(outcome: {
  solved: boolean;
  hintsUsed: number;
  usedSolution: boolean;
}): number {
  if (outcome.usedSolution || !outcome.solved) return 0;
  return [1, 0.8, 0.6, 0.3][Math.min(outcome.hintsUsed, 3)];
}

/** Stars (§3.4). */
export function computeStars(input: {
  completed: boolean;
  meanCore: number;
  challengeSolved: boolean;
  challengeUsedTier3: boolean;
}): 0 | 1 | 2 | 3 {
  if (!input.completed) return 0;
  if (input.meanCore >= 0.9 && input.challengeSolved && !input.challengeUsedTier3) return 3;
  if (input.meanCore >= 0.7) return 2;
  return 1;
}

export type ConceptStatus = 'Strong' | 'Developing' | 'Needs work';

/** Concept label on the profile; shown only after ≥ 3 answers. */
export function conceptStatus(r: number, n: number): ConceptStatus | null {
  if (n < 3) return null;
  if (r >= 1250) return 'Strong';
  if (r >= 1050) return 'Developing';
  return 'Needs work';
}

export function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}
