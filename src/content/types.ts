import type { Concept, Lesson, Misconception } from './schema';

/** Shapes of the JSON the content build emits into public/content/. */

export interface LessonMeta {
  id: string;
  title: string;
  concepts: string[];
  prerequisites: string[];
  /** false → listed in the syllabus but no lesson file yet ("Coming soon"). */
  available: boolean;
  estimatedMinutes?: number;
  coreSteps?: number;
}

export interface UnitMeta {
  id: string;
  title: string;
  baseDifficulty: number;
  lessons: LessonMeta[];
}

export interface SubjectMeta {
  id: string;
  title: string;
  short: string;
  description: string;
  prerequisites: string[];
  background?: string;
  units: UnitMeta[];
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
}
