import { createContext, useContext } from 'react';
import type { Lesson } from '../content/schema';
import type { ContentIndex, SubjectContent } from '../content/types';
import type { Scope } from '../engine/expr';
import type { AttemptState, Progress } from '../storage/schema';
import type { LessonCtx } from './attempt';

export interface PlayerCtx {
  lesson: Lesson;
  lctx: LessonCtx;
  subject: SubjectContent;
  index: ContentIndex;
  attempt: AttemptState;
  progress: Progress;
  /** Lesson params + derived for this attempt's seed. */
  scope: Scope;
  /** True while the learner re-reads an earlier screen: everything is read-only. */
  readOnly: boolean;
  setAttempt(fn: (a: AttemptState, p: Progress) => AttemptState): void;
  update(fn: (p: Progress) => Progress): void;
  /** Leave the current screen (or, when re-reading, step forward through the history). */
  advance(): void;
  misconceptionShort(id: string): string | undefined;
  conceptTitle(slug: string): string;
  /** "Q3", "Extra practice", "Bonus" … for a step id. */
  stepLabel(id: string): string;
}

export const PlayerContext = createContext<PlayerCtx | null>(null);

export function usePlayer(): PlayerCtx {
  const c = useContext(PlayerContext);
  if (!c) throw new Error('usePlayer outside LessonPlayer');
  return c;
}

/** Replace the attempt of `lessonId` inside a progress object. */
export function withAttempt(p: Progress, lessonId: string, attempt: AttemptState): Progress {
  const lp = p.lessons[lessonId];
  if (!lp) return p;
  return { ...p, lessons: { ...p.lessons, [lessonId]: { ...lp, attempt } } };
}
