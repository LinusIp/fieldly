/** Scoring (§2.6, §7.5) and completion/stars (§3.4). */

/** Score for one graded question. `hintTier` is the highest hint tier opened (0–3). */
export function stepScore(outcome: { correct: boolean; attempt: 1 | 2; hintTier: number }): number {
  if (!outcome.correct) return 0;
  if (outcome.attempt === 2 || outcome.hintTier >= 3) return 0.3;
  return [1, 0.8, 0.6][outcome.hintTier];
}

/** Score for a challenge or puzzle level (§7.5). */
export function challengeScore(outcome: {
  solved: boolean;
  hintTier: number;
  usedSolution: boolean;
}): number {
  if (outcome.usedSolution || !outcome.solved) return 0;
  return [1, 0.8, 0.6, 0.3][Math.min(outcome.hintTier, 3)];
}

export interface ChallengeOutcome {
  attempted: boolean;
  solved: boolean;
  usedTier3: boolean;
}

/** Completed: all core steps answered and both challenges attempted (§3.4). */
export function isCompleted(coreAnswered: boolean, challenges: ChallengeOutcome[]): boolean {
  return coreAnswered && challenges.length > 0 && challenges.every((c) => c.attempted);
}

/** ★ completed · ★★ mean core ≥ 0.7 · ★★★ mean core ≥ 0.9 and both challenges solved without tier 3. */
export function computeStars(input: {
  completed: boolean;
  meanCore: number;
  challenges: ChallengeOutcome[];
}): 0 | 1 | 2 | 3 {
  if (!input.completed) return 0;
  if (input.meanCore >= 0.9 && input.challenges.every((c) => c.solved && !c.usedTier3)) return 3;
  if (input.meanCore >= 0.7) return 2;
  return 1;
}

export function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}
