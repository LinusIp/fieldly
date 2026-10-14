/**
 * Analytics hook points (§3.5). v1 ships with a no-op adapter; a future backend could use
 * these events to recalibrate question difficulty and flag confusing questions.
 */
export type AnalyticsEvent =
  | {
      type: 'question-answered';
      lessonId: string;
      questionId: string;
      score: number;
      attempts: number;
      hintsUsed: number;
      review: boolean;
    }
  | { type: 'hint-opened'; lessonId: string; questionId: string; tier: number }
  | { type: 'challenge-checked'; lessonId: string; challengeId: string; variant: string; passed: boolean }
  | { type: 'lesson-completed'; lessonId: string; meanCore: number; stars: number };

export interface AnalyticsAdapter {
  track(event: AnalyticsEvent): void;
}

export const noopAnalytics: AnalyticsAdapter = { track: () => {} };

let adapter: AnalyticsAdapter = noopAnalytics;

export function setAnalyticsAdapter(a: AnalyticsAdapter): void {
  adapter = a;
}

export function track(event: AnalyticsEvent): void {
  try {
    adapter.track(event);
  } catch {
    /* analytics must never break the app */
  }
}
