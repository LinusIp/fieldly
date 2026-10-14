/** Concept mastery levels (§3.4). */

export type MasteryLevel = 'practised' | 'proficient' | 'mastered';

export interface MasteryEntry {
  level: MasteryLevel;
  /** When the concept first reached Proficient (ISO). */
  proficientAt?: string;
}

export interface ConceptRating {
  r: number;
  n: number;
  /** Last 4 graded answers. */
  recent: { itemId: string; score: number }[];
}

const DAY = 86_400_000;
const ORDER: MasteryLevel[] = ['practised', 'proficient', 'mastered'];

export function isProficientNow(c: ConceptRating): boolean {
  const recent = c.recent.slice(-4);
  const good = recent.filter((x) => x.score >= 0.8);
  return c.r >= 1150 && good.length >= 3 && new Set(good.map((x) => x.itemId)).size >= 2;
}

/**
 * The level after a graded answer. Levels only rise (a fading concept gets a "Needs review" badge
 * instead, §3.4). `context` says where the answer came from: a correct answer in a unit checkpoint,
 * or in a review ≥ 3 days after reaching Proficient, promotes Proficient to Mastered.
 */
export function nextMastery(
  prev: MasteryEntry | undefined,
  c: ConceptRating,
  answer: { score: number; context: 'lesson' | 'practice' | 'review' | 'checkpoint'; at: Date },
): MasteryEntry | undefined {
  if (c.n < 3) return prev;
  let entry: MasteryEntry = prev ?? { level: 'practised' };
  if (entry.level === 'practised' && isProficientNow(c))
    entry = { level: 'proficient', proficientAt: answer.at.toISOString() };
  if (entry.level === 'proficient' && answer.score >= 0.8 && entry.proficientAt) {
    const since = (answer.at.getTime() - new Date(entry.proficientAt).getTime()) / DAY;
    if (answer.context === 'checkpoint' || (answer.context === 'review' && since >= 3))
      entry = { ...entry, level: 'mastered' };
  }
  return entry;
}

export function levelAtLeast(level: MasteryLevel | undefined, min: MasteryLevel): boolean {
  return level !== undefined && ORDER.indexOf(level) >= ORDER.indexOf(min);
}

/** A concept whose recall falls below 0.5 shows "Needs review" but keeps its level. */
export function needsReview(recallEstimate: number): boolean {
  return recallEstimate < 0.5;
}
