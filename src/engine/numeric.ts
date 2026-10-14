/**
 * Numerical helpers shared by the calculus tools (graph-manipulator, riemann-sum,
 * series-explorer) and their validators. Plain functions of `(x: number) => number`.
 */

export type RealFn = (x: number) => number;

/** Central-difference derivative with a step scaled to |x|. */
export function derivativeAt(f: RealFn, x: number): number {
  const h = 1e-5 * Math.max(1, Math.abs(x));
  return (f(x + h) - f(x - h)) / (2 * h);
}

function simpsonStep(f: RealFn, a: number, fa: number, b: number, fb: number) {
  const m = (a + b) / 2;
  const fm = f(m);
  return { m, fm, s: ((b - a) / 6) * (fa + 4 * fm + fb) };
}

/** Adaptive Simpson integration of f over [a, b] (signed; a > b gives the negative). */
export function integrate(f: RealFn, a: number, b: number, tol = 1e-10): number {
  if (a === b) return 0;
  if (a > b) return -integrate(f, b, a, tol);
  const fa = f(a);
  const fb = f(b);
  const whole = simpsonStep(f, a, fa, b, fb);
  const rec = (
    a0: number,
    fa0: number,
    b0: number,
    fb0: number,
    m0: number,
    fm0: number,
    s0: number,
    eps: number,
    depth: number,
  ): number => {
    const left = simpsonStep(f, a0, fa0, m0, fm0);
    const right = simpsonStep(f, m0, fm0, b0, fb0);
    const delta = left.s + right.s - s0;
    if (depth <= 0 || Math.abs(delta) <= 15 * eps) return left.s + right.s + delta / 15;
    return (
      rec(a0, fa0, m0, fm0, left.m, left.fm, left.s, eps / 2, depth - 1) +
      rec(m0, fm0, b0, fb0, right.m, right.fm, right.s, eps / 2, depth - 1)
    );
  };
  return rec(a, fa, b, fb, whole.m, whole.fm, whole.s, tol, 40);
}

/** Largest |g(x)| over `samples` evenly spaced points of [lo, hi] (ends included); non-finite values are skipped. */
export function maxAbsOn(g: RealFn, lo: number, hi: number, samples = 400): number {
  if (lo > hi) [lo, hi] = [hi, lo];
  let best = 0;
  for (let i = 0; i <= samples; i++) {
    const x = lo + ((hi - lo) * i) / samples;
    const v = Math.abs(g(x));
    if (Number.isFinite(v) && v > best) best = v;
  }
  return best;
}
