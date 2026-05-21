/**
 * Minimal Pairs — level-specific clinical criteria (Phase 1 stub).
 *
 * Clinical basis & honest scope: see docs/clinical-evidence/minimal-pairs.md.
 * TL;DR: phonemic-discrimination impairment in aphasia is well-documented
 * (Robson et al. 2012; Binder et al. 2017). The first_listen / after_replay
 * support tiers are a CLINICAL DESIGN CHOICE reflecting patient-side
 * independence, not a literature-validated support hierarchy. Accuracy
 * bands, SUPPORT_CREDIT magnitudes, and trialWeight are CLINICALLY
 * MOTIVATED CALIBRATION DEFAULTS — tunable, not evidence-based constants.
 *
 * HONEST SCOPE NOTE
 * -----------------
 * Minimal Pairs is declared Archetype II (performance-pressure) in the
 * progression theory layer, but the runtime mechanics that make Levels 5+
 * meaningful (SNR injection, response-time pressure, retention demands,
 * acoustic similarity gradient under load) are NOT implemented yet.
 *
 * What IS implemented today is the content-tier ladder in `minimalPairsBank`:
 *   Tier 1 — distinct contrasts        (engine 1–3)
 *   Tier 2 — single-feature contrasts  (engine 4–7)
 *   Tier 3 — fast/similar (aspirational)(engine 8–10)
 *
 * Phase 1 readiness (matches `clinicalRungs.ts`):
 *   L1–L4  → ready (content-tier progression: distinct → single-feature)
 *   L5–L7  → thin (single-feature deepening, no pressure mechanics yet)
 *   L8     → aspirational (Phase 2; pressure mechanics)
 *
 * Per-trial support model (two tiers, per scope decision):
 *   first_listen   → independent (target)
 *   after_replay   → scaffolded (replay button used ≥ 1×)
 *
 * Pure module — no I/O, no React, no DB.
 */

import type { SupportLevel } from './clinicalProgression';
import { SUPPORT_CREDIT, trialCredit } from './clinicalProgression';

/**
 * Minimal Pairs support ranked from MOST scaffolded (0) to MOST independent.
 * The shared SupportLevel union also defines `after_multiple_replays` (rank 0)
 * which the Phase 1 wiring does not yet emit but is reserved for future
 * granularity.
 */
const SUPPORT_RANK: Record<string, number> = {
  after_multiple_replays: 0,
  after_replay: 1,
  first_listen: 2,
};

function rank(s: SupportLevel): number {
  return SUPPORT_RANK[s] ?? -1;
}

export interface MinimalPairsLevelSpec {
  level: number;
  description: string;
  /** Minimum support tier that counts as on-target evidence. */
  targetSupport: SupportLevel;
  minOnTargetAttempts: number;
  minOnTargetAccuracy: number;
  /** Phase 1 readiness — drives /games/:slug/about and clinical messaging. */
  readiness: 'ready' | 'thin' | 'aspirational';
  /**
   * Per-level divisor for `calculateMinimalPairsProgressDelta`. Mirrors the
   * Photo Naming + Fix Sentence calibration: early levels graduate quickly
   * (~3 sessions); later levels demand more evidence.
   */
  trialWeight: number;
  /**
   * PR5 (Phase 2.5): per-level content-selection contract. Pure metadata —
   * the runtime selector lives in `minimalPairsContentSelector.ts`. Lets
   * dev tools and tests describe what content/condition each level uses,
   * separately from the evidence/accuracy rule.
   */
  contentSelector?: {
    tierKey:
      | 'baseline'
      | 'place_contrast'
      | 'manner_contrast'
      | 'voicing_contrast'
      | 'degraded_signal'
      | 'triplet_rt';
    description: string;
    implemented: boolean;
  };
}

export const MINIMAL_PAIRS_LEVELS: Record<number, MinimalPairsLevelSpec> = {
  1: {
    level: 1,
    description: 'Distinct contrasts — easy to hear apart',
    targetSupport: 'after_replay',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.4,
    contentSelector: { tierKey: 'baseline', description: 'Engine difficulty bands handle L1–L3 content.', implemented: true },
  },
  2: {
    level: 2,
    description: 'Distinct contrasts — slightly faster pace',
    targetSupport: 'after_replay',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 0.55,
    contentSelector: { tierKey: 'baseline', description: 'Engine difficulty bands handle L1–L3 content.', implemented: true },
  },
  3: {
    level: 3,
    description: 'Distinct contrasts — independent on first listen',
    targetSupport: 'first_listen',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.75,
    contentSelector: { tierKey: 'baseline', description: 'Engine difficulty bands handle L1–L3 content.', implemented: true },
  },
  4: {
    level: 4,
    description: 'Place-of-articulation contrasts, quiet condition',
    targetSupport: 'first_listen',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 1.0,
    contentSelector: { tierKey: 'place_contrast', description: 'Place-of-articulation contrasts only, quiet listening.', implemented: true },
  },
  5: {
    level: 5,
    description: 'Manner-of-articulation contrasts, quiet condition',
    targetSupport: 'first_listen',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.75,
    readiness: 'thin',
    trialWeight: 1.25,
    contentSelector: { tierKey: 'manner_contrast', description: 'Manner-class contrasts (stop/fricative, nasal, affricate, liquid).', implemented: true },
  },
  6: {
    level: 6,
    description: 'Voicing contrasts, higher acoustic confusability',
    targetSupport: 'first_listen',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
    trialWeight: 1.7,
    contentSelector: { tierKey: 'voicing_contrast', description: 'Voicing contrasts (initial + final position).', implemented: true },
  },
  7: {
    level: 7,
    description: 'Discrimination under degraded signal (noise / low-pass)',
    targetSupport: 'first_listen',
    minOnTargetAttempts: 8,
    minOnTargetAccuracy: 0.8,
    readiness: 'aspirational',
    trialWeight: 2.0,
    contentSelector: {
      tierKey: 'degraded_signal',
      description: 'Requires SNR / low-pass injection in audio pipeline — NOT yet implemented; selector skips honestly.',
      implemented: false,
    },
  },
  8: {
    level: 8,
    description: 'Triplet (3-AFC) discrimination + reaction-time band',
    targetSupport: 'first_listen',
    minOnTargetAttempts: 8,
    minOnTargetAccuracy: 0.85,
    readiness: 'aspirational',
    trialWeight: 2.5,
    contentSelector: {
      tierKey: 'triplet_rt',
      description: 'Requires triplet trial type + RT-band scoring — NOT yet implemented; selector skips honestly.',
      implemented: false,
    },
  },
};

export function getMinimalPairsLevelSpec(level: number): MinimalPairsLevelSpec {
  return MINIMAL_PAIRS_LEVELS[level] ?? MINIMAL_PAIRS_LEVELS[1];
}

export function isOnTargetMinimalPairsTrial(
  trial: { support: SupportLevel },
  level: number,
): boolean {
  const spec = getMinimalPairsLevelSpec(level);
  return rank(trial.support) >= rank(spec.targetSupport);
}

export function evidenceMetForMinimalPairsLevel(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
): boolean {
  const spec = getMinimalPairsLevelSpec(level);
  const onTarget = trials.filter((t) => isOnTargetMinimalPairsTrial(t, level));
  if (onTarget.length < spec.minOnTargetAttempts) return false;
  const correct = onTarget.filter((t) => t.correct).length;
  return correct / onTarget.length >= spec.minOnTargetAccuracy;
}

/**
 * Cue-dependency gate (PR3). For Minimal Pairs the "cue" is patient-driven
 * audio replays: a trial that needed ≥1 replay = `after_replay` support, a
 * trial that succeeded `first_listen` = independent. When the level's
 * target is `first_listen` and the patient leans on replays for more than
 * this fraction of trials, a pending level-up is held even though raw
 * accuracy passes. Clinically motivated calibration default — mirrors the
 * 0.5 in-game adaptive guard, not an evidence-derived constant.
 */
export const MINIMAL_PAIRS_CUE_DEPENDENCY_BLOCK_THRESHOLD = 0.5;

export function cueDependencyForMinimalPairsSession(
  trials: Array<{ support: SupportLevel }>,
  level: number,
): number {
  if (trials.length === 0) return 0;
  const scaffolded = trials.filter((t) => !isOnTargetMinimalPairsTrial(t, level)).length;
  return scaffolded / trials.length;
}

export function isMinimalPairsCueDependencyBlocking(
  trials: Array<{ support: SupportLevel }>,
  level: number,
  threshold = MINIMAL_PAIRS_CUE_DEPENDENCY_BLOCK_THRESHOLD,
): boolean {
  return cueDependencyForMinimalPairsSession(trials, level) > threshold;
}

/**
 * Level-aware progress delta. Defaults to the level-specific `trialWeight`
 * so cadence matches PhotoNaming + FixSentence. Callers may still pass an
 * explicit override for tests or simulation.
 */
export function calculateMinimalPairsProgressDelta(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
  options: { trialWeight?: number } = {},
): number {
  const spec = getMinimalPairsLevelSpec(level);
  const weight = options.trialWeight ?? spec.trialWeight;
  let total = 0;
  for (const t of trials) {
    const base = trialCredit(t);
    if (base <= 0) continue;
    if (isOnTargetMinimalPairsTrial(t, level)) total += base * 1.25;
    else total += base * 0.4;
  }
  return total / weight;
}

export { SUPPORT_CREDIT };

/** Highest level whose contentSelector ships differentiated content. */
export function highestImplementedMinimalPairsLevel(): number {
  let max = 1;
  for (const [lvl, spec] of Object.entries(MINIMAL_PAIRS_LEVELS)) {
    if (spec.contentSelector?.implemented !== false) max = Math.max(max, Number(lvl));
  }
  return max;
}
