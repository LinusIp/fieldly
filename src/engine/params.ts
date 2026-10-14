import { evaluate } from './expr';

export type ParamSpec =
  | { sets: Record<string, number>[] }
  | {
      vars: Record<string, { values: number[] } | { min: number; max: number; step: number }>;
    };

/** mulberry32 — small, fast, seedable PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff) + 1;
}

export interface DrawnParams {
  values: Record<string, number>;
  setIndex?: number;
}

function rangeCount(min: number, max: number, step: number): number {
  return Math.floor((max - min) / step + 1e-9) + 1;
}

/** Draw one parameter assignment deterministically from `seed`. */
export function drawParams(spec: ParamSpec | undefined, seed: number): DrawnParams {
  if (!spec) return { values: {} };
  const rng = mulberry32(seed);
  if ('sets' in spec) {
    const setIndex = Math.floor(rng() * spec.sets.length);
    return { values: { ...spec.sets[setIndex] }, setIndex };
  }
  const values: Record<string, number> = {};
  for (const [name, v] of Object.entries(spec.vars)) {
    if ('values' in v) {
      values[name] = v.values[Math.floor(rng() * v.values.length)];
    } else {
      const k = Math.floor(rng() * rangeCount(v.min, v.max, v.step));
      values[name] = Number((v.min + k * v.step).toPrecision(12));
    }
  }
  return { values };
}

/** Evaluate `derived` in declaration order, each seeing params and earlier derived values. */
export function applyDerived(
  values: Record<string, number>,
  derived: Record<string, string> | undefined,
): Record<string, number> {
  const scope: Record<string, number> = { ...values };
  if (!derived) return scope;
  for (const [name, expr] of Object.entries(derived)) {
    const v = evaluate(expr, scope);
    if (typeof v !== 'number') throw new Error(`derived ${name} = "${expr}" is not a number`);
    scope[name] = v;
  }
  return scope;
}

export function buildScope(
  spec: ParamSpec | undefined,
  derived: Record<string, string> | undefined,
  seed: number,
): Record<string, number> {
  return applyDerived(drawParams(spec, seed).values, derived);
}

/** Every parameter assignment the validator must check: each set, or `samples` seeded draws. */
export function enumerateParamValues(spec: ParamSpec | undefined, samples = 200): Record<string, number>[] {
  if (!spec) return [{}];
  if ('sets' in spec) return spec.sets.map((s) => ({ ...s }));
  const out: Record<string, number>[] = [];
  for (let i = 1; i <= samples; i++) out.push(drawParams(spec, i * 7919).values);
  return out;
}
