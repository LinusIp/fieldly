import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateContent } from '../../scripts/validate-content';

/**
 * §13.2: "the reference lesson must pass with zero errors, and deliberately broken copies (a
 * colliding param set, a wrong challenge solution, bad LaTeX, an explore goal that is already
 * met) must each be caught."
 */

const ROOT = join(import.meta.dirname, '..', '..');
const LESSON = join(ROOT, 'content', 'phys2', 'u3', 'l2.yaml');
const original = readFileSync(LESSON, 'utf8');

/** A content dir with only phys2 and the given lesson text. */
function contentWith(lessonText: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'fieldly-ref-'));
  const content = join(dir, 'content');
  mkdirSync(join(content, 'phys2', 'u3'), { recursive: true });
  writeFileSync(join(content, 'subjects.yaml'), '[phys2]\n');
  const subject = readFileSync(join(ROOT, 'content', 'phys2', 'subject.yaml'), 'utf8').replace(
    /^prerequisites: .*$/m,
    'prerequisites: []',
  );
  writeFileSync(join(content, 'phys2', 'subject.yaml'), subject);
  for (const f of ['concepts.yaml', 'misconceptions.yaml'])
    copyFileSync(join(ROOT, 'content', 'phys2', f), join(content, 'phys2', f));
  writeFileSync(join(content, 'phys2', 'u3', 'l2.yaml'), lessonText);
  return content;
}

function errorsFor(mutate: (s: string) => string): string[] {
  const text = mutate(original);
  expect(text).not.toBe(original);
  return validateContent(contentWith(text), { runCode: false }).errors.map(
    (e) => `${e.where ?? ''} ${e.message}`,
  );
}

describe('reference lesson (§7.8)', () => {
  it('passes with zero errors', () => {
    const r = validateContent(contentWith(original), { runCode: false });
    expect(r.errors).toEqual([]);
    expect(r.index.subjects[0].units[2].lessons[1]).toMatchObject({
      id: 'phys2.u3.l2',
      available: true,
      screens: 17,
    });
  });

  it('catches a colliding param set (V·R and V²/R both 27)', () => {
    const errs = errorsFor((s) =>
      s.replace('    - { V: 12, R: 6 }\n', '    - { V: 12, R: 6 }\n    - { V: 9, R: 3 }\n'),
    );
    expect(errs.some((e) => /s4.standard .*within tolerance of the answer/.test(e))).toBe(true);
  });

  it('catches a wrong challenge solution', () => {
    const errs = errorsFor((s) =>
      s.replace(
        `solution: { netlist: ["B1 n1 0", "R1 n1 n2", "R2 n2 0"] }\n        par: { parts: 2 }`,
        `solution: { netlist: ["B1 n1 0", "R1 n1 0"] }\n        par: { parts: 2 }`,
      ),
    );
    expect(errs.some((e) => /ch1.easier .*does not pass check/.test(e))).toBe(true);
  });

  it('catches bad LaTeX', () => {
    const errs = errorsFor((s) =>
      s.replace('$$V = IR \\qquad\\text{so}\\qquad I = \\frac{V}{R}$$', '$$V = IR \\qquad I = \\frac{V}{R$$'),
    );
    expect(errs.some((e) => /c1 .*KaTeX/.test(e))).toBe(true);
  });

  it('catches an explore goal that is already met', () => {
    const errs = errorsFor((s) =>
      s.replace(
        'preset: ["B1 n1 0 4", "A1 n1 n2", "R1 n2 0 4"]',
        'preset: ["B1 n1 0 4", "A1 n1 n2", "R1 n2 0 2"]',
      ),
    );
    expect(errs.some((e) => /e1.tasks\[0\] .*already met before its solution/.test(e))).toBe(true);
  });
});
