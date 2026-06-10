/**
 * progressionSupport — explicit registry of which exercises participate in the
 * longitudinal clinical-progression / mastery analytics pipeline.
 *
 * WHY THIS EXISTS (Phase 1 data-integrity fix):
 *   Discourse / conversational exercises (narrative retell, conversation coach,
 *   conversation partner) emit raw clinical telemetry to `exercise_events`, but
 *   they do NOT run the per-game `clinical_progression_state` engine and do not
 *   produce the unified trial contract (level / supportUsed / progress credit).
 *   Previously this was implicit — analytics simply "ignored" them, which made
 *   it impossible to tell "no progression data because unsupported" from
 *   "no progression data because of a bug".
 *
 *   This module makes that boundary explicit and queryable, so dashboards and
 *   tests can assert it instead of silently dropping data.
 *
 * NOTE: this does NOT change any progression thresholds or adaptation logic.
 * It is purely a declarative classification used by analytics + tests.
 */

import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';

/**
 * Exercises that are intentionally NOT supported by progression analytics.
 * They are scored/clinically logged, but have no leveling/mastery curve yet.
 */
export const PROGRESSION_UNSUPPORTED_SLUGS = [
  'narrative_retell',
  'conversation_coach',
  'conversation_partner',
  'thought_continuation',
] as const;

export type ProgressionUnsupportedSlug =
  (typeof PROGRESSION_UNSUPPORTED_SLUGS)[number];

const UNSUPPORTED_SET = new Set<string>(PROGRESSION_UNSUPPORTED_SLUGS);

/**
 * True when an exercise feeds the progression/mastery analytics pipeline.
 * Accepts any slug variant (hyphen/underscore) — it is normalized first.
 */
export function isProgressionSupported(rawSlug: string): boolean {
  const slug = normalizeExerciseSlug(rawSlug);
  return !UNSUPPORTED_SET.has(slug);
}

/** True when an exercise is explicitly marked unsupported by progression. */
export function isProgressionUnsupported(rawSlug: string): boolean {
  return !isProgressionSupported(rawSlug);
}
