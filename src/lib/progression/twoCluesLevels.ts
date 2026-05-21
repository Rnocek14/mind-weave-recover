/**
 * Two Clues — lexical retrieval ladder (Phase 1, Wave 1).
 *
 * Expressive task: patient produces the target word from two semantic clues.
 * Anchor (semantic_cue) shown after silence/struggle. `submitTrial` emits
 * `trialMode: 'production'`. The slug IS added to ADOPTED_TRIAL_MODE_SLUGS.
 *
 * Clinical basis & honest scope: see docs/clinical-evidence/two-clues.md.
 * TL;DR: Two-cue lexical retrieval mirrors Semantic Feature Analysis (SFA)
 * — patient leverages converging semantic features to retrieve a target
 * (Boyle & Coelho 1995; Maddy et al. 2014). The specific cue-pair
 * structure here is a design implementation of SFA principles; per-level
 * accuracy bars and bank-difficulty mapping are CLINICALLY MOTIVATED
 * CALIBRATION DEFAULTS, not literature-proven constants.
 *
 * Support ladder (lexical axis):
 *   independent → semantic_cue (anchor shown)
 * Two Clues does not escalate to phonemic_cue or full-model.
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

export interface TwoCluesLevelSpec {
  level: number;
  description: string;
  targetSupport: SupportLevel;
  minOnTargetAttempts: number;
  minOnTargetAccuracy: number;
  readiness: 'ready' | 'thin' | 'aspirational';
  trialWeight: number;
  contentSelector?: {
    tierKey:
      | 'high_freq_concrete'
      | 'concrete_general'
      | 'mixed_semantic'
      | 'abstract_introduced'
      | 'low_freq_concrete'
      | 'abstract_pressure'
      | 'figurative';
    description: string;
    implemented: boolean;
  };
}

/**
 * Level ladder (clinical meaning):
 *   L1 high-frequency concrete; anchor acceptable
 *   L2 high-frequency concrete; reduce anchor reliance
 *   L3 general concrete nouns, independent retrieval
 *   L4 mixed concrete with subtle clue convergence
 *   L5 abstract concepts introduced
 *   L6 low-frequency concrete + abstract mix (thin bank)
 *   L7 abstract concepts under retrieval pressure (thin bank)
 *   L8 figurative / idiomatic targets (aspirational)
 */
export const TWO_CLUES_LEVELS: Record<number, TwoCluesLevelSpec> = {
  1: {
    level: 1,
    description: 'High-frequency concrete — anchor support OK',
    targetSupport: 'semantic_cue',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.4,
    contentSelector: { tierKey: 'high_freq_concrete', description: 'High-frequency concrete nouns; bank difficulty 1.', implemented: true },
  },
  2: {
    level: 2,
    description: 'High-frequency concrete — reduce anchor reliance',
    targetSupport: 'semantic_cue',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 0.55,
    contentSelector: { tierKey: 'high_freq_concrete', description: 'High-frequency concrete; cleaner convergence cues.', implemented: true },
  },
  3: {
    level: 3,
    description: 'General concrete — independent retrieval',
    targetSupport: 'independent',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.75,
    contentSelector: { tierKey: 'concrete_general', description: 'General concrete nouns; no anchor expected.', implemented: true },
  },
  4: {
    level: 4,
    description: 'Concrete with subtle clue convergence',
    targetSupport: 'independent',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.0,
    contentSelector: { tierKey: 'mixed_semantic', description: 'Concrete with broader feature spread.', implemented: true },
  },
  5: {
    level: 5,
    description: 'Abstract concepts introduced',
    targetSupport: 'independent',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.25,
    contentSelector: { tierKey: 'abstract_introduced', description: 'Abstract items introduced alongside concrete.', implemented: true },
  },
  6: {
    level: 6,
    description: 'Low-frequency concrete + abstract mix',
    targetSupport: 'independent',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
    trialWeight: 1.7,
    contentSelector: { tierKey: 'low_freq_concrete', description: 'Low-frequency + abstract mix; thin bank, rotation only.', implemented: true },
  },
  7: {
    level: 7,
    description: 'Abstract under retrieval pressure',
    targetSupport: 'independent',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
    trialWeight: 2.0,
    contentSelector: { tierKey: 'abstract_pressure', description: 'Abstract items under retrieval pressure; thin bank.', implemented: true },
  },
  8: {
    level: 8,
    description: 'Figurative / idiomatic targets — design-of-record',
    targetSupport: 'independent',
    minOnTargetAttempts: 8,
    minOnTargetAccuracy: 0.85,
    readiness: 'aspirational',
    trialWeight: 2.5,
    contentSelector: {
      tierKey: 'figurative',
      description: 'Figurative/idiomatic bank not yet shipped — ceiling clamp blocks advancement.',
      implemented: false,
    },
  },
};

export function getTwoCluesLevelSpec(level: number): TwoCluesLevelSpec {
  return TWO_CLUES_LEVELS[level] ?? TWO_CLUES_LEVELS[1];
}

export function isOnTargetTwoCluesTrial(
  trial: { support: SupportLevel },
  level: number,
): boolean {
  const spec = getTwoCluesLevelSpec(level);
  return rank(trial.support) >= rank(spec.targetSupport);
}

export function evidenceMetForTwoCluesLevel(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
): boolean {
  const spec = getTwoCluesLevelSpec(level);
  const onTarget = trials.filter((t) => isOnTargetTwoCluesTrial(t, level));
  if (onTarget.length < spec.minOnTargetAttempts) return false;
  const correct = onTarget.filter((t) => t.correct).length;
  return correct / onTarget.length >= spec.minOnTargetAccuracy;
}

export function calculateTwoCluesProgressDelta(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
  options: { trialWeight?: number } = {},
): number {
  const spec = getTwoCluesLevelSpec(level);
  const weight = options.trialWeight ?? spec.trialWeight;
  let total = 0;
  for (const t of trials) {
    const base = trialCredit(t);
    if (base <= 0) continue;
    if (isOnTargetTwoCluesTrial(t, level)) total += base * 1.25;
    else total += base * 0.4;
  }
  return total / weight;
}

export { SUPPORT_CREDIT };

export function highestImplementedTwoCluesLevel(): number {
  return computeImplementedCeiling(TWO_CLUES_LEVELS);
}
