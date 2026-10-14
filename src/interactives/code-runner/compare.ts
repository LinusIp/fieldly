/** Output comparators for code-runner tests (§9.2): exact, unordered, float(1e-6). */

export type Comparator = 'exact' | 'unordered' | 'float';

/** JSON round-trip so tuples/lists, null/None, etc. compare alike across languages. */
export function normalize(v: unknown): unknown {
  if (v === undefined) return null;
  return JSON.parse(JSON.stringify(v ?? null));
}

function deepEqual(a: unknown, b: unknown, tol: number | null): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    if (tol === null) return a === b;
    return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i], tol));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    return (
      ka.length === kb.length &&
      ka.every(
        (k, i) =>
          k === kb[i] && deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], tol),
      )
    );
  }
  return a === b;
}

function sortedTop(v: unknown): unknown {
  if (!Array.isArray(v)) return v;
  return [...v].sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
}

export function compareOutput(got: unknown, expected: unknown, comparator: Comparator): boolean {
  const g = normalize(got);
  const e = normalize(expected);
  switch (comparator) {
    case 'exact':
      return deepEqual(g, e, null);
    case 'unordered':
      return deepEqual(sortedTop(g), sortedTop(e), null);
    case 'float':
      return deepEqual(g, e, 1e-6);
  }
}

export function preview(v: unknown, max = 120): string {
  let s: string;
  try {
    s = JSON.stringify(normalize(v));
  } catch {
    s = String(v);
  }
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
