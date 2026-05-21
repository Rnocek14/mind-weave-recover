/**
 * masterySignalRouting — explicit routing contract for trial_mode → mastery.
 *
 * Slug contract: this module always normalizes via `normalizeExerciseSlug`.
 * The allowlist is keyed on canonical underscore form to match what
 * `useAdaptationTrialLogger` writes.
 *
 * P0-A scope (semantic integrity fix, NOT a feature expansion):
 *
 *   - production trials  → contribute to expressive mastery (existing scalar math)
 *   - recognition trials → EXCLUDED from mastery computation
 *   - scaffolded  trials → EXCLUDED from mastery computation
 *   - exposure    trials → EXCLUDED from mastery computation
 *   - null/legacy on adopted slug → skipped_unknown (warned)
 *   - non-adopted slugs → skipped_unknown (silent; preserves zero-rows
 *     property for games not yet wired with trial_mode emission)
 *
 * Receptive / assisted / weighted / graded mastery tracks are deliberately
 * NOT implemented here. They belong to later phases.
 */

import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';
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
  | 'excluded'         // dropped from mastery computation (recognition/scaffolded/exposure)
  | 'skipped_unknown'; // adopted slug + missing tag, OR non-adopted slug → drop

/**
 * Slugs that have adopted the per-trial trial_mode contract.
 *
 * Stored in canonical underscore form (matches `CANONICAL_SLUGS`).
 *
 * Keep this list narrow. Add a slug ONLY when its logger is verified
 * to emit trial_mode for every trial. Adding a slug whose game does not
 * yet emit trial_mode is safe — those trials become `skipped_unknown` with
 * a console warning. No mastery contamination.
 */
const ADOPTED_TRIAL_MODE_SLUGS = new Set<string>([
  'photo_naming',
  // fix_sentence is allowlisted in advance: trials currently lack trial_mode
  // and will be skipped_unknown (warned) until the FixSentence game starts
  // emitting `trial_mode='production'`. This is intentional — adoption is
  // ratcheted forward without contamination risk.
  'fix_sentence',
  // semantic_features: SemanticFeatureExercise emits trialMode='production'
  // on every submitTrial; SemanticFeatureGame's adaptation auto-logger is
  // disabled (autoLog:false) so no untagged rows leak into routing.
  'semantic_features',
]);

export function isAdoptedForTrialMode(exerciseSlug: string): boolean {
  return ADOPTED_TRIAL_MODE_SLUGS.has(normalizeExerciseSlug(exerciseSlug || ''));
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
 * Non-adopted slugs (TIGHTENED, see Phase 1+4):
 *   any value    → skipped_unknown (silent). The previous `expressive`
 *                  fallthrough silently routed every game into expressive
 *                  mastery the moment slug normalization was fixed.
 *                  Tightened to preserve the no-contamination property.
 */
export function routeTrialMode(
  exerciseSlug: string,
  trialMode: TrialModeTag,
): RouteVerdict {
  if (!isAdoptedForTrialMode(exerciseSlug)) {
    return 'skipped_unknown';
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
 * Non-adopted slugs are dropped silently (expected).
 */
export function filterTrialsForExpressiveMastery<
  T extends MasteryTrial,
>(exerciseSlug: string, trials: T[]): T[] {
  const adopted = isAdoptedForTrialMode(exerciseSlug);
  let unknownCount = 0;
  const kept: T[] = [];
  for (const t of trials) {
    const verdict = routeTrialMode(exerciseSlug, t.trialMode);
    if (verdict === 'expressive') {
      kept.push(t);
    } else if (verdict === 'skipped_unknown' && adopted) {
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
