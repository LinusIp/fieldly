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
  }, 60_000);
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

  it('catches structural errors', () => {
    expectError(/prerequisite subject "nosuchsubject"/);
    expectError(/lesson id "demo.u1.l3" should be "demo.u1.l2"/);
    expectError(/unknown concept "missing-concept"/);
    expectError(/expected exactly 6 core steps, found 3/);
    expectError(/s1 difficulty must strictly increase/);
    expectError(/exactly 1 option must be correct/);
    expectError(/unknown misconception "no-such-misconception"/);
    expectError(/explanation is missing \*\*Connects to:\*\*/);
    expectError(/uses "s3" must point to an earlier step/);
    expectError(/steps with `uses` need `standaloneContext`/);
    expectError(/needs ≥ 1 `clueFor` link/);
    expectError(/last core step must use ≥ 2/);
    expectError(/unknown challenge type "no-such-type"/);
    expectError(/summary.next "demo.u9.l9" is not a listed lesson/);
  });

  it('catches lesson files that are not listed or misnamed', () => {
    expect(r.errors.some((e) => e.file.endsWith('l9.yaml'))).toBe(true);
  });

  it('catches number and rendering errors', () => {
    expectError(/two options both display "27 W"/);
    expectError(/Undefined symbol Q/);
    expectError(/intro: KaTeX/);
  });

  it('reports quality warnings', () => {
    expect(warnings.some((w) => /misconception "m-unused" is defined but never used/.test(w))).toBe(true);
    expect(warnings.some((w) => /worked example uses the same numbers/.test(w))).toBe(true);
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
