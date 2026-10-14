import { describe, expect, it } from 'vitest';
import {
  arrayInsert,
  binarySearch,
  brackets,
  circularBuffer,
  dynamicArray,
  guessNumber,
  listReverse,
} from '../../src/interactives/algorithm-stepper/algorithms';
import { parseCell, parseNode, type Trace } from '../../src/interactives/algorithm-stepper/trace';
import { compareOutput } from '../../src/interactives/code-runner/compare';
import { generate } from '../../src/interactives/code-runner/generators';
import { runJsTests } from '../../src/interactives/code-runner/harness';
import {
  checkScope as parsonsScope,
  initialState as parsonsInit,
  solutionScope as parsonsSol,
} from '../../src/interactives/parsons/model';
import { mulberry32 } from '../../src/engine/params';

const cells = (t: Trace) => t.steps.map((s) => parseCell(s.correct));

describe('algorithm-stepper traces match reference implementations', () => {
  it('guess-number probes exactly the reference binary search guesses', () => {
    for (let n = 2; n <= 64; n++)
      for (let secret = 1; secret <= n; secret++) {
        const ref: number[] = [];
        let lo = 1;
        let hi = n;
        while (lo <= hi) {
          const m = (lo + hi) >> 1;
          ref.push(m);
          if (m === secret) break;
          if (m < secret) lo = m + 1;
          else hi = m - 1;
        }
        expect(cells(guessNumber({ n, secret })).map((c) => c! + 1)).toEqual(ref);
        expect(ref.length).toBeLessThanOrEqual(Math.ceil(Math.log2(n + 1)));
      }
  });

  it('binary-search probes match and report absence', () => {
    const rng = mulberry32(3);
    for (let k = 0; k < 200; k++) {
      const len = 1 + Math.floor(rng() * 20);
      const values = Array.from({ length: len }, (_, i) => i * 3 + Math.floor(rng() * 2));
      const target = Math.floor(rng() * (len * 3 + 2)) - 1;
      const probes: number[] = [];
      let lo = 0;
      let hi = len - 1;
      let found = false;
      while (lo <= hi) {
        const m = (lo + hi) >> 1;
        probes.push(m);
        if (values[m] === target) {
          found = true;
          break;
        }
        if (values[m] < target) lo = m + 1;
        else hi = m - 1;
      }
      const t = binarySearch({ values, target });
      const tc = t.steps.map((s) => s.correct);
      expect(tc.slice(0, probes.length).map((c) => parseCell(c))).toEqual(probes);
      expect(tc.at(-1) === 'absent').toBe(!found);
    }
  });

  it('dynamic-array grows exactly when full and counts copies like the reference', () => {
    for (let n = 1; n <= 40; n++) {
      let cap = 1;
      let size = 0;
      let copies = 0;
      const grows: boolean[] = [];
      for (let i = 0; i < n; i++) {
        const full = size === cap;
        grows.push(full);
        if (full) {
          copies += size;
          cap *= 2;
        }
        size++;
      }
      const t = dynamicArray({ appends: n, capacity: 1 });
      expect(t.steps.map((s) => s.correct === 'grow')).toEqual(grows);
      expect(t.final.vars?.['element copies so far']).toBe(copies);
      expect(copies).toBeLessThan(2 * n);
    }
  });

  it('array-insert shifts from the right and ends equal to splice', () => {
    const values = [4, 8, 15, 16, 23, 42];
    for (let index = 0; index <= values.length; index++) {
      const t = arrayInsert({ values, index, value: 99 });
      const expected = [...values];
      expected.splice(index, 0, 99);
      expect(t.final.array?.values).toEqual(expected);
      const shifts = cells(t).slice(0, -1);
      expect(shifts).toEqual(Array.from({ length: values.length - index }, (_, k) => values.length - 1 - k));
    }
  });

  it('list-reverse points each node back to its predecessor', () => {
    const values = ['a', 'b', 'c', 'd', 'e'];
    const t = listReverse({ values });
    expect(t.steps.map((s) => (s.correct === 'null' ? null : parseNode(s.correct)))).toEqual([
      null,
      0,
      1,
      2,
      3,
    ]);
    // Walk the final list from the new head.
    const nodes = t.final.list!.nodes;
    const out: (string | number)[] = [];
    for (let at: number | null = t.final.list!.pointers!.head ?? null; at !== null; at = nodes[at].next)
      out.push(nodes[at].value);
    expect(out).toEqual([...values].reverse());
  });

  it('brackets verdict matches a reference checker on random strings', () => {
    const ref = (s: string) => {
      const st: string[] = [];
      const pair: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
      for (const ch of s) {
        if (ch in pair) {
          if (st.pop() !== pair[ch]) return false;
        } else st.push(ch);
      }
      return st.length === 0;
    };
    const rng = mulberry32(11);
    const alphabet = '()[]{}';
    for (let k = 0; k < 500; k++) {
      const len = 1 + Math.floor(rng() * 12);
      let s = '';
      for (let i = 0; i < len; i++) s += alphabet[Math.floor(rng() * 6)];
      const t = brackets({ text: s });
      const last = t.steps.at(-1)!.correct;
      expect(last === 'balanced').toBe(ref(s));
    }
  });

  it('circular-buffer slots match a reference queue simulation', () => {
    const ops = ['e:1', 'e:2', 'e:3', 'd', 'e:4', 'e:5', 'd', 'd', 'e:6', 'e:7', 'd'];
    const cap = 4;
    let head = 0;
    let size = 0;
    const expected: number[] = [];
    for (const op of ops) {
      if (op === 'd') {
        expected.push(head);
        head = (head + 1) % cap;
        size--;
      } else {
        expected.push((head + size) % cap);
        size++;
      }
    }
    expect(cells(circularBuffer({ capacity: cap, ops }))).toEqual(expected);
  });
});

describe('code-runner helpers', () => {
  it('compares outputs', () => {
    expect(compareOutput([1, 2], [1, 2], 'exact')).toBe(true);
    expect(compareOutput([2, 1], [1, 2], 'exact')).toBe(false);
    expect(
      compareOutput(
        [
          [2, 3],
          [0, 1],
        ],
        [
          [0, 1],
          [2, 3],
        ],
        'unordered',
      ),
    ).toBe(true);
    expect(compareOutput(0.1 + 0.2, 0.3, 'float')).toBe(true);
    expect(compareOutput(0.31, 0.3, 'float')).toBe(false);
    expect(compareOutput(undefined, null, 'exact')).toBe(true);
  });

  it('generators are deterministic and self-consistent', () => {
    const a = generate('sortedTwoSum', { n: 1000 });
    expect(generate('sortedTwoSum', { n: 1000 })).toEqual(a);
    const [arr, target] = a.args as [number[], number];
    const [i, j] = a.expected as [number, number];
    expect(arr[i] + arr[j]).toBe(target);
    let pairs = 0;
    for (let p = 0; p < arr.length; p++)
      for (let q = p + 1; q < arr.length; q++) if (arr[p] + arr[q] === target) pairs++;
    expect(pairs).toBe(1);
    expect(arr.every((v, k) => k === 0 || v > arr[k - 1])).toBe(true);
    const r = generate('rangeSums', { n: 50, q: 20 });
    const [vals, queries] = r.args as [number[], [number, number][]];
    expect(r.expected).toEqual(queries.map(([l, h]) => vals.slice(l, h + 1).reduce((x, y) => x + y, 0)));
    const u = generate('rangeAdds', { n: 40, q: 15 });
    const [len, updates] = u.args as [number, [number, number, number][]];
    const naive = new Array<number>(len).fill(0);
    for (const [l, h, v] of updates) for (let k = l; k <= h; k++) naive[k] += v;
    expect(u.expected).toEqual(naive);
    const s = generate('longestUniqueSubstring', { n: 300, pool: 40, breakEvery: 10 });
    const str = s.args[0] as string;
    let best = 0;
    for (let p = 0; p < str.length; p++) {
      const seen = new Set<string>();
      for (let q = p; q < str.length && !seen.has(str[q]); q++) seen.add(str[q]);
      best = Math.max(best, seen.size);
    }
    expect(s.expected).toBe(best);
  });

  it('runs JavaScript tests and reports errors', () => {
    const code = 'function add(a, b) { return a + b; }';
    const out = runJsTests(
      code,
      'add',
      [
        [1, 2],
        [3, 4],
      ],
      () => 0,
    );
    expect(out).toEqual([
      { ok: true, value: 3, ms: 0 },
      { ok: true, value: 7, ms: 0 },
    ]);
    expect(runJsTests('function f() { throw new Error("boom") }', 'f', [[]], () => 0)).toEqual([
      { ok: false, error: 'boom', ms: 0 },
    ]);
    expect(runJsTests('syntax error here', 'f', [[]], () => 0)).toHaveProperty('error');
    expect(runJsTests('const x = 1;', 'f', [[]], () => 0)).toEqual({
      error: 'No function named f was defined.',
    });
  });
});

describe('parsons scoring', () => {
  const config = {
    language: 'python' as const,
    indent: true,
    lines: [
      { id: 'a', text: 'def f(n):' },
      { id: 'b', text: 'if n == 0:' },
      { id: 'c', text: 'return 1' },
      { id: 'd', text: 'return n * f(n - 1)' },
    ],
    distractors: [{ id: 'x', text: 'return f(n)' }],
    solution: [
      { id: 'a', indent: 0 },
      { id: 'b', indent: 1 },
      { id: 'c', indent: 2 },
      { id: 'd', indent: 1 },
    ],
  };
  it('requires order, indentation and no distractors', () => {
    expect(parsonsScope({ pool: [], answer: config.solution }, config)).toMatchObject({
      orderCorrect: true,
      indentCorrect: true,
      usedDistractors: 0,
    });
    const badIndent = config.solution.map((p) => ({ ...p, indent: 0 }));
    expect(parsonsScope({ pool: [], answer: badIndent }, config)).toMatchObject({
      orderCorrect: true,
      indentCorrect: false,
    });
    const withX = [...config.solution.slice(0, 3), { id: 'x', indent: 1 }];
    expect(parsonsScope({ pool: [], answer: withX }, config)).toMatchObject({
      orderCorrect: false,
      usedDistractors: 1,
      correctPrefix: 3,
    });
    expect(parsonsSol({ order: config.solution }, config)).toMatchObject({
      orderCorrect: true,
      indentCorrect: true,
    });
  });
  it('shuffles the pool deterministically', () => {
    expect(parsonsInit(config)).toEqual(parsonsInit(config));
    expect(parsonsInit(config).pool.sort()).toEqual(['a', 'b', 'c', 'd', 'x']);
  });
});
