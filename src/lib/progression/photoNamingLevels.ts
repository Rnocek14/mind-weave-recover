/**
 * Photo Naming — level-specific clinical criteria.
 *
 * Clinical basis & honest scope: see docs/clinical-evidence/photo-naming.md.
 * TL;DR: cueing-hierarchy direction is well-supported (Linebaugh & Lehner
 * 1977; Boyle & Coelho 1995; Kiran & Thompson 2003). The specific numeric
 * thresholds shipped here (accuracy bars, SUPPORT_CREDIT magnitudes,
 * trialWeight) are CLINICALLY MOTIVATED CALIBRATION DEFAULTS — not
 * literature-proven constants. They must remain tunable.
 *
 * Spec correction (post-Step 2): the generic progression engine treated
 * every level the same — independent-only evidence, flat per-trial weight.
 * That made Level 1 (heavy-support recovery) behave like Level 4
 * (independent naming): scaffolded chip recovery could never satisfy
 * `evidenceMet`, and the progress bar moved imperceptibly even when the
 * patient was performing exactly the skill that level is meant to train.
 *
 * This module defines, per level, the *minimum support tier that counts as
 * on-target evidence* and an evidence rule (min on-target attempts +
 * accuracy). It also exposes a per-trial weighting function so trials at or
 * below the level's expectation earn full credit, and trials that demand
 * less independence than the level is training earn partial credit.
 *
 * Pure module — no I/O, no React, no DB.
 */

import type { SupportLevel } from './clinicalProgression';
import { SUPPORT_CREDIT, trialCredit } from './clinicalProgression';

/**
 * Photo Naming support ranked from MOST scaffolded (0) to MOST independent (4).
 * Higher rank = more independent / harder.
 */
const SUPPORT_RANK: Record<string, number> = {
  recognition_only: 0,
  carrier_or_full_model: 1,
  phonemic_cue: 2,
  semantic_cue: 3,
  independent: 4,
};

function rank(s: SupportLevel): number {
  return SUPPORT_RANK[s] ?? -1;
}

export interface PhotoNamingLevelSpec {
  level: number;
  /** Human-facing clinical description of what this level trains. */
  description: string;
  /**
   * The MINIMUM support tier (rank) that counts as "on-target evidence" for
   * graduating this level. A trial whose support rank is ≥ this value
   * contributes to evidenceMet.
   */
  targetSupport: SupportLevel;
  /** Min on-target attempts in a session for evidenceMet to be considered. */
  minOnTargetAttempts: number;
  /** Min accuracy across those on-target attempts to meet evidence. */
  minOnTargetAccuracy: number;
  /**
   * Per-level progress weight (credits-per-progress-point).
   *
   * Lower weight = faster graduation. Easier levels graduate in a few
   * sessions to build momentum; harder levels graduate slowly because the
   * clinical claim is more demanding.
   *
   * Calibration baseline: a "perfect" session of ~9 on-target independent
   * trials = 9 * 1.0 (base) * 1.25 (on-target bonus) = 11.25 credits.
   * Target sessions-to-graduate at perfect cadence:
   *   L1 ~3-4, L2 ~5, L3 ~7, L4 ~9, L5 ~11, L6 ~16, L7 ~19, L8 ~22.
   */
  trialWeight: number;
  /**
   * PR4 (Phase 2.5): per-level content-selection contract. Pure metadata —
   * the runtime selector lives in `photoNamingContentSelector.ts`. Lets
   * dev tools and tests describe what content each level is supposed to
   * use, separately from the evidence/accuracy rule.
   */
  contentSelector?: {
    tierKey: 'baseline' | 'high_frequency' | 'mid_frequency' | 'cross_category' | 'phrase_carrier' | 'advanced_review';
    description: string;
  };
}

/**
 * Level ladder (clinical meaning):
 *   L1 recognizes/names with heavy support (chip recovery counts)
 *   L2 names with semantic / choice support
 *   L3 names with phonemic cue
 *   L4 names independently for familiar / high-frequency items
 *   L5 names independently for lower-frequency items
 *   L6 names across categories with reduced latency
 *   L7 names in phrase / sentence context
 *   L8 stable functional naming with generalization
 *
 * Until per-level *content* tiers (frequency / category / phrase) exist,
 * L4–L8 share the `independent` evidence target and raise the accuracy bar.
 * That keeps the ladder honest: scaffolded recovery cannot graduate L4+.
 */
export const PHOTO_NAMING_LEVELS: Record<number, PhotoNamingLevelSpec> = {
  1: {
    level: 1,
    description: 'Recognizes / names with heavy support',
    targetSupport: 'recognition_only',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.7,
    trialWeight: 0.4,
    contentSelector: { tierKey: 'baseline', description: 'Engine difficulty bands handle L1–L3 content; no extra filter.' },
  },
  2: {
    level: 2,
    description: 'Names with semantic / choice support',
    targetSupport: 'semantic_cue',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.7,
    trialWeight: 0.55,
    contentSelector: { tierKey: 'baseline', description: 'Engine difficulty bands handle L1–L3 content; no extra filter.' },
  },
  3: {
    level: 3,
    description: 'Names with phonemic cue',
    targetSupport: 'phonemic_cue',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.7,
    trialWeight: 0.75,
    contentSelector: { tierKey: 'baseline', description: 'Engine difficulty bands handle L1–L3 content; no extra filter.' },
  },
  4: {
    level: 4,
    description: 'Names independently — familiar / high-frequency items',
    targetSupport: 'independent',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.7,
    trialWeight: 1.0,
    contentSelector: { tierKey: 'high_frequency', description: 'High-frequency concrete nouns (SUBTLEX-proxy rank ≤ 2000).' },
  },
  5: {
    level: 5,
    description: 'Names independently — lower-frequency items',
    targetSupport: 'independent',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    trialWeight: 1.25,
    contentSelector: { tierKey: 'mid_frequency', description: 'Mid-frequency nouns (rank 2001–6000). Disjoint from L4.' },
  },
  6: {
    level: 6,
    description: 'Names across categories with reduced latency',
    targetSupport: 'independent',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.8,
    trialWeight: 1.7,
    contentSelector: { tierKey: 'cross_category', description: 'Cross-category semantic spread (≥4 distinct categories, no category > 45%).' },
  },
  7: {
    level: 7,
    description: 'Names in phrase / sentence context',
    targetSupport: 'independent',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.8,
    trialWeight: 2.0,
    contentSelector: { tierKey: 'phrase_carrier', description: 'Phrase-carrier mode: every trial tagged with a carrier sentence.' },
  },
  8: {
    level: 8,
    description: 'Stable functional naming with generalization',
    targetSupport: 'independent',
    minOnTargetAttempts: 8,
    minOnTargetAccuracy: 0.85,
    trialWeight: 2.5,
    contentSelector: {
      tierKey: 'generalization_probe',
      description:
        'Generalization PROBE pool (untrained items). Probe trials are segregated from ordinary mastery stats.',
    },
  },
};

export function getPhotoNamingLevelSpec(level: number): PhotoNamingLevelSpec {
  return PHOTO_NAMING_LEVELS[level] ?? PHOTO_NAMING_LEVELS[1];
}

/** Trial counts as on-target if its support rank meets-or-exceeds the level's target. */
export function isOnTargetTrial(
  trial: { support: SupportLevel },
  level: number
): boolean {
  const spec = getPhotoNamingLevelSpec(level);
  return rank(trial.support) >= rank(spec.targetSupport);
}

/**
 * Evidence rule: did this session demonstrate the skill the *current level*
 * is training? Computed from on-target attempts only.
 */
export function evidenceMetForLevel(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number
): boolean {
  const spec = getPhotoNamingLevelSpec(level);
  const onTarget = trials.filter((t) => isOnTargetTrial(t, level));
  if (onTarget.length < spec.minOnTargetAttempts) return false;
  const correct = onTarget.filter((t) => t.correct).length;
  return correct / onTarget.length >= spec.minOnTargetAccuracy;
}

/**
 * Level-aware progress delta (0–100 points for THIS level's bar).
 *
 * Per-trial weighting:
 *   - on-target correct trial → full base credit (SUPPORT_CREDIT[support])
 *   - more-scaffolded-than-target correct trial → reduced (×0.4) — practice
 *     credit only; doesn't masquerade as level-appropriate evidence
 *   - incorrect trial → 0
 *
 * Additionally, on-target trials get a small consistency bonus so a session
 * full of level-appropriate practice fills the bar in a clinically reasonable
 * window (~10 sessions of solid on-target practice, not ~100).
 */
export function calculateLevelAwareProgressDelta(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
  options: { trialWeight?: number } = {}
): number {
  const spec = getPhotoNamingLevelSpec(level);
  const weight = options.trialWeight ?? spec.trialWeight;
  let total = 0;
  for (const t of trials) {
    const base = trialCredit(t);
    if (base <= 0) continue;
    if (isOnTargetTrial(t, level)) {
      total += base * 1.25; // on-target consistency bonus
    } else {
      total += base * 0.4; // below-target practice credit
    }
  }
  return total / weight;
}

// Re-export so consumers can reach SUPPORT_CREDIT through one module.
export { SUPPORT_CREDIT };
