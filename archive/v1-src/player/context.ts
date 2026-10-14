import { createContext, useContext } from 'react';
import type { Lesson, Misconception } from '../content/schema';
import type { ContentIndex } from '../content/types';
import type { Scope } from '../engine/expr';
import type { AttemptState, Progress } from '../storage/schema';

export interface PlayerCtx {
  lesson: Lesson;
  index: ContentIndex;
  misconceptions: Map<string, Misconception>;
  conceptTitles: Map<string, string>;
  attempt: AttemptState;
  progress: Progress;
  scope: Scope;
  debug: boolean;
  /** Update this lesson's attempt. */
  setAttempt(fn: (a: AttemptState, p: Progress) => AttemptState): void;
  /** Update the whole progress object. */
  update(fn: (p: Progress) => Progress): void;
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
