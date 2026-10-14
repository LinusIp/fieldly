import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkKatex, mathSegments, validateContent } from '../../scripts/validate-content';

const ROOT = join(import.meta.dirname, '..', '..');

describe('content validator — real content', () => {
  it('passes with zero errors', () => {
    const r = validateContent(join(ROOT, 'content'));
    expect(r.errors).toEqual([]);
    expect(r.index.subjects.map((s) => s.id)).toEqual([
      'calc1',
      'calc2',
      'phys1',
      'phys2',
      'linalg',
      'discrete',
      'dsa',
      'probstat',
    ]);
  }, 120_000);
});

describe('content validator — deliberately broken fixtures', () => {
  const r = validateContent(join(ROOT, 'tests', 'fixtures', 'content-broken'));
  const messages = r.errors.map((e) => `${e.where ?? ''} ${e.message}`);
  const warnings = r.warnings.map((e) => `${e.where ?? ''} ${e.message}`);
  const expectError = (re: RegExp) =>
    expect(
      messages.some((m) => re.test(m)),
      `no error matching ${re}`,
    ).toBe(true);

  it('catches structural errors (§13.2)', () => {
    expectError(/prerequisite subject "nosuchsubject"/);
    expectError(/lesson id "demo.u1.l3" should be "demo.u1.l2"/);
    expectError(/requires unknown concept "no-such-concept"/);
    expectError(/screens \(needs 15–25\)/);
    expectError(/the first screen must be a hook/);
    expectError(/explore screens \(needs ≥ 2\)/);
    expectError(/challenges \(needs exactly 2\)/);
    expectError(/needs ≥ 1 remediation step/);
    expectError(/core steps \(needs ≥ 6\)/);
    expectError(/core steps need `establishes`/);
    expectError(/unknown concept "missing-concept"/);
    expectError(/uses "s2", which comes later/);
    expectError(/needs ≥ 1 clueFor link/);
    expectError(/last core step must use ≥ 2/);
    expectError(/standard track uses 1 question kinds/);
    expectError(/challenge difficulty must strictly increase/);
    expectError(/recap.next "demo.u9.l9" is not a listed lesson/);
    expectError(/practice pool has 0 items/);
  });

  it('catches lesson files that are not listed or misnamed', () => {
    expect(r.errors.some((e) => e.file.endsWith('l9.yaml'))).toBe(true);
  });

  it('catches rendering errors', () => {
    expectError(/body: KaTeX/);
    expectError(/Undefined symbol Q/);
  });

  it('reports quality warnings', () => {
    expect(warnings.some((w) => /m-unused/.test(w))).toBe(true);
  });
});

describe('math extraction', () => {
  it('finds inline and display math, skipping code', () => {
    const segs = mathSegments('a $x^2$ b $$\\frac{1}{2}$$ `$not$` c');
    expect(segs).toEqual([
      { tex: '\\frac{1}{2}', display: true },
      { tex: 'x^2', display: false },
    ]);
  });
  it('reports KaTeX errors', () => {
    expect(checkKatex('$\\frac{1}{$')).toMatch(/KaTeX/);
    expect(checkKatex('$I = V/R$')).toBeNull();
  });
});
