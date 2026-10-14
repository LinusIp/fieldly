import { describe, expect, it } from 'vitest';
import { flushCodeChecks, runCodeChecks, type CodeIssue } from '../../scripts/code-check';

const config = {
  entry: { python: 'add', javascript: 'add' },
  starter: { python: 'def add(a, b):\n    return 0\n', javascript: 'function add(a, b) { return 0; }' },
  tests: [
    { args: [1, 2], expected: 3 },
    { args: [5, 5], expected: 10, hidden: true },
  ],
  comparator: 'exact' as const,
};

function check(solution: { python: string; javascript: string }, cfg: object = config): CodeIssue[] {
  const issues: CodeIssue[] = [];
  runCodeChecks(cfg, solution, (i) => issues.push(i));
  flushCodeChecks();
  return issues;
}

describe('code-runner reference solution checks', () => {
  it('accepts correct solutions in both languages', () => {
    const issues = check({
      python: 'def add(a, b):\n    return a + b\n',
      javascript: 'function add(a, b) { return a + b; }',
    });
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
  }, 120_000);

  it('rejects a wrong JavaScript solution', () => {
    const issues = check({
      python: 'def add(a, b):\n    return a + b\n',
      javascript: 'function add(a, b) { return a - b; }',
    });
    expect(
      issues.some((i) => i.level === 'error' && /JavaScript reference solution fails test 1/.test(i.message)),
    ).toBe(true);
  }, 120_000);

  it('rejects a wrong Python solution', () => {
    const issues = check({
      python: 'def add(a, b):\n    return a * b\n',
      javascript: 'function add(a, b) { return a + b; }',
    });
    expect(
      issues.some((i) => i.level === 'error' && /Python reference solution fails test 1/.test(i.message)),
    ).toBe(true);
  }, 120_000);

  it('rejects a solution that is too slow for the performance test', () => {
    const slow = {
      ...config,
      entry: { python: 'count_pairs', javascript: 'countPairs' },
      tests: [{ args: [5], expected: 10 }],
      comparator: 'float' as const,
      perf: { generator: 'dependentLoopCount', params: { n: 30000 }, timeLimitMs: 50 },
    };
    const issues = check(
      {
        python: 'def count_pairs(n):\n    return n * (n - 1) // 2\n',
        javascript:
          'function countPairs(n) { let c = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) c++; return c; }',
      },
      slow,
    );
    expect(issues.some((i) => /JavaScript reference solution took/.test(i.message))).toBe(true);
  }, 120_000);
});
