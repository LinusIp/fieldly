import { describe, expect, it } from 'vitest';
import { graphLogic, model } from '../../src/interactives/graph-manipulator/model';
import { approximate, effectiveN, riemannLogic } from '../../src/interactives/riemann-sum/model';
import { seriesLogic, taylorCoefficients } from '../../src/interactives/series-explorer/model';
import { makeResolveCtx, type ChallengeLogic } from '../../src/interactives/types';
import { evalNumber } from '../../src/engine/expr';
import { derivativeAt, integrate, maxAbsOn } from '../../src/engine/numeric';
import { renderTemplate } from '../../src/engine/template';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setup(logic: ChallengeLogic<any, any, any, any>, raw: unknown, scope: Record<string, unknown> = {}) {
  const config = logic.resolveConfig(
    logic.configSchema.parse(raw),
    makeResolveCtx(scope, evalNumber, renderTemplate),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const at = (state: any) => logic.checkScope(state, config);
  return { config, at };
}

describe('numeric helpers', () => {
  it('integrates, differentiates and bounds', () => {
    expect(integrate((x) => x * x, 0, 1)).toBeCloseTo(1 / 3, 10);
    expect(integrate(Math.sin, 0, Math.PI)).toBeCloseTo(2, 10);
    expect(integrate((x) => x, 1, 0)).toBeCloseTo(-0.5, 12);
    expect(derivativeAt(Math.sin, 0)).toBeCloseTo(1, 8);
    expect(derivativeAt((x) => x ** 3, 2)).toBeCloseTo(12, 6);
    expect(maxAbsOn((x) => x - 1, 0, 3)).toBe(2);
    // A hole is skipped, not reported as NaN.
    expect(maxAbsOn((x) => (x === 1 ? NaN : x), 0, 2, 4)).toBe(2);
  });
});

describe('graph-manipulator', () => {
  const raw = {
    f: 'k * x^2',
    view: { x: [-2, 3], y: [-1, 9] },
    controls: [
      { name: 'x0', min: -2, max: 3, step: 0.01, initial: 1, drag: true },
      { name: 'h', min: 0.001, max: 1, step: 0.001, initial: 0.5 },
      { name: 'a', min: 0, max: 3, step: 0.1, initial: 0 },
      { name: 'b', min: 0, max: 3, step: 0.1, initial: 2 },
    ],
    overlays: {
      tangent: 'x0',
      secant: { at: 'x0', h: 'h' },
      area: { a: 'a', b: 'b' },
      accumulation: { from: 0 },
    },
  };

  it('reports point, slopes, area and accumulation', () => {
    const { at } = setup(graphLogic, raw, { k: 1 });
    const s = at({ values: { x0: 1, h: 0.5, a: 0, b: 2 } });
    expect(s.x0).toBe(1);
    expect(s.fx0).toBeCloseTo(1, 10);
    expect(s.fpx0).toBeCloseTo(2, 6);
    expect(s.secantSlope).toBeCloseTo(2.5, 10); // (1.5² − 1²)/0.5
    expect(s.area).toBeCloseTo(8 / 3, 8);
    expect(s.Ax0).toBeCloseTo(1 / 3, 6);
    expect((s.maxDev as (a: number, b: number, c: number) => number)(0, 1, 0.5)).toBeCloseTo(0.5, 10);
    expect((s.fp as (x: number) => number)(3)).toBeCloseTo(6, 5);
  });

  it('uses lesson params and initial values', () => {
    const { config, at } = setup(graphLogic, raw, { k: 2 });
    const s = at(graphLogic.initialState(config));
    expect(s.fx0).toBeCloseTo(2, 10);
  });

  it('measures the gap to a target curve and the fit to data', () => {
    const { at } = setup(graphLogic, {
      f: 'm * x + c',
      view: { x: [0, 4], y: [0, 10] },
      controls: [
        { name: 'm', min: 0, max: 3, step: 0.1 },
        { name: 'c', min: 0, max: 3, step: 0.1 },
      ],
      overlays: {
        target: { f: '2 * x + 1' },
        data: [
          [0, 1],
          [1, 3],
          [2, 5],
        ],
      },
    });
    const exact = at({ values: { m: 2, c: 1 } });
    expect(exact.matchError).toBeCloseTo(0, 12);
    expect(exact.sse).toBeCloseTo(0, 12);
    const off = at({ values: { m: 2, c: 1.5 } });
    expect(off.matchError).toBeCloseTo(0.5, 10);
    expect(off.sse).toBeCloseTo(0.75, 10);
  });

  it('matches parametric and polar curves point by point', () => {
    const circle = setup(graphLogic, {
      mode: 'parametric',
      x: 'R * cos(t)',
      y: 'R * sin(t)',
      t: [0, '2*pi'],
      view: { x: [-3, 3], y: [-3, 3] },
      controls: [{ name: 'R', min: 0, max: 3, step: 0.1 }],
      overlays: { target: { x: '2 * cos(t)', y: '2 * sin(t)' } },
    });
    expect(circle.at({ values: { R: 2 } }).matchError).toBeCloseTo(0, 12);
    expect(circle.at({ values: { R: 1.5 } }).matchError).toBeCloseTo(0.5, 10);
    const rose = setup(graphLogic, {
      mode: 'polar',
      r: 'a * cos(2 t)',
      t: [0, '2*pi'],
      view: { x: [-2, 2], y: [-2, 2] },
      controls: [{ name: 'a', min: 0, max: 2, step: 0.1 }],
      overlays: { target: { r: 'cos(2 t)' } },
    });
    expect(rose.at({ values: { a: 1 } }).matchError).toBeCloseTo(0, 12);
  });

  it('rejects overlays that need function mode', () => {
    expect(() =>
      graphLogic.configSchema.parse({
        mode: 'polar',
        r: 't',
        t: [0, 1],
        view: { x: [0, 1], y: [0, 1] },
        controls: [{ name: 'a', min: 0, max: 1, step: 0.1 }],
        overlays: { tangent: 'a' },
      }),
    ).toThrow();
    // Overlay positions are expressions: an unknown name fails when the scope is computed.
    const bad = setup(graphLogic, { ...raw, overlays: { tangent: 'nope' } }, { k: 1 });
    expect(() => bad.at(graphLogic.initialState(bad.config))).toThrow(/nope/);
  });

  it('places overlays at expressions and follows control-dependent views', () => {
    const { config, at } = setup(
      graphLogic,
      {
        f: 'x^3',
        view: { x: ['a - w', 'a + w'], y: [-1, 30] },
        controls: [
          { name: 'h', min: 0.001, max: 1, step: 0.001, initial: 0.5 },
          { name: 'w', min: 0.1, max: 2, step: 0.1, initial: 1 },
        ],
        overlays: {
          secant: { at: 'a', h: 'h' },
          tangent: 'a',
          band: { y: 'a^3', eps: 0.1, x: 'a', dx: 'h' },
        },
      },
      { a: 2 },
    );
    const s = at({ values: { h: 0.1, w: 0.5 } });
    expect(s.x0).toBe(2);
    expect(s.fpx0).toBeCloseTo(12, 5);
    expect(s.secantSlope).toBeCloseTo(12 + 3 * 2 * 0.1 + 0.01, 9); // 3a² + 3ah + h²
    const m = model(config, { h: 0.1, w: 0.5 });
    expect(m.view.x).toEqual([1.5, 2.5]);
    expect(m.band).toEqual({ y: 8, eps: 0.1, x: 2, dx: 0.1 });
  });
});

describe('riemann-sum', () => {
  const sq = (x: number) => x * x;

  it('computes each rule', () => {
    expect(approximate(sq, 0, 1, 4, 'left')).toBeCloseTo(14 / 64, 12);
    expect(approximate(sq, 0, 1, 4, 'right')).toBeCloseTo(30 / 64, 12);
    expect(approximate(sq, 0, 1, 4, 'midpoint')).toBeCloseTo(21 / 64, 12);
    expect(approximate(sq, 0, 1, 4, 'trapezoid')).toBeCloseTo(22 / 64, 12);
    // Simpson is exact for cubics.
    expect(approximate((x) => x ** 3, 0, 2, 2, 'simpson')).toBeCloseTo(4, 12);
  });

  it('rounds odd n up for Simpson and exposes rule constants', () => {
    expect(effectiveN(5, 'simpson')).toBe(6);
    expect(effectiveN(5, 'midpoint')).toBe(5);
    const { at } = setup(riemannLogic, { f: 'x^2', a: 0, b: 1 });
    const s = at({ n: 3, rule: 'simpson' });
    expect(s.n).toBe(4);
    expect(s.rule).toBe(s.simpson);
    expect(s.exact).toBeCloseTo(1 / 3, 12);
    expect(s.error).toBeLessThan(1e-12);
    expect(evalNumber('rule == simpson and error < 0.01', s as Record<string, unknown>)).toBe(1);
  });

  it('uses a closed-form exact value when given', () => {
    const { at } = setup(riemannLogic, { f: 'sin(x)', a: 0, b: 'pi', exact: 2 });
    const s = at({ n: 10, rule: 'midpoint' });
    expect(s.exact).toBe(2);
    expect(s.error).toBeCloseTo(Math.abs(approximate(Math.sin, 0, Math.PI, 10, 'midpoint') - 2), 12);
  });
});

describe('series-explorer', () => {
  it('sums a geometric series', () => {
    const { at } = setup(seriesLogic, { mode: 'series', term: '1/2^n', NMax: 20, limit: 1 });
    const s = at({ k: 10 });
    expect(s.N).toBe(10);
    expect(s.SN).toBeCloseTo(1 - 2 ** -10, 12);
    expect(s.error).toBeCloseTo(2 ** -10, 12);
    expect(at({ k: 99 }).N).toBe(20);
  });

  it('builds Taylor polynomials from symbolic derivatives', () => {
    const c = taylorCoefficients('exp(x)', 0, 5, {});
    c.forEach((v, k) => expect(v).toBeCloseTo(1 / [1, 1, 2, 6, 24, 120][k], 12));
    const { at } = setup(seriesLogic, {
      mode: 'taylor',
      f: 'sin(x)',
      degreeMax: 9,
      interval: [-1, 1],
      at: 0.5,
      view: { x: [-4, 4], y: [-2, 2] },
    });
    const d1 = at({ k: 1 });
    const d3 = at({ k: 3 });
    expect(d1.error).toBeCloseTo(Math.abs(Math.sin(0.5) - 0.5), 12);
    expect(d3.maxErrorOnInterval as number).toBeLessThan(d1.maxErrorOnInterval as number);
    expect(d3.maxErrorOnInterval).toBeCloseTo(Math.abs(Math.sin(1) - (1 - 1 / 6)), 10);
  });

  it('accepts {N} and {degree} solutions', () => {
    const series = setup(seriesLogic, { mode: 'series', term: '1/n^2', NMax: 50 });
    expect(seriesLogic.solutionScope({ N: 12 }, series.config).N).toBe(12);
  });
});
