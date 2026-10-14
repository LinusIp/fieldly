import type { Concept, Lesson, Misconception, MixedSet, PuzzlePack, SpeedRound } from './schema';

/** Shapes of the JSON the content build emits into public/content/. */

export interface LessonMeta {
  id: string;
  title: string;
  concepts: string[];
  prerequisites: string[];
  tryFirst: boolean;
  /** false → listed in the syllabus but no valid lesson file yet ("Coming soon"). */
  available: boolean;
  estimatedMinutes?: number;
  screens?: number;
  coreSteps?: number;
  practiceItems?: number;
}

export interface UnitMeta {
  id: string;
  title: string;
  baseDifficulty: number;
  checkpointItems: number;
  lessons: LessonMeta[];
}

export interface MixedSetMeta {
  id: string;
  title: string;
  lessons: string[];
}

export interface SpeedRoundMeta {
  id: string;
  title: string;
  unlockAfter: string;
}

export interface PuzzlePackMeta {
  id: string;
  title: string;
  interactive: string;
  unlockAfter: string;
  levels: number;
}

export interface SubjectMeta {
  id: string;
  title: string;
  short: string;
  description: string;
  prerequisites: string[];
  background?: string;
  units: UnitMeta[];
  mixed: MixedSetMeta[];
  speed: SpeedRoundMeta[];
  /** Packs whose `unlockAfter` lesson belongs to this subject. */
  puzzles: PuzzlePackMeta[];
}

export interface ContentIndex {
  builtAt: string;
  subjects: SubjectMeta[];
}

export interface SubjectContent {
  id: string;
  concepts: Concept[];
  misconceptions: Misconception[];
  lessons: Record<string, Lesson>;
  mixed: Record<string, MixedSet>;
  speed: Record<string, SpeedRound>;
}

export type PuzzleContent = Record<string, PuzzlePack>;

/** Concept and misconception ids are namespaced by subject: "<subject>/<slug>" (§7.3). */
export function nsId(subject: string, slug: string): string {
  return slug.includes('/') ? slug : `${subject}/${slug}`;
}
