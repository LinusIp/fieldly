/**
 * Named generators for performance tests (§9.2 code-runner). Each builds one large, seeded test
 * case — arguments plus the expected output from a reference implementation — so a slow
 * (e.g. brute-force) solution fails the time limit while a correct fast one passes.
 */
import { mulberry32 } from '../../engine/params';

export interface GeneratedCase {
  args: unknown[];
  expected: unknown;
}

type Generator = (params: Record<string, number>, seed: number) => GeneratedCase;

function randInt(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export const generators: Record<string, Generator> = {
  /** Strictly increasing array of n ints and a target that is the sum of exactly one pair. */
  sortedTwoSum({ n }, seed) {
    const rng = mulberry32(seed);
    const arr: number[] = [];
    let x = randInt(rng, -1000, 0);
    for (let i = 0; i < n; i++) {
      x += randInt(rng, 1, 3);
      arr.push(x);
    }
    // Choose a pair; make the target unique by checking with two pointers.
    for (let attempt = 0; attempt < 1000; attempt++) {
      const i = randInt(rng, 0, n - 2);
      const j = randInt(rng, i + 1, n - 1);
      const target = arr[i] + arr[j];
      let count = 0;
      let lo = 0;
      let hi = n - 1;
      while (lo < hi) {
        const s = arr[lo] + arr[hi];
        if (s === target) {
          count++;
          lo++;
          hi--;
        } else if (s < target) lo++;
        else hi--;
      }
      if (count === 1) return { args: [arr, target], expected: [i, j] };
    }
    // Fallback: the two largest elements form a unique maximum sum.
    return { args: [arr, arr[n - 1] + arr[n - 2]], expected: [n - 2, n - 1] };
  },

  /** Random lowercase string of length n; expected = length of the longest substring without repeats. */
  longestUniqueSubstring({ n, alphabet = 26 }, seed) {
    const rng = mulberry32(seed);
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(97 + randInt(rng, 0, alphabet - 1));
    const last = new Map<string, number>();
    let best = 0;
    let start = 0;
    for (let i = 0; i < s.length; i++) {
      const p = last.get(s[i]);
      if (p !== undefined && p >= start) start = p + 1;
      last.set(s[i], i);
      best = Math.max(best, i - start + 1);
    }
    return { args: [s], expected: best };
  },

  /** Array of n ints and q [l, r] queries (inclusive); expected = the list of range sums. */
  rangeSums({ n, q }, seed) {
    const rng = mulberry32(seed);
    const arr = Array.from({ length: n }, () => randInt(rng, -100, 100));
    const prefix = [0];
    for (const v of arr) prefix.push(prefix[prefix.length - 1] + v);
    const queries: [number, number][] = [];
    const expected: number[] = [];
    for (let k = 0; k < q; k++) {
      const l = randInt(rng, 0, n - 1);
      const r = randInt(rng, l, n - 1);
      queries.push([l, r]);
      expected.push(prefix[r + 1] - prefix[l]);
    }
    return { args: [arr, queries], expected };
  },

  /** count_pairs(n) for the dependent nested loop: n(n − 1)/2, with n large. */
  dependentLoopCount({ n }) {
    return { args: [n], expected: (n * (n - 1)) / 2 };
  },

  /** power(x, n) with x close to 1 and a huge n — only O(log n) finishes in time. */
  fastPower({ n }) {
    const x = 1.0000001;
    return { args: [x, n], expected: Math.pow(x, n) };
  },
};

export function generate(name: string, params: Record<string, number>, seed = 12345): GeneratedCase {
  const g = generators[name];
  if (!g) throw new Error(`unknown generator "${name}"`);
  return g(params, seed);
}
