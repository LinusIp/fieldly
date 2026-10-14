import { describe, expect, it } from 'vitest';
import {
  addXp,
  countActiveDay,
  earnCharge,
  earnsXp,
  itemXp,
  streakNow,
  xpToday,
} from '../../src/engine/motivation';
import { emptyProgress } from '../../src/storage/migrations';
import type { Progress } from '../../src/storage/schema';

const day = (d: string) => new Date(`${d}T12:00:00`);

describe('XP (§3.7)', () => {
  it('earns round(10 × difficulty / 3 × score), 3× for challenges', () => {
    expect(itemXp(3, 1)).toBe(10);
    expect(itemXp(4, 0.8)).toBe(11);
    expect(itemXp(2, 0)).toBe(0);
    expect(itemXp(3, 1, 'challenge')).toBe(30);
  });
  it('adds to the total and to the day', () => {
    const p = addXp(addXp(emptyProgress(), 10, day('2026-10-14')), 5, day('2026-10-14'));
    expect(p.xp.total).toBe(15);
    expect(xpToday(p, day('2026-10-14'))).toBe(15);
    expect(addXp(p, 0).xp.total).toBe(15);
  });
  it('earns nothing for re-answering the same item within 24 h', () => {
    const p: Progress = {
      ...emptyProgress(),
      items: { 'l#q': { lastScore: 1, attempts: 1, lastAt: '2026-10-14T10:00:00.000Z', version: 1 } },
    };
    expect(earnsXp(p, 'l#q', new Date('2026-10-14T20:00:00Z'))).toBe(false);
    expect(earnsXp(p, 'l#q', new Date('2026-10-15T10:00:00Z'))).toBe(true);
    expect(earnsXp(p, 'other', new Date('2026-10-14T20:00:00Z'))).toBe(true);
  });
});

describe('streaks (§3.7)', () => {
  it('extends on consecutive days and counts a day once', () => {
    let p = countActiveDay(emptyProgress(), day('2026-10-10'));
    p = countActiveDay(p, day('2026-10-10'));
    p = countActiveDay(p, day('2026-10-11'));
    expect(p.streak).toMatchObject({ current: 2, longest: 2, lastDay: '2026-10-11' });
    expect(streakNow(p, day('2026-10-12')).days).toBe(2);
  });
  it('a missed day uses a charge and keeps the streak without extending it', () => {
    let p = earnCharge(earnCharge(earnCharge(countActiveDay(emptyProgress(), day('2026-10-10')))));
    expect(p.streak.charges).toBe(2);
    expect(streakNow(p, day('2026-10-12'))).toEqual({ days: 1, charges: 1 });
    p = countActiveDay(p, day('2026-10-12'));
    expect(p.streak).toMatchObject({ current: 2, charges: 1 });
  });
  it('lapses to zero when the missed days outnumber the charges', () => {
    const p = countActiveDay(emptyProgress(), day('2026-10-10'));
    expect(streakNow(p, day('2026-10-13'))).toEqual({ days: 0, charges: 0 });
    expect(countActiveDay(p, day('2026-10-13')).streak.current).toBe(1);
  });
});
