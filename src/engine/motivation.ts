/**
 * XP and streaks (§3.7). Pure functions over stored progress; days are local calendar days.
 */
import type { Progress } from '../storage/schema';
import { localDay } from './day';

const DAY_MS = 86_400_000;

/** XP for a graded item: round(10 × difficulty / 3 × score). Challenges and puzzle levels earn 3×. */
export function itemXp(difficulty: number, score: number, kind: 'item' | 'challenge' = 'item'): number {
  const base = Math.round(((10 * difficulty) / 3) * score);
  return kind === 'challenge' ? base * 3 : base;
}

export const LESSON_XP = 20;

/** Re-answering the same item within 24 h earns nothing (§3.7). */
export function earnsXp(progress: Progress, itemId: string, now = new Date()): boolean {
  const last = progress.items[itemId]?.lastAt;
  return !last || now.getTime() - new Date(last).getTime() >= DAY_MS;
}

export function addXp(progress: Progress, amount: number, now = new Date()): Progress {
  if (!(amount > 0)) return progress;
  const day = localDay(now);
  return {
    ...progress,
    xp: {
      total: progress.xp.total + amount,
      byDay: { ...progress.xp.byDay, [day]: (progress.xp.byDay[day] ?? 0) + amount },
    },
  };
}

function dayIndex(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

/**
 * The streak as it stands today: days missed since the last active day are covered by charges
 * (one each) while they last; otherwise the streak has lapsed to 0.
 */
export function streakNow(progress: Progress, now = new Date()): { days: number; charges: number } {
  const s = progress.streak;
  if (!s.lastDay) return { days: 0, charges: s.charges };
  const missed = dayIndex(localDay(now)) - dayIndex(s.lastDay) - 1;
  if (missed <= 0) return { days: s.current, charges: s.charges };
  if (missed <= s.charges) return { days: s.current, charges: s.charges - missed };
  return { days: 0, charges: 0 };
}

/**
 * Today counts towards the streak (a completed lesson, or 3 graded practice items). Missed days use a
 * charge each and keep the streak without extending it; with too few charges it restarts at 1.
 */
export function countActiveDay(progress: Progress, now = new Date()): Progress {
  const today = localDay(now);
  const s = progress.streak;
  if (s.lastDay === today) return progress;
  const before = streakNow(progress, now);
  const current = before.days + 1;
  return {
    ...progress,
    streak: { current, longest: Math.max(s.longest, current), lastDay: today, charges: before.charges },
  };
}

/** One streak charge per completed lesson or practice set; at most 2 (§3.7). */
export function earnCharge(progress: Progress): Progress {
  return { ...progress, streak: { ...progress.streak, charges: Math.min(2, progress.streak.charges + 1) } };
}

/** XP earned today. */
export function xpToday(progress: Progress, now = new Date()): number {
  return progress.xp.byDay[localDay(now)] ?? 0;
}
