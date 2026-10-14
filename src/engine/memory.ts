/** Memory model: per-concept half-life spacing (§3.3). Times are ISO strings; Δ in days. */

export interface MemoryEntry {
  /** Half-life in days. */
  h: number;
  /** Last practised (ISO). */
  last: string;
  /** Marked due by failure propagation, cleared by its next practice. */
  dueOverride?: boolean;
  /** After tier-3 hint or "Show solution": serve a different item next time (§2.5). */
  freshNext?: boolean;
}

export const MAX_HALF_LIFE = 180;
const DAY = 86_400_000;

export function daysBetween(fromIso: string, to: Date): number {
  return Math.max(0, (to.getTime() - new Date(fromIso).getTime()) / DAY);
}

/** Recall estimate m = 2^(−Δ / h). */
export function recall(m: MemoryEntry, now: Date): number {
  return 2 ** (-daysBetween(m.last, now) / m.h);
}

export function isDue(m: MemoryEntry, now: Date): boolean {
  return m.dueOverride === true || recall(m, now) < 0.8;
}

/** After a graded answer in the concept. The first answer sets h = 1 day. */
export function updateMemory(prev: MemoryEntry | undefined, score: number, now: Date): MemoryEntry {
  const last = now.toISOString();
  if (!prev) return { h: 1, last };
  let h = prev.h;
  if (score >= 0.8) h *= isDue(prev, now) ? 2.5 : 1.3;
  else if (score >= 0.4) h *= 1.1;
  else h = Math.max(0.5, h * 0.5);
  return { h: Math.min(MAX_HALF_LIFE, h), last, freshNext: prev.freshNext };
}

/**
 * Implicit credit: a correct answer (≥ 0.8) refreshes each prerequisite whose rating is ≥ 1050:
 * h × 1.2 and `last` updated. Returns the updated entries only.
 */
export function implicitCredit(
  prereqs: { id: string; rating: number; memory?: MemoryEntry }[],
  score: number,
  now: Date,
): Record<string, MemoryEntry> {
  const out: Record<string, MemoryEntry> = {};
  if (score < 0.8) return out;
  for (const p of prereqs)
    if (p.memory && p.rating >= 1050)
      out[p.id] = { ...p.memory, h: Math.min(MAX_HALF_LIFE, p.memory.h * 1.2), last: now.toISOString() };
  return out;
}

/**
 * Failure propagation: a score < 0.4 marks the weakest prerequisite (lowest recall) as due.
 * Returns its id, or null.
 */
export function weakestPrerequisite(
  prereqs: { id: string; memory?: MemoryEntry }[],
  score: number,
  now: Date,
): string | null {
  if (score >= 0.4 || prereqs.length === 0) return null;
  let best: { id: string; m: number } | null = null;
  for (const p of prereqs) {
    const m = p.memory ? recall(p.memory, now) : 0;
    if (!best || m < best.m) best = { id: p.id, m };
  }
  return best?.id ?? null;
}
