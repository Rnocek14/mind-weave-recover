/**
 * Semantic Features (SFA) — level-specific clinical criteria.
 *
 * Clinical basis & honest scope: see docs/clinical-evidence/semantic-features.md.
 * TL;DR: Semantic Feature Analysis is well-supported for anomia
 * (Boyle & Coelho 1995; Coelho et al. 2000; Maddy et al. 2014). The
 * specific per-level accuracy bars, trialWeight values, and content-tier
 * mapping shipped here are CLINICALLY MOTIVATED CALIBRATION DEFAULTS,
 * not literature-proven constants. They must remain tunable.
 *
 * Support ladder (lexical axis, shared with PhotoNaming):
 *   recognition_only → carrier_or_full_model → phonemic_cue
 *   → semantic_cue → independent
 * SFA's in-game cueLevel (0..2 from `usedRatio`) maps:
 *   0 → independent, 1 → semantic_cue, 2 → phonemic_cue.
 *
 * Phase 1 readiness (matches `clinicalRungs.ts`):
 *   L1–L5 → ready (content bank carries ≥7 trials per difficulty band)
 *   L6–L7 → thin (difficulty band 4 has 4 trials only; rotation is OK
 *           for short-term practice but cannot sustain heavy mastery work)
 *   L8    → aspirational (difficulty band 5 has only 2 trials; treat the
 *           rung as design-of-record only — ceiling clamp blocks live
 *           promotion until the bank is expanded)
 *
 * Pure module — no I/O, no React, no DB.
 */

import type { SupportLevel } from './clinicalProgression';
import { SUPPORT_CREDIT, trialCredit } from './clinicalProgression';
import { computeImplementedCeiling } from './_shared/implementedCeiling';

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

export interface SemanticFeaturesLevelSpec {
  level: number;
  description: string;
  targetSupport: SupportLevel;
  minOnTargetAttempts: number;
  minOnTargetAccuracy: number;
  readiness: 'ready' | 'thin' | 'aspirational';
  trialWeight: number;
  contentSelector?: {
    tierKey:
      | 'baseline_perceptual'
      | 'functional'
      | 'categorical_mixed'
      | 'associative'
      | 'mixed_abstract'
      | 'abstract_sparse';
    description: string;
    implemented: boolean;
  };
}

/**
 * Level ladder (clinical meaning):
 *   L1 picks correct perceptual features with chips visible (semantic scaffold OK)
 *   L2 picks correct perceptual + simple functional features (semantic scaffold OK)
 *   L3 generates correct functional features independently
 *   L4 generates functional + categorical features independently
 *   L5 generates mixed-category features (perceptual + functional + categorical)
 *   L6 handles associative features (cross-domain knowledge) — thin bank
 *   L7 handles mixed-abstractness features under pressure — thin bank
 *   L8 abstract / low-frequency targets — aspirational, content sparse
 */
export const SEMANTIC_FEATURES_LEVELS: Record<number, SemanticFeaturesLevelSpec> = {
  1: {
    level: 1,
    description: 'Perceptual features — chip-supported recognition',
    targetSupport: 'semantic_cue',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.4,
    contentSelector: { tierKey: 'baseline_perceptual', description: 'Concrete imageable nouns; bank difficulty 1.', implemented: true },
  },
  2: {
    level: 2,
    description: 'Perceptual + simple functional — chip support OK',
    targetSupport: 'semantic_cue',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 0.55,
    contentSelector: { tierKey: 'baseline_perceptual', description: 'Concrete imageable nouns; bank difficulty 1.', implemented: true },
  },
  3: {
    level: 3,
    description: 'Functional features — independent selection',
    targetSupport: 'independent',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.75,
    contentSelector: { tierKey: 'functional', description: 'Functional/action features; bank difficulty 2.', implemented: true },
  },
  4: {
    level: 4,
    description: 'Functional + categorical — independent',
    targetSupport: 'independent',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.0,
    contentSelector: { tierKey: 'functional', description: 'Functional + categorical mix; bank difficulty 2.', implemented: true },
  },
  5: {
    level: 5,
    description: 'Mixed-category features — broader semantic spread',
    targetSupport: 'independent',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.25,
    contentSelector: { tierKey: 'categorical_mixed', description: 'Perceptual + functional + categorical; bank difficulty 3.', implemented: true },
  },
  6: {
    level: 6,
    description: 'Associative features — cross-domain knowledge',
    targetSupport: 'independent',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
    trialWeight: 1.7,
    contentSelector: {
      tierKey: 'associative',
      description:
        'Bridge holds the floor at bank difficulty 3 (associative-rich). Difficulty 4 now holds 20 trials — raising the L6 floor to 4 is viable but is a patient-facing difficulty change; flagged in docs/unimplemented-tiers-roadmap.md.',
      implemented: true,
    },
  },
  7: {
    level: 7,
    description: 'Mixed-abstractness features under pressure',
    targetSupport: 'independent',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
    trialWeight: 2.0,
    contentSelector: {
      tierKey: 'mixed_abstract',
      description: 'Bank difficulty 4 with abstract features mixed in; pool now 20 trials.',
      implemented: true,
    },
  },
  8: {
    level: 8,
    description: 'Abstract / low-frequency targets',
    targetSupport: 'independent',
    minOnTargetAttempts: 8,
    minOnTargetAccuracy: 0.85,
    readiness: 'thin',
    trialWeight: 2.5,
    contentSelector: {
      tierKey: 'abstract_sparse',
      description:
        'Bank difficulty 5 expanded to 20 trials (low-frequency nouns, ≥2 abstractness-5 features each); bridge maps L8 → bank floor 5. New tier — readiness "thin" until field data + SLP review.',
      implemented: true,
    },
  },
};

export function getSemanticFeaturesLevelSpec(level: number): SemanticFeaturesLevelSpec {
  return SEMANTIC_FEATURES_LEVELS[level] ?? SEMANTIC_FEATURES_LEVELS[1];
}

export function isOnTargetSemanticFeaturesTrial(
  trial: { support: SupportLevel },
  level: number,
): boolean {
  const spec = getSemanticFeaturesLevelSpec(level);
  return rank(trial.support) >= rank(spec.targetSupport);
}

export function evidenceMetForSemanticFeaturesLevel(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
): boolean {
  const spec = getSemanticFeaturesLevelSpec(level);
  const onTarget = trials.filter((t) => isOnTargetSemanticFeaturesTrial(t, level));
  if (onTarget.length < spec.minOnTargetAttempts) return false;
  const correct = onTarget.filter((t) => t.correct).length;
  return correct / onTarget.length >= spec.minOnTargetAccuracy;
}

export function calculateSemanticFeaturesProgressDelta(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
  options: { trialWeight?: number } = {},
): number {
  const spec = getSemanticFeaturesLevelSpec(level);
  const weight = options.trialWeight ?? spec.trialWeight;
  let total = 0;
  for (const t of trials) {
    const base = trialCredit(t);
    if (base <= 0) continue;
    if (isOnTargetSemanticFeaturesTrial(t, level)) total += base * 1.25;
    else total += base * 0.4;
  }
  return total / weight;
}

export { SUPPORT_CREDIT };

/** Highest level that ships live differentiated content (excludes aspirational L8). */
export function highestImplementedSemanticFeaturesLevel(): number {
  return computeImplementedCeiling(SEMANTIC_FEATURES_LEVELS);
}
