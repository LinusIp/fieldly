import { expectedScore } from './elo';

export type VariantKey = 'easier' | 'standard' | 'harder';
export const VARIANT_KEYS: VariantKey[] = ['easier', 'standard', 'harder'];

export const DEFAULT_TARGET = 0.78;
export const STRUGGLE_TARGET = 0.9;
export const STRETCH_TARGET = 0.65;

export type Mode = 'default' | 'struggle' | 'stretch';

/**
 * Situation from the scores of the steps answered so far in this attempt (§3.2):
 * last 2 both < 0.5 → struggle; last 3 all ≥ 0.8 → stretch.
 */
export function modeFromHistory(scores: number[]): Mode {
  const n = scores.length;
  if (n >= 2 && scores[n - 1] < 0.5 && scores[n - 2] < 0.5) return 'struggle';
  if (n >= 3 && scores[n - 1] >= 0.8 && scores[n - 2] >= 0.8 && scores[n - 3] >= 0.8) return 'stretch';
  return 'default';
}

export function targetP(mode: Mode): number {
  return mode === 'struggle' ? STRUGGLE_TARGET : mode === 'stretch' ? STRETCH_TARGET : DEFAULT_TARGET;
}

/** Pick the variant whose expected success is closest to the target. Ties go to the easier one. */
export function chooseVariant(
  variants: Partial<Record<VariantKey, { difficulty: number }>>,
  rating: number,
  target: number,
  opts: { forceStandard?: boolean } = {},
): VariantKey {
  if (opts.forceStandard && variants.standard) return 'standard';
  let best: VariantKey = 'standard';
  let bestGap = Infinity;
  for (const key of VARIANT_KEYS) {
    const v = variants[key];
    if (!v) continue;
    const gap = Math.abs(expectedScore(rating, v.difficulty) - target);
    if (gap < bestGap - 1e-12) {
      best = key;
      bestGap = gap;
    }
  }
  return best;
}
