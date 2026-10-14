import { describe, expect, it } from 'vitest';
import { expectedScore, kFactor, questionRating, updateRatings } from '../../src/engine/elo';
import { evalBoolean, evalNumber, near } from '../../src/engine/expr';
import { formatNumber } from '../../src/engine/format';
import { buildOptions, type OptionQuestion } from '../../src/engine/options';
import {
  applyDerived,
  buildScope,
  drawParams,
  enumerateParamValues,
  mulberry32,
} from '../../src/engine/params';
import { dueItems, recordLessonAnswer, recordReviewAnswer } from '../../src/engine/review';
import { challengeScore, computeStars, conceptStatus, stepScore } from '../../src/engine/scoring';
import { chooseVariant, modeFromHistory, targetP } from '../../src/engine/select';
import { renderTemplate } from '../../src/engine/template';

describe('format', () => {
  it('handles the edge cases from §13.1', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(-2.5)).toBe('−2.5');
    expect(formatNumber(-2.5, { math: true })).toBe('-2.5');
    expect(formatNumber(1e-4)).toBe('1 × 10⁻⁴');
    expect(formatNumber(2.5e-4)).toBe('2.5 × 10⁻⁴');
    expect(formatNumber(2.5e-4, { math: true })).toBe('2.5 \\times 10^{-4}');
    expect(formatNumber(123456)).toBe('1.23 × 10⁵');
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
  });
  it('rounds to 3 significant figures and trims zeros', () => {
    expect(formatNumber(2 / 3)).toBe('0.667');
    expect(formatNumber(1.5)).toBe('1.5');
    expect(formatNumber(4.0)).toBe('4');
    expect(formatNumber(1234.5)).toBe('1230');
    expect(formatNumber(2.99999999)).toBe('3');
    expect(formatNumber(0.001)).toBe('0.001');
    expect(formatNumber(99999)).toBe('99999');
    expect(formatNumber(9.996e-4)).toBe('1 × 10⁻³');
  });
  it('respects sig', () => {
    expect(formatNumber(Math.PI, { sig: 5 })).toBe('3.1416');
  });
});

describe('expressions & templates', () => {
  it('evaluates with near()', () => {
    expect(near(1.005, 1)).toBe(true);
    expect(near(1.02, 1)).toBe(false);
    expect(evalBoolean('near(I, 0.5) and n == 3', { I: 0.501, n: 3 })).toBe(true);
    expect(evalNumber('V^2 / R', { V: 6, R: 3 })).toBe(12);
  });
  it('evaluates derivative() results numerically', () => {
    expect(evalNumber("derivative('x^2*sin(x)', 'x')", { x: 1 })).toBeCloseTo(2 * Math.sin(1) + Math.cos(1));
  });
  it('formats differently inside math', () => {
    const s = renderTemplate('Text {{x}} and ${{x}} \\Omega$', { x: 2.5e-4 });
    expect(s).toBe('Text 2.5 × 10⁻⁴ and $2.5 \\times 10^{-4} \\Omega$');
  });
  it('throws on unknown symbols', () => {
    expect(() => renderTemplate('{{Q}}', {})).toThrow(/Q/);
  });
});

describe('params', () => {
  it('is deterministic for a seed', () => {
    const spec = { sets: [{ V: 6 }, { V: 12 }, { V: 24 }] };
    expect(drawParams(spec, 42)).toEqual(drawParams(spec, 42));
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('samples ranges on the step grid', () => {
    const spec = { vars: { x: { min: 1, max: 2, step: 0.1 }, k: { values: [3, 5] } } };
    for (const v of enumerateParamValues(spec, 50)) {
      expect(Math.round(v.x * 10) / 10).toBe(v.x);
      expect(v.x).toBeGreaterThanOrEqual(1);
      expect(v.x).toBeLessThanOrEqual(2);
      expect([3, 5]).toContain(v.k);
    }
  });
  it('evaluates derived in order', () => {
    expect(applyDerived({ V: 6, R: 3 }, { I: 'V / R', P: 'V * I' })).toEqual({ V: 6, R: 3, I: 2, P: 12 });
    expect(buildScope({ sets: [{ V: 6, R: 3 }] }, { I: 'V/R' }, 1).I).toBe(2);
  });
});

describe('options', () => {
  const q: OptionQuestion = {
    id: 'q',
    answer: { expr: 'V / R', unit: 'A' },
    distractors: [
      { expr: 'V * R', unit: 'A', misconception: 'a' },
      { expr: 'R / V', unit: 'A', misconception: 'b' },
      { expr: 'V', unit: 'A', misconception: 'c' },
    ],
  };
  it('sorts computed options ascending', () => {
    const o = buildOptions(q, { V: 6, R: 3 }, 1);
    expect(o.map((x) => x.text)).toEqual(['0.5 A', '2 A', '6 A', '18 A']);
    expect(o.find((x) => x.correct)?.text).toBe('2 A');
  });
  it('shuffles static options deterministically', () => {
    const s: OptionQuestion = {
      ...q,
      answer: undefined,
      distractors: undefined,
      options: [
        { text: 'a', correct: true },
        { text: 'b', misconception: 'x' },
        { text: 'c', misconception: 'y' },
        { text: 'd', misconception: 'z' },
      ],
    };
    expect(buildOptions(s, {}, 5)).toEqual(buildOptions(s, {}, 5));
    expect(buildOptions({ ...s, fixedOrder: true }, {}, 5).map((x) => x.text)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('elo', () => {
  it('maps bands to ratings', () => {
    expect(questionRating(1)).toBe(850);
    expect(questionRating(3)).toBe(1150);
    expect(questionRating(5)).toBe(1450);
  });
  it('computes expected score', () => {
    expect(expectedScore(1150, 3)).toBeCloseTo(0.5);
    expect(expectedScore(1000, 1)).toBeCloseTo(1 / (1 + 10 ** (-150 / 400)));
  });
  it('updates with K = 40 then 20', () => {
    expect(kFactor(0)).toBe(40);
    expect(kFactor(9)).toBe(40);
    expect(kFactor(10)).toBe(20);
    const r = updateRatings({ subject: 1000, concept: { r: 1150, n: 0 } }, 3, 1);
    expect(r.concept.r).toBeCloseTo(1170);
    expect(r.concept.n).toBe(1);
    expect(r.subject).toBeCloseTo(1010);
    const r2 = updateRatings({ subject: 1000, concept: { r: 1150, n: 12 } }, 3, 0);
    expect(r2.concept.r).toBeCloseTo(1140);
    expect(r2.subject).toBeCloseTo(995);
  });
});

describe('variant selection', () => {
  const variants = { easier: { difficulty: 1 }, standard: { difficulty: 2 }, harder: { difficulty: 3 } };
  it('targets 0.78 by default', () => {
    expect(targetP(modeFromHistory([]))).toBe(0.78);
    // At R=1000: p = 0.70 / 0.50 / 0.30 → easier is closest to 0.78.
    expect(chooseVariant(variants, 1000, 0.78)).toBe('easier');
    // At R=1250: p = 0.92 / 0.80 / 0.64 → standard.
    expect(chooseVariant(variants, 1250, 0.78)).toBe('standard');
    // Strong student → harder.
    expect(chooseVariant(variants, 1400, 0.78)).toBe('harder');
  });
  it('applies streak rules', () => {
    expect(modeFromHistory([1, 0.3, 0])).toBe('struggle');
    expect(targetP('struggle')).toBe(0.9);
    expect(modeFromHistory([0.3, 0.8, 1, 0.8])).toBe('stretch');
    expect(targetP('stretch')).toBe(0.65);
    expect(modeFromHistory([1, 1])).toBe('default');
    expect(modeFromHistory([0, 1, 0])).toBe('default');
  });
  it('can force standard', () => {
    expect(chooseVariant(variants, 1000, 0.78, { forceStandard: true })).toBe('standard');
  });
});

describe('scoring', () => {
  it('scores steps per §2.4', () => {
    expect(stepScore({ correct: true, attempt: 1, hintsUsed: 0 })).toBe(1);
    expect(stepScore({ correct: true, attempt: 1, hintsUsed: 1 })).toBe(0.8);
    expect(stepScore({ correct: true, attempt: 1, hintsUsed: 2 })).toBe(0.6);
    expect(stepScore({ correct: true, attempt: 1, hintsUsed: 3 })).toBe(0.3);
    expect(stepScore({ correct: true, attempt: 2, hintsUsed: 0 })).toBe(0.3);
    expect(stepScore({ correct: false, attempt: 2, hintsUsed: 0 })).toBe(0);
  });
  it('scores challenges per §7.5', () => {
    expect(challengeScore({ solved: true, hintsUsed: 0, usedSolution: false })).toBe(1);
    expect(challengeScore({ solved: true, hintsUsed: 3, usedSolution: false })).toBe(0.3);
    expect(challengeScore({ solved: true, hintsUsed: 1, usedSolution: true })).toBe(0);
  });
  it('awards stars', () => {
    const base = { completed: true, challengeSolved: true, challengeUsedTier3: false };
    expect(computeStars({ ...base, completed: false, meanCore: 1 })).toBe(0);
    expect(computeStars({ ...base, meanCore: 0.5 })).toBe(1);
    expect(computeStars({ ...base, meanCore: 0.75 })).toBe(2);
    expect(computeStars({ ...base, meanCore: 0.95 })).toBe(3);
    expect(computeStars({ ...base, meanCore: 0.95, challengeUsedTier3: true })).toBe(2);
  });
  it('labels concepts after 3 answers', () => {
    expect(conceptStatus(1300, 2)).toBeNull();
    expect(conceptStatus(1300, 3)).toBe('Strong');
    expect(conceptStatus(1100, 3)).toBe('Developing');
    expect(conceptStatus(1000, 3)).toBe('Needs work');
  });
});

describe('Leitner review', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const day = 86400000;
  it('enters box 1 below 0.6', () => {
    expect(recordLessonAnswer({}, 'k', 0.8, now)).toEqual({});
    const q = recordLessonAnswer({}, 'k', 0.3, now);
    expect(q.k.box).toBe(1);
    expect(new Date(q.k.due).getTime() - now.getTime()).toBe(day);
  });
  it('promotes, demotes and retires', () => {
    let q = recordLessonAnswer({}, 'k', 0, now);
    q = recordReviewAnswer(q, 'k', 1, now);
    expect(q.k).toEqual({ box: 2, due: new Date(now.getTime() + 3 * day).toISOString() });
    q = recordReviewAnswer(q, 'k', 0.6, now);
    expect(q.k.box).toBe(1);
    q = { k: { box: 5, due: now.toISOString() } };
    expect(recordReviewAnswer(q, 'k', 0.9, now)).toEqual({});
  });
  it('lists due items oldest first, max 10', () => {
    const q: Record<string, { box: 1; due: string }> = {};
    for (let i = 0; i < 15; i++)
      q[`k${i}`] = { box: 1, due: new Date(now.getTime() - i * 1000).toISOString() };
    q.future = { box: 1, due: new Date(now.getTime() + day).toISOString() };
    const d = dueItems(q, now);
    expect(d.length).toBe(10);
    expect(d[0]).toBe('k14');
    expect(d).not.toContain('future');
  });
});
