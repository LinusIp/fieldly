import { describe, expect, it } from 'vitest';
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
