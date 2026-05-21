/**
 * Synonym Generator — structural ladder (Phase 2, Wave 3).
 *
 * Expressive lexical-semantic divergent-production task: patient produces
 * as many synonyms as they can for a target word within a timed window.
 * `submitTrial` emits `trialMode: 'production'` and the slug IS added to
 * ADOPTED_TRIAL_MODE_SLUGS — trials route into expressive mastery alongside
 * the other production tasks.
 *
 * Clinical basis & honest scope: see docs/clinical-evidence/synonym-generator.md.
 * TL;DR: Divergent semantic-retrieval / category-generation training is
 * supported by the verbal-fluency rehab literature (Kiran & Thompson SFA;
 * Boyle PCA; Edmonds VNeST; verbal-fluency intervention reviews). The
 * specific 3-tier word-abstractness collapse (concrete → mixed →
 * abstract) shipped here is a CLINICALLY MOTIVATED CALIBRATION DEFAULT
 * against the existing 3-tier SYNONYM_PROMPTS bank, not a literature-
 * proven head-to-head hierarchy. Per-level accuracy bars are tunable.
 *
 * Support axis (lexical / open-production):
 *   The current game UI has no in-trial scaffold control — the patient
 *   just speaks (or types via fallback). Every trial is `open_response`.
 *   The ladder advances on match-count growth at progressively harder
 *   content tiers (and tighter time pressure), not on scaffold fading.
 *   This matches Synonym Generator's clinical reality (it is a divergent-
 *   retrieval task, not a cue-faded confrontation-naming task).
 *
 * Phase 1 readiness (matches `clinicalRungs.ts` discipline):
 *   L1–L5 → ready  (bank tier 1 + tier 2 cover this range well)
 *   L6–L7 → thin   (bank tier 3 — abstract / low-frequency targets, sparse)
 *   L8    → aspirational (no constrained-output runtime mode that enforces
 *           speech-only + high match-count thresholds; ceiling clamp blocks)
 *
 * Pure module — no I/O, no React.
 */

import type { SupportLevel } from './clinicalProgression';
import { SUPPORT_CREDIT, trialCredit } from './clinicalProgression';
import { computeImplementedCeiling } from './_shared/implementedCeiling';

const SUPPORT_RANK: Record<string, number> = {
  highlight_plus_choice: 0,
  choice_based: 1,
  open_response: 2,
};

function rank(s: SupportLevel): number {
  return SUPPORT_RANK[s] ?? -1;
}

export interface SynonymGeneratorLevelSpec {
  level: number;
  description: string;
  targetSupport: SupportLevel;
  minOnTargetAttempts: number;
  minOnTargetAccuracy: number;
  readiness: 'ready' | 'thin' | 'aspirational';
  trialWeight: number;
  contentSelector?: {
    tierKey:
      | 'concrete_common'
      | 'concrete_extended'
      | 'mixed_frequency'
      | 'abstract_mid'
      | 'abstract_low'
      | 'constrained_output';
    description: string;
    implemented: boolean;
  };
}

/**
 * Level ladder (divergent lexical-semantic production):
 *   L1–L2 — Concrete, high-frequency targets; light match-count bar
 *   L3–L4 — Concrete extended / mixed-frequency targets; full coverage
 *   L5    — Mixed-frequency with sustained productivity
 *   L6    — Abstract mid-frequency targets (thin bank)
 *   L7    — Abstract low-frequency targets (thin bank)
 *   L8    — Constrained-output spontaneous production (aspirational; no
 *           runtime mode that disables typing fallback or enforces high
 *           per-prompt minimums yet)
 */
export const SYNONYM_GENERATOR_LEVELS: Record<number, SynonymGeneratorLevelSpec> = {
  1: {
    level: 1,
    description: 'Concrete common targets — light match-count bar',
    targetSupport: 'open_response',
    minOnTargetAttempts: 3,
    minOnTargetAccuracy: 0.6,
    readiness: 'ready',
    trialWeight: 0.4,
    contentSelector: { tierKey: 'concrete_common', description: 'Bank tier 1 (engine 1–3): big, happy, fast, etc.', implemented: true },
  },
  2: {
    level: 2,
    description: 'Concrete common — full coverage required',
    targetSupport: 'open_response',
    minOnTargetAttempts: 3,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.55,
    contentSelector: { tierKey: 'concrete_common', description: 'Bank tier 1 with stricter match-count requirement.', implemented: true },
  },
  3: {
    level: 3,
    description: 'Concrete extended — bank tier 1 boundary',
    targetSupport: 'open_response',
    minOnTargetAttempts: 3,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.75,
    contentSelector: { tierKey: 'concrete_extended', description: 'Bank tier 1 deeper rotation (engine 3 boundary).', implemented: true },
  },
  4: {
    level: 4,
    description: 'Mixed-frequency targets — bank tier 2',
    targetSupport: 'open_response',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.0,
    contentSelector: { tierKey: 'mixed_frequency', description: 'Bank tier 2 (engine 4–7): less common concrete + early abstract.', implemented: true },
  },
  5: {
    level: 5,
    description: 'Mixed-frequency — sustained productivity',
    targetSupport: 'open_response',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.25,
    contentSelector: { tierKey: 'mixed_frequency', description: 'Bank tier 2 with higher per-prompt match-count expectation.', implemented: true },
  },
  6: {
    level: 6,
    description: 'Abstract mid-frequency — thin bank',
    targetSupport: 'open_response',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
    trialWeight: 1.7,
    contentSelector: {
      tierKey: 'abstract_mid',
      description: 'Bank tier 2/3 boundary (engine 7): abstract mid-frequency; thin coverage — rotation only.',
      implemented: true,
    },
  },
  7: {
    level: 7,
    description: 'Abstract low-frequency — thin bank',
    targetSupport: 'open_response',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
    trialWeight: 2.0,
    contentSelector: {
      tierKey: 'abstract_low',
      description: 'Bank tier 3 (engine 8): abstract low-frequency targets; thin.',
      implemented: true,
    },
  },
  8: {
    level: 8,
    description: 'Constrained-output spontaneous production — design-of-record',
    targetSupport: 'open_response',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.85,
    readiness: 'aspirational',
    trialWeight: 2.5,
    contentSelector: {
      tierKey: 'constrained_output',
      description: 'No runtime mode that disables typing fallback or enforces high per-prompt match minimums — ceiling clamp blocks promotion until constrained-output UI ships.',
      implemented: false,
    },
  },
};

export function getSynonymGeneratorLevelSpec(level: number): SynonymGeneratorLevelSpec {
  return SYNONYM_GENERATOR_LEVELS[level] ?? SYNONYM_GENERATOR_LEVELS[1];
}

export function isOnTargetSynonymGeneratorTrial(
  trial: { support: SupportLevel },
  level: number,
): boolean {
  const spec = getSynonymGeneratorLevelSpec(level);
  return rank(trial.support) >= rank(spec.targetSupport);
}

export function evidenceMetForSynonymGeneratorLevel(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
): boolean {
  const spec = getSynonymGeneratorLevelSpec(level);
  const onTarget = trials.filter((t) => isOnTargetSynonymGeneratorTrial(t, level));
  if (onTarget.length < spec.minOnTargetAttempts) return false;
  const correct = onTarget.filter((t) => t.correct).length;
  return correct / onTarget.length >= spec.minOnTargetAccuracy;
}

export function calculateSynonymGeneratorProgressDelta(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
  options: { trialWeight?: number } = {},
): number {
  const spec = getSynonymGeneratorLevelSpec(level);
  const weight = options.trialWeight ?? spec.trialWeight;
  let total = 0;
  for (const t of trials) {
    const base = trialCredit(t);
    if (base <= 0) continue;
    if (isOnTargetSynonymGeneratorTrial(t, level)) total += base * 1.25;
    else total += base * 0.4;
  }
  return total / weight;
}

export { SUPPORT_CREDIT };

export function highestImplementedSynonymGeneratorLevel(): number {
  return computeImplementedCeiling(SYNONYM_GENERATOR_LEVELS);
}
