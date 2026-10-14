import { describe, expect, it } from 'vitest';
import { expectedScore, kFactor, questionRating, updateRatings } from '../../src/engine/elo';
import { isProficientNow, nextMastery } from '../../src/engine/mastery';
import { implicitCredit, isDue, recall, updateMemory, weakestPrerequisite } from '../../src/engine/memory';
import { challengeScore, computeStars, isCompleted, stepScore } from '../../src/engine/scoring';
import { defaultVariant, selectVariant } from '../../src/engine/select';

describe('elo (§3.1)', () => {
  it('centres question ratings on the unit base', () => {
    expect(questionRating(3, 3)).toBe(780);
    expect(questionRating(4, 3)).toBe(930);
    expect(questionRating(2, 3)).toBe(630);
  });
  it('gives p ≈ 0.78 / 0.60 / 0.89 at 1000 for base, one harder, one easier', () => {
    expect(expectedScore(1000, 3, 3)).toBeCloseTo(0.78, 2);
    expect(expectedScore(1000, 4, 3)).toBeCloseTo(0.6, 2);
    expect(expectedScore(1000, 2, 3)).toBeCloseTo(0.89, 2);
  });
  it('corrects mcq for guessing', () => {
    const p = expectedScore(1000, 4, 3);
    expect(expectedScore(1000, 4, 3, 4)).toBeCloseTo(0.25 + 0.75 * p, 10);
  });
  it('updates with K = 40 then 20, subject by K/2', () => {
    expect(kFactor(0)).toBe(40);
    expect(kFactor(9)).toBe(40);
    expect(kFactor(10)).toBe(20);
    const p = expectedScore(1000, 3, 3);
    const r = updateRatings({ subject: 1000, concept: { r: 1000, n: 0 } }, { difficulty: 3, base: 3 }, 1);
    expect(r.concept.r).toBeCloseTo(1000 + 40 * (1 - p));
    expect(r.concept.n).toBe(1);
    expect(r.subject).toBeCloseTo(1000 + 20 * (1 - p));
    const r2 = updateRatings({ subject: 1000, concept: { r: 1000, n: 12 } }, { difficulty: 3, base: 3 }, 0);
    expect(r2.concept.r).toBeCloseTo(1000 - 20 * p);
  });
});

describe('variant selection (§3.2)', () => {
  it('serves standard in the 0.60–0.92 band', () => {
    expect(defaultVariant(0.78)).toBe('standard');
    expect(defaultVariant(0.6)).toBe('standard');
    expect(defaultVariant(0.92)).toBe('standard');
    expect(defaultVariant(0.93)).toBe('harder');
    expect(defaultVariant(0.59)).toBe('easier');
  });
  it('steps down and remediates after two misses unless p_std > 0.80', () => {
    expect(selectVariant(0.78, [1, 0.3, 0])).toEqual({
      variant: 'easier',
      remediate: true,
      offerBonus: false,
    });
    expect(selectVariant(0.85, [0.3, 0])).toEqual({
      variant: 'standard',
      remediate: true,
      offerBonus: false,
    });
  });
  it('steps up and offers the bonus after three strong answers if p_std > 0.80', () => {
    expect(selectVariant(0.85, [0.3, 0.8, 1, 0.8])).toEqual({
      variant: 'harder',
      remediate: false,
      offerBonus: true,
    });
    expect(selectVariant(0.7, [1, 1, 1])).toEqual({
      variant: 'standard',
      remediate: false,
      offerBonus: true,
    });
  });
  it('serves standard first in a subject', () => {
    expect(selectVariant(0.3, [], true).variant).toBe('standard');
    expect(selectVariant(0.3, []).variant).toBe('easier');
  });
});

describe('scoring and stars (§2.6, §3.4, §7.5)', () => {
  it('scores steps', () => {
    expect(stepScore({ correct: true, attempt: 1, hintTier: 0 })).toBe(1);
    expect(stepScore({ correct: true, attempt: 1, hintTier: 1 })).toBe(0.8);
    expect(stepScore({ correct: true, attempt: 1, hintTier: 2 })).toBe(0.6);
    expect(stepScore({ correct: true, attempt: 1, hintTier: 3 })).toBe(0.3);
    expect(stepScore({ correct: true, attempt: 2, hintTier: 0 })).toBe(0.3);
    expect(stepScore({ correct: false, attempt: 2, hintTier: 0 })).toBe(0);
  });
  it('scores challenges', () => {
    expect(challengeScore({ solved: true, hintTier: 0, usedSolution: false })).toBe(1);
    expect(challengeScore({ solved: true, hintTier: 2, usedSolution: false })).toBe(0.6);
    expect(challengeScore({ solved: true, hintTier: 3, usedSolution: false })).toBe(0.3);
    expect(challengeScore({ solved: true, hintTier: 1, usedSolution: true })).toBe(0);
  });
  it('awards stars over both challenges', () => {
    const ok = { attempted: true, solved: true, usedTier3: false };
    expect(isCompleted(true, [ok, { ...ok, solved: false }])).toBe(true);
    expect(isCompleted(true, [ok, { ...ok, attempted: false }])).toBe(false);
    const both = [ok, ok];
    expect(computeStars({ completed: false, meanCore: 1, challenges: both })).toBe(0);
    expect(computeStars({ completed: true, meanCore: 0.5, challenges: both })).toBe(1);
    expect(computeStars({ completed: true, meanCore: 0.75, challenges: both })).toBe(2);
    expect(computeStars({ completed: true, meanCore: 0.95, challenges: both })).toBe(3);
    expect(
      computeStars({ completed: true, meanCore: 0.95, challenges: [ok, { ...ok, usedTier3: true }] }),
    ).toBe(2);
  });
});

describe('memory model (§3.3)', () => {
  const t0 = new Date('2026-01-01T00:00:00Z');
  const day = (n: number) => new Date(t0.getTime() + n * 86_400_000);
  it('starts at h = 1 and decays as 2^(−Δ/h)', () => {
    const m = updateMemory(undefined, 1, t0);
    expect(m.h).toBe(1);
    expect(recall(m, day(1))).toBeCloseTo(0.5);
    expect(isDue(m, day(0.2))).toBe(false);
    expect(isDue(m, day(0.4))).toBe(true);
  });
  it('updates h by the table, capped at 180', () => {
    const m = { h: 4, last: t0.toISOString() };
    expect(updateMemory(m, 0.9, day(4)).h).toBeCloseTo(10); // due → × 2.5
    expect(updateMemory(m, 0.9, day(0.1)).h).toBeCloseTo(5.2); // early → × 1.3
    expect(updateMemory(m, 0.5, day(1)).h).toBeCloseTo(4.4);
    expect(updateMemory(m, 0.2, day(1)).h).toBeCloseTo(2);
    expect(updateMemory({ h: 0.6, last: t0.toISOString() }, 0, day(1)).h).toBe(0.5);
    expect(updateMemory({ h: 100, last: t0.toISOString() }, 1, day(500)).h).toBe(180);
  });
  it('gives implicit credit and propagates failure', () => {
    const mem = { h: 2, last: t0.toISOString() };
    const credit = implicitCredit(
      [
        { id: 'a', rating: 1100, memory: mem },
        { id: 'b', rating: 1000, memory: mem },
      ],
      0.9,
      day(1),
    );
    expect(Object.keys(credit)).toEqual(['a']);
    expect(credit.a.h).toBeCloseTo(2.4);
    expect(implicitCredit([{ id: 'a', rating: 1100, memory: mem }], 0.5, day(1))).toEqual({});
    const weak = weakestPrerequisite(
      [
        { id: 'a', memory: { h: 10, last: t0.toISOString() } },
        { id: 'b', memory: { h: 1, last: t0.toISOString() } },
      ],
      0.2,
      day(2),
    );
    expect(weak).toBe('b');
    expect(weakestPrerequisite([{ id: 'a' }], 0.5, day(1))).toBeNull();
  });
});

describe('mastery (§3.4)', () => {
  const at = new Date('2026-01-10T00:00:00Z');
  const strong = {
    r: 1200,
    n: 6,
    recent: [
      { itemId: 'a', score: 1 },
      { itemId: 'b', score: 0.8 },
      { itemId: 'a', score: 1 },
      { itemId: 'c', score: 0.3 },
    ],
  };
  it('needs 3 answers before any level', () => {
    expect(nextMastery(undefined, { ...strong, n: 2 }, { score: 1, context: 'lesson', at })).toBeUndefined();
    expect(
      nextMastery(undefined, { r: 900, n: 3, recent: [] }, { score: 1, context: 'lesson', at })?.level,
    ).toBe('practised');
  });
  it('becomes proficient with rating ≥ 1150 and 3 of 4 strong answers on 2 items', () => {
    expect(isProficientNow(strong)).toBe(true);
    expect(isProficientNow({ ...strong, r: 1100 })).toBe(false);
    expect(isProficientNow({ ...strong, recent: strong.recent.map((x) => ({ ...x, itemId: 'same' })) })).toBe(
      false,
    );
    expect(nextMastery(undefined, strong, { score: 1, context: 'lesson', at })).toEqual({
      level: 'proficient',
      proficientAt: at.toISOString(),
    });
  });
  it('masters in a checkpoint, or in a review at least 3 days later', () => {
    const prof = { level: 'proficient' as const, proficientAt: at.toISOString() };
    const later = (d: string) => new Date(d);
    expect(
      nextMastery(prof, strong, { score: 1, context: 'review', at: later('2026-01-11T00:00:00Z') })?.level,
    ).toBe('proficient');
    expect(
      nextMastery(prof, strong, { score: 1, context: 'review', at: later('2026-01-13T00:00:00Z') })?.level,
    ).toBe('mastered');
    expect(nextMastery(prof, strong, { score: 1, context: 'checkpoint', at })?.level).toBe('mastered');
    expect(nextMastery(prof, strong, { score: 0.3, context: 'checkpoint', at })?.level).toBe('proficient');
  });
});
