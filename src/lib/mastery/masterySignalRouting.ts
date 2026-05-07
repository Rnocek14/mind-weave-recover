/**
 * masterySignalRouting — explicit routing contract for trial_mode → mastery.
 *
 * P0-A scope (semantic integrity fix, NOT a feature expansion):
 *
 *   - production trials  → contribute to expressive mastery (existing scalar math)
 *   - recognition trials → EXCLUDED from mastery computation
 *   - scaffolded  trials → EXCLUDED from mastery computation
 *   - exposure    trials → EXCLUDED from mastery computation
 *   - null/legacy        → preserved ONLY for non-adopted slugs;
 *                          for adopted slugs, skipped with a warning.
 *
 * Receptive / assisted / weighted / graded mastery tracks are deliberately
 * NOT implemented here. They belong to later phases. This module exists
 * solely to stop non-production trials from inflating expressive mastery.
 */

import type { MasteryTrial } from './computeMastery';

export type TrialModeTag =
  | 'production'
  | 'recognition'
  | 'scaffolded'
  | 'exposure'
  | 'mixed'
  | null
  | undefined;

export type RouteVerdict =
  | 'expressive'       // include in expressive mastery EWMA
  | 'excluded'         // dropped from mastery computation
  | 'skipped_unknown'; // adopted slug + missing tag → drop + warn

/**
 * Slugs that have adopted the per-trial trial_mode contract.
 *
 * Once a slug is adopted, missing trial_mode is treated as a defect
 * (skipped + warned) rather than silently inflating mastery.
 *
 * Keep this list narrow. Add a slug ONLY when its logger is verified
 * to emit trial_mode for every trial.
 */
const ADOPTED_TRIAL_MODE_SLUGS = new Set<string>([
  'photo-naming',
]);

export function isAdoptedForTrialMode(exerciseSlug: string): boolean {
  return ADOPTED_TRIAL_MODE_SLUGS.has((exerciseSlug || '').toLowerCase());
}

/**
 * Pure routing decision for a single trial.
 *
 * Adopted slugs:
 *   production   → expressive
 *   recognition  → excluded
 *   scaffolded   → excluded
 *   exposure     → excluded
 *   mixed        → excluded (mixed at the slug level means per-trial tagging
 *                  is required; if it leaks here as the per-trial value
 *                  treat it as an unknown signal and drop it)
 *   null/missing → skipped_unknown (warn upstream)
 *
 * Non-adopted slugs:
 *   any value    → expressive (preserve legacy behavior; existing scalar
 *                  math is unchanged)
 */
export function routeTrialMode(
  exerciseSlug: string,
  trialMode: TrialModeTag,
): RouteVerdict {
  if (!isAdoptedForTrialMode(exerciseSlug)) {
    return 'expressive';
  }
  switch (trialMode) {
    case 'production':
      return 'expressive';
    case 'recognition':
    case 'scaffolded':
    case 'exposure':
    case 'mixed':
      return 'excluded';
    default:
      return 'skipped_unknown';
  }
}

/**
 * Filter a batch of trials for one exercise slug down to those that
 * should contribute to expressive mastery. Emits a single aggregated
 * console warning when an adopted slug has missing trial_mode rows.
 */
export function filterTrialsForExpressiveMastery<
  T extends MasteryTrial,
>(exerciseSlug: string, trials: T[]): T[] {
  let unknownCount = 0;
  const kept: T[] = [];
  for (const t of trials) {
    const verdict = routeTrialMode(exerciseSlug, t.trialMode);
    if (verdict === 'expressive') {
      kept.push(t);
    } else if (verdict === 'skipped_unknown') {
      unknownCount++;
    }
  }
  if (unknownCount > 0) {
    console.warn(
      `[Mastery] ${unknownCount} trial(s) for adopted slug "${exerciseSlug}" ` +
        `had null/missing trial_mode and were skipped from expressive mastery.`,
    );
  }
  return kept;
}
