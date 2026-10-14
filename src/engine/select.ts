/** Variant selection (§3.2). */

export type VariantKey = 'easier' | 'standard' | 'harder';
export const VARIANT_KEYS: VariantKey[] = ['easier', 'standard', 'harder'];

export interface Selection {
  variant: VariantKey;
  /** Last two graded steps both scored < 0.5: insert the remediation step for the missed step. */
  remediate: boolean;
  /** Last three graded steps all scored ≥ 0.8: offer the bonus step (the learner may skip it). */
  offerBonus: boolean;
}

/** The default band rule on p_std, the expected success on the standard variant. */
export function defaultVariant(pStd: number): VariantKey {
  if (pStd > 0.92) return 'harder';
  if (pStd < 0.6) return 'easier';
  return 'standard';
}

/**
 * Choose the variant for the next core step.
 * - `recent`: scores of the graded steps answered so far in this attempt, oldest first.
 * - `firstStepOfFirstLesson`: the very first core step of the first lesson a learner opens in a subject.
 */
export function selectVariant(pStd: number, recent: number[], firstStepOfFirstLesson = false): Selection {
  const n = recent.length;
  const struggling = n >= 2 && recent[n - 1] < 0.5 && recent[n - 2] < 0.5;
  const flying = n >= 3 && recent[n - 1] >= 0.8 && recent[n - 2] >= 0.8 && recent[n - 3] >= 0.8;
  if (firstStepOfFirstLesson) return { variant: 'standard', remediate: false, offerBonus: false };
  if (struggling)
    return { variant: pStd > 0.8 ? defaultVariant(pStd) : 'easier', remediate: true, offerBonus: false };
  if (flying)
    return { variant: pStd > 0.8 ? 'harder' : defaultVariant(pStd), remediate: false, offerBonus: true };
  return { variant: defaultVariant(pStd), remediate: false, offerBonus: false };
}
