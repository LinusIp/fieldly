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
  /**
   * Strictly increasing array of n ints and a target that is the sum of exactly one pair, placed
   * in the middle half so brute force is slow whichever end it starts from. Uniqueness by
   * construction: every value is a multiple of 4 except arr[i] ≡ 1 and arr[j] ≡ 2 (mod 4), so only
   * that pair sums to 3 (mod 4).
   */
  sortedTwoSum({ n }, seed) {
    const rng = mulberry32(seed);
    const arr: number[] = [];
    let x = 4 * randInt(rng, -2000, 0);
    for (let k = 0; k < n; k++) {
      x += 4 * randInt(rng, 1, 3);
      arr.push(x);
    }
    const i = randInt(rng, Math.floor(n / 4), Math.floor(n / 2) - 1);
    const j = randInt(rng, Math.floor(n / 2), Math.floor((3 * n) / 4));
    arr[i] += 1;
    arr[j] += 2;
    return { args: [arr, arr[i] + arr[j]], expected: [i, j] };
  },

  /**
   * String of length n over a pool of `pool` distinct characters, mostly cycling through the pool
   * (so windows of distinct characters are long) with a random character every ~`breakEvery`
   * positions. Expected = length of the longest substring without repeats. Long windows make
   * "extend from every start" brute force O(n · pool).
   */
  longestUniqueSubstring({ n, pool = 2000, breakEvery = 500 }, seed) {
    const rng = mulberry32(seed);
    let s = '';
    let c = 0;
    for (let k = 0; k < n; k++) {
      c = rng() < 1 / breakEvery ? randInt(rng, 0, pool - 1) : (c + 1) % pool;
      s += String.fromCharCode(0x4e00 + c);
    }
    const last = new Map<string, number>();
    let best = 0;
    let start = 0;
    for (let k = 0; k < s.length; k++) {
      const p = last.get(s[k]);
      if (p !== undefined && p >= start) start = p + 1;
      last.set(s[k], k);
      best = Math.max(best, k - start + 1);
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

  /** n and q updates [l, r, v] (add v to a[l..r], inclusive) on an all-zero array; expected = the final array. */
  rangeAdds({ n, q }, seed) {
    const rng = mulberry32(seed);
    const diff = new Array<number>(n + 1).fill(0);
    const updates: [number, number, number][] = [];
    for (let k = 0; k < q; k++) {
      const l = randInt(rng, 0, n - 1);
      const r = randInt(rng, l, n - 1);
      const v = randInt(rng, -100, 100);
      updates.push([l, r, v]);
      diff[l] += v;
      diff[r + 1] -= v;
    }
    const expected: number[] = [];
    let run = 0;
    for (let i = 0; i < n; i++) expected.push((run += diff[i]));
    return { args: [n, updates], expected };
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
