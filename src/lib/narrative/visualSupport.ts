/**
 * Narrative Retell — Visual Support Layer
 *
 * Pure logic for "adaptive fade + stall reveal" scaffolding.
 * Decoupled from content tier: a Tier 3 story can still get strong visuals
 * after a stall. Visual support and content difficulty move on independent axes.
 *
 * Levels (higher = MORE support):
 *   3 = full scene cards (emoji + text)         — strong scaffold
 *   2 = emoji strip only                         — partial
 *   1 = sequence dots                            — minimal
 *   0 = none                                     — autonomous
 *
 * The displayed level = max(baselineFromAdaptiveLevel, stallReveal, manualOverride).
 * That guarantees: support never decreases mid-trial, and a struggling user
 * always gets MORE help, never less.
 */

export type VisualSupportLevel = 0 | 1 | 2 | 3;

/** Baseline visual support derived from the adaptive difficulty level (1-10). */
export function baselineSupport(adaptiveLevel: number): VisualSupportLevel {
  if (adaptiveLevel <= 3) return 3;
  if (adaptiveLevel <= 6) return 2;
  if (adaptiveLevel <= 8) return 1;
  return 0;
}

/**
 * Stall-driven reveal: as stallPromptIndex climbs (0..3 in the existing
 * 6/10/16/22-second ladder), progressively reveal more support.
 * Returns the level the stall ladder is "asking for". Caller takes the max
 * with baseline so we never drop below baseline.
 *
 *   stallIndex < 0  → no reveal
 *   stallIndex 0    → dots         (1)
 *   stallIndex 1    → emoji strip  (2)
 *   stallIndex 2+   → full cards   (3)
 */
export function stallRevealLevel(stallPromptIndex: number): VisualSupportLevel {
  if (stallPromptIndex < 0) return 0;
  if (stallPromptIndex === 0) return 1;
  if (stallPromptIndex === 1) return 2;
  return 3;
}

export interface ResolveSupportInput {
  adaptiveLevel: number;
  stallPromptIndex: number;
  /** Optional clinician/patient preference: 'extra' bumps baseline +1, 'minimal' caps at 1 */
  preference?: 'extra' | 'minimal' | null;
}

export function resolveVisualSupport({
  adaptiveLevel,
  stallPromptIndex,
  preference,
}: ResolveSupportInput): {
  level: VisualSupportLevel;
  baseline: VisualSupportLevel;
  stallReveal: VisualSupportLevel;
} {
  let baseline = baselineSupport(adaptiveLevel);
  if (preference === 'extra') {
    baseline = Math.min(3, baseline + 1) as VisualSupportLevel;
  } else if (preference === 'minimal') {
    baseline = Math.min(baseline, 1) as VisualSupportLevel;
  }
  const stallReveal = stallRevealLevel(stallPromptIndex);
  const level = Math.max(baseline, stallReveal) as VisualSupportLevel;
  return { level, baseline, stallReveal };
}
