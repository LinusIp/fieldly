import { describe, expect, it } from 'vitest';
import { blanksModel, segmentsOf } from '../../src/widgets/blanks/model';
import { categorizeModel } from '../../src/widgets/categorize/model';
import { equivalent, parseNumber, sigFigsOf } from '../../src/widgets/common';
import { estimateModel } from '../../src/widgets/estimate/model';
import { expressionModel } from '../../src/widgets/expression/model';
import { findTheErrorModel } from '../../src/widgets/find-the-error/model';
import { hotspotModel } from '../../src/widgets/hotspot/model';
import { matchModel } from '../../src/widgets/match/model';
import { buildOptions, mcqModel } from '../../src/widgets/mcq/model';
import { multiModel } from '../../src/widgets/multi/model';
import { numericModel } from '../../src/widgets/numeric/model';
import { oddOneOutModel } from '../../src/widgets/odd-one-out/model';
import { orderModel } from '../../src/widgets/order/model';

const base = { id: 'q', difficulty: 2 as const, prompt: 'p' };
const ctx = (scope: Record<string, number> = {}) => ({ scope, seed: 1 });

describe('number parsing', () => {
  it('reads decimals, fractions and scientific notation', () => {
    expect(parseNumber('2.5')).toBe(2.5);
    expect(parseNumber('−3')).toBe(-3);
    expect(parseNumber('1/6')).toBeCloseTo(1 / 6);
    expect(parseNumber('2.5e-4')).toBe(2.5e-4);
    expect(parseNumber('2.5×10^-4')).toBeCloseTo(2.5e-4);
    expect(parseNumber('1,200')).toBe(1200);
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('1/0')).toBeNull();
  });
  it('counts significant figures', () => {
    expect(sigFigsOf('0.0450')).toBe(3);
    expect(sigFigsOf('1200')).toBe(2);
    expect(sigFigsOf('2.50')).toBe(3);
  });
});

describe('mcq', () => {
  const q = mcqModel.schema.parse({
    ...base,
    kind: 'mcq',
    answer: { expr: 'V / R', unit: 'A' },
    distractors: [
      { expr: 'V * R', unit: 'A', misconception: 'ohm-multiply' },
      { expr: 'R / V', unit: 'A', misconception: 'ohm-inverted' },
      { expr: 'V', unit: 'A', misconception: 'current-equals-voltage' },
    ],
  });
  it('grades and names the misconception', () => {
    expect(mcqModel.grade(q, 0, ctx({ V: 6, R: 3 })).correct).toBe(true);
    expect(mcqModel.grade(q, 1, ctx({ V: 6, R: 3 }))).toEqual({
      correct: false,
      misconception: 'ohm-multiply',
    });
  });
  it('sorts computed options and catches collisions after formatting', () => {
    expect(buildOptions(q, { V: 6, R: 3 }, 1).map((o) => o.text)).toEqual(['0.5 A', '2 A', '6 A', '18 A']);
    // §13.2's example: V·R and V²/R both show 27 with V = 9, R = 3.
    const clash = mcqModel.schema.parse({
      ...base,
      kind: 'mcq',
      answer: { expr: 'V^2 / R' },
      distractors: [
        { expr: 'V * R', misconception: 'a' },
        { expr: 'V', misconception: 'b' },
        { expr: 'R', misconception: 'c' },
      ],
    });
    expect(mcqModel.validate(clash, ctx({ V: 9, R: 3 }))).toContain('two options both display "27"');
  });
  it('lets predictions skip tags', () => {
    const pred = mcqModel.schema.parse({
      ...base,
      kind: 'mcq',
      graded: false,
      options: [{ text: 'a' }, { text: 'b', correct: true }],
    });
    expect(mcqModel.validate(pred, ctx())).toEqual([]);
  });
});

describe('multi', () => {
  const q = multiModel.schema.parse({
    ...base,
    kind: 'multi',
    options: [
      { text: 'a', correct: true },
      { text: 'b', correct: true },
      { text: 'c', misconception: 'm' },
    ],
  });
  it('is all-or-nothing with per-option marks', () => {
    expect(multiModel.grade(q, [0, 1], ctx()).correct).toBe(true);
    expect(multiModel.grade(q, [0], ctx())).toMatchObject({ correct: false, parts: [true, false, true] });
    expect(multiModel.grade(q, [0, 1, 2], ctx()).misconception).toBe('m');
  });
});

describe('numeric', () => {
  const q = numericModel.schema.parse({
    ...base,
    kind: 'numeric',
    answer: { expr: 'V / R', unit: 'A' },
    wrongAnswers: [{ expr: 'V * R', misconception: 'ohm-multiply' }],
  });
  const c = ctx({ V: 6, R: 3 });
  it('accepts values within 1% and matches typed misconceptions', () => {
    expect(numericModel.grade(q, '2', c).correct).toBe(true);
    expect(numericModel.grade(q, '2.01', c).correct).toBe(true);
    expect(numericModel.grade(q, '18', c)).toMatchObject({
      correct: false,
      misconception: 'ohm-multiply',
      interpretation: 'Too high.',
    });
    expect(numericModel.grade(q, '1', c)).toMatchObject({ correct: false, interpretation: 'Too low.' });
  });
  it('rejects wrong answers that coincide with the answer', () => {
    const bad = numericModel.schema.parse({
      ...q,
      wrongAnswers: [{ expr: '2 * V / (2 * R)', misconception: 'x' }],
    });
    expect(numericModel.validate(bad, c)[0]).toMatch(/within tolerance of the answer/);
  });
  it('notes wrong significant figures but accepts the value', () => {
    const sf = numericModel.schema.parse({ ...q, answer: { expr: '2/3' }, sigFigs: 3 });
    const g = numericModel.grade(sf, '0.667', c);
    expect(g.correct).toBe(true);
    expect(g.note).toBeUndefined();
    expect(numericModel.grade(sf, '0.6667', c).note).toMatch(/3 significant figures/);
  });
});

describe('expression', () => {
  const q = expressionModel.schema.parse({
    ...base,
    kind: 'expression',
    answer: { expr: '2 * V^2 / R', vars: { V: [1, 24], R: [1, 20] } },
    wrongAnswers: [{ expr: 'V^2 / (2*R)', misconception: 'series-parallel-confusion' }],
    allowedSymbols: ['V', 'R'],
  });
  it('grades by equivalence, not by form', () => {
    expect(expressionModel.grade(q, '2V^2/R', ctx()).correct).toBe(true);
    expect(expressionModel.grade(q, 'V*V*2/R', ctx()).correct).toBe(true);
    expect(expressionModel.grade(q, 'V^2/(2R)', ctx()).misconception).toBe('series-parallel-confusion');
    expect(expressionModel.grade(q, 'V^2/R', ctx()).correct).toBe(false);
  });
  it('refuses unknown symbols', () => {
    expect(expressionModel.grade(q, '2*V^2/Q', ctx()).interpretation).toMatch(/Q/);
  });
  it('skips points where either side is undefined', () => {
    expect(equivalent('sqrt(x)^2', 'x', { x: [-1, 1] })).toBe(true);
    expect(equivalent('x/x', '1', { x: [-1, 1] })).toBe(true);
  });
  it('substitutes lesson params into the correct answer', () => {
    const qp = expressionModel.schema.parse({
      ...base,
      kind: 'expression',
      answer: { expr: 'k * x^2', vars: { x: [0, 2] } },
    });
    const a = expressionModel.correctAnswer(qp, ctx({ k: 3 }));
    expect(expressionModel.grade(qp, a, ctx({ k: 3 })).correct).toBe(true);
  });
});

describe('blanks', () => {
  const q = blanksModel.schema.parse({
    ...base,
    kind: 'blanks',
    text: 'P = {{V}} V × {{I}} A = [[V * I]] W, and [[bigger|smaller]]; f = [[= 2*x]]',
  });
  it('parses blank syntax', () => {
    expect(segmentsOf('a [[1 ± 0.1]] b [[?x]]').filter((s) => s.blank)).toEqual([
      { blank: { type: 'number', expr: '1', abs: 0.1 }, fadeable: false },
      { blank: { type: 'number', expr: 'x' }, fadeable: true },
    ]);
  });
  it('grades each blank', () => {
    const c = ctx({ V: 6, I: 2 });
    expect(blanksModel.grade(q, ['12', 'bigger', 'x+x'], c)).toEqual({
      correct: true,
      parts: [true, true, true],
    });
    expect(blanksModel.grade(q, ['12', 'smaller', '2x'], c)).toEqual({
      correct: false,
      parts: [true, false, true],
    });
  });
});

describe('order', () => {
  const q = orderModel.schema.parse({
    ...base,
    kind: 'order',
    items: [
      { id: 'par2', text: 'two parallel', value: '2 * V^2 / R' },
      { id: 'one', text: 'one', value: 'V^2 / R' },
      { id: 'ser2', text: 'two series', value: 'V^2 / (2*R)' },
    ],
    orderBy: 'value-desc',
    wrongOrders: [{ order: ['ser2', 'one', 'par2'], misconception: 'more-resistors-more-power' }],
  });
  const c = ctx({ V: 6, R: 3 });
  it('computes the order from values and matches wrong orders', () => {
    expect(orderModel.correctAnswer(q, c)).toEqual(['par2', 'one', 'ser2']);
    expect(orderModel.grade(q, ['ser2', 'one', 'par2'], c)).toMatchObject({
      correct: false,
      parts: [false, true, false],
      misconception: 'more-resistors-more-power',
    });
  });
  it('rejects a wrong order equal to the correct one', () => {
    const bad = orderModel.schema.parse({
      ...q,
      wrongOrders: [{ order: ['par2', 'one', 'ser2'], misconception: 'x' }],
    });
    expect(orderModel.validate(bad, c)[0]).toMatch(/equals the correct order/);
  });
});

describe('categorize and match', () => {
  it('marks misplaced cards and fires their tags', () => {
    const q = categorizeModel.schema.parse({
      ...base,
      kind: 'categorize',
      buckets: ['Series', 'Parallel'],
      cards: [
        { text: 'same current', bucket: 'Series', misconception: 'sp' },
        { text: 'same voltage', bucket: 'Parallel', misconception: 'sp2' },
        { text: 'adds', bucket: 'Series' },
      ],
    });
    expect(categorizeModel.grade(q, ['Series', 'Series', 'Series'], ctx())).toEqual({
      correct: false,
      parts: [true, false, true],
      misconception: 'sp2',
    });
  });
  it('marks pairs', () => {
    const q = matchModel.schema.parse({
      ...base,
      kind: 'match',
      pairs: [
        { left: 'a', right: '1' },
        { left: 'b', right: '2' },
      ],
      extraRights: ['3'],
    });
    expect(matchModel.grade(q, [0, 2], ctx())).toEqual({ correct: false, parts: [true, false] });
    expect(matchModel.grade(q, [0, 1], ctx()).correct).toBe(true);
  });
});

describe('estimate, hotspot, find-the-error, odd-one-out', () => {
  it('scores estimates by band', () => {
    const q = estimateModel.schema.parse({
      ...base,
      kind: 'estimate',
      answer: { expr: '100' },
      range: [0, 500],
    });
    expect(estimateModel.grade(q, '105', ctx()).score).toBe(1);
    expect(estimateModel.grade(q, '120', ctx()).score).toBe(0.6);
    expect(estimateModel.grade(q, '300', ctx()).score).toBe(0.3);
  });
  it('grades taps, ordered or not', () => {
    const q = hotspotModel.schema.parse({
      ...base,
      kind: 'hotspot',
      on: { type: 'circuit-builder', config: {} },
      targets: ['R1', 'R2', 'R3'],
      answer: ['R1'],
      wrongTargets: { R2: 'parallel-gets-more' },
    });
    expect(hotspotModel.grade(q, ['R1'], ctx()).correct).toBe(true);
    expect(hotspotModel.grade(q, ['R2'], ctx()).misconception).toBe('parallel-gets-more');
    const ordered = hotspotModel.schema.parse({
      ...q,
      answer: ['R1', 'R3'],
      ordered: true,
      wrongTargets: undefined,
    });
    expect(hotspotModel.grade(ordered, ['R3', 'R1'], ctx()).correct).toBe(false);
  });
  it('needs the right line and the right fix', () => {
    const q = findTheErrorModel.schema.parse({
      ...base,
      kind: 'find-the-error',
      lines: ['V = 6', 'I = V × R = 18', 'P = 108'],
      errorLine: 1,
      fix: {
        kind: 'numeric',
        prompt: 'Correct current?',
        answer: { expr: '2' },
        wrongAnswers: [{ expr: '18', misconception: 'ohm-multiply' }],
      },
    });
    expect(findTheErrorModel.grade(q, { line: 1, fix: '2' }, ctx()).correct).toBe(true);
    expect(findTheErrorModel.grade(q, { line: 1, fix: '18' }, ctx())).toMatchObject({
      correct: false,
      misconception: 'ohm-multiply',
    });
    expect(findTheErrorModel.grade(q, { line: 2, fix: '2' }, ctx())).toMatchObject({
      correct: false,
      parts: [false, true],
    });
  });
  it('needs the odd item and the reason', () => {
    const q = oddOneOutModel.schema.parse({
      ...base,
      kind: 'odd-one-out',
      items: ['$1/x$', '$x^2$', '$x^3$', '$x^4$'],
      odd: 0,
      why: {
        kind: 'mcq',
        prompt: 'Why?',
        options: [
          { text: 'not a polynomial', correct: true },
          { text: 'odd', misconception: 'm' },
          { text: 'even', misconception: 'm2' },
        ],
      },
    });
    const right = oddOneOutModel.correctAnswer(q, ctx());
    expect(oddOneOutModel.grade(q, right, ctx()).correct).toBe(true);
    expect(oddOneOutModel.grade(q, { pick: 1, why: right.why }, ctx()).correct).toBe(false);
  });
});
