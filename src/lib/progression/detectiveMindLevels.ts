/**
 * Detective Mind — receptive/comprehension ladder (Phase 2, Wave 2).
 *
 * Receptive-safe variant: Detective Mind is an inferential reading-
 * comprehension multiple-choice task. The patient reads a short case +
 * question, optionally uses a "highlight sentence" hint, then picks from
 * 2–4 options. Its `submitTrial` call site emits `trialMode: 'recognition'`
 * and the slug is INTENTIONALLY NOT in ADOPTED_TRIAL_MODE_SLUGS — routing
 * this comprehension task into the expressive mastery track would conflate
 * axes (same precedent as MeaningMatch and MinimalPairs). A receptive
 * mastery track is the right home and is explicitly deferred.
 *
 * What this ladder DOES drive today:
 *   - Persistent Clinical Level (1–8) on `clinical_progression_state`.
 *   - Engine-difficulty FLOOR via the bridge (in-session adapter may still
 *     escalate above the floor).
 *   - Ceiling clamp.
 *   - Soft-regression parity.
 *
 * Clinical basis & honest scope: see docs/clinical-evidence/detective-mind.md.
 * TL;DR: Inferential discourse comprehension is targeted in cognitive-
 * communication treatment programs (Sohlberg & Mateer APT-II;
 * conversational discourse remediation; reading-for-meaning hierarchies).
 * The specific 3-tier complexity progression and question-type spread
 * (factual → inferential → multi-step inference) shipped here is a
 * CLINICALLY MOTIVATED CALIBRATION DEFAULT against the existing
 * DETECTIVE_CASES bank, not a literature-proven hierarchy.
 *
 * Support ladder (comprehension axis):
 *   recognition_only → semantic_cue (sentence-highlight hint)
 * Detective Mind does not escalate beyond semantic_cue.
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

export interface DetectiveMindLevelSpec {
  level: number;
  description: string;
  /** Receptive task — targetSupport describes the *minimum* support
   *  considered "on-target". Higher rungs require the patient to succeed
   *  without hint scaffolding. */
  targetSupport: SupportLevel;
  minOnTargetAttempts: number;
  minOnTargetAccuracy: number;
  readiness: 'ready' | 'thin' | 'aspirational';
  trialWeight: number;
  contentSelector?: {
    tierKey:
      | 'factual_short'
      | 'factual_extended'
      | 'inferential_simple'
      | 'inferential_mixed'
      | 'multi_step_inference'
      | 'novel_abstract_case';
    description: string;
    implemented: boolean;
  };
}

/**
 * Level ladder (inferential-comprehension independence):
 *   L1 — Short factual cases, hint allowed
 *   L2 — Extended factual cases, hint allowed
 *   L3 — Factual cases — no hint
 *   L4 — Simple inferential cases — no hint
 *   L5 — Mixed factual + inferential — no hint
 *   L6 — Multi-step inference (thin bank)
 *   L7 — Multi-step inference at bank tier 3 (thin)
 *   L8 — Novel/abstract case reasoning (aspirational; bank not extended)
 */
export const DETECTIVE_MIND_LEVELS: Record<number, DetectiveMindLevelSpec> = {
  1: {
    level: 1,
    description: 'Short factual cases — hint allowed',
    targetSupport: 'semantic_cue',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.4,
    contentSelector: { tierKey: 'factual_short', description: 'Bank tier 1, factual question types.', implemented: true },
  },
  2: {
    level: 2,
    description: 'Extended factual cases — hint allowed',
    targetSupport: 'semantic_cue',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 0.55,
    contentSelector: { tierKey: 'factual_extended', description: 'Bank tier 1–2 factual questions.', implemented: true },
  },
  3: {
    level: 3,
    description: 'Factual cases — independent (no hint)',
    targetSupport: 'recognition_only',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.75,
    contentSelector: { tierKey: 'factual_extended', description: 'Bank tier 2 factual; no scaffold.', implemented: true },
  },
  4: {
    level: 4,
    description: 'Simple inferential cases — no hint',
    targetSupport: 'recognition_only',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.0,
    contentSelector: { tierKey: 'inferential_simple', description: 'Bank tier 2 inferential question types; no scaffold.', implemented: true },
  },
  5: {
    level: 5,
    description: 'Mixed factual + inferential — no hint',
    targetSupport: 'recognition_only',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.25,
    contentSelector: { tierKey: 'inferential_mixed', description: 'Bank tier 2 mixed question types.', implemented: true },
  },
  6: {
    level: 6,
    description: 'Multi-step inference — bank tier 3',
    targetSupport: 'recognition_only',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
    trialWeight: 1.7,
    contentSelector: { tierKey: 'multi_step_inference', description: 'Bank tier 3, multi-step inference; thin coverage, rotation only.', implemented: true },
  },
  7: {
    level: 7,
    description: 'Multi-step inference — sparse high-tier bank',
    targetSupport: 'recognition_only',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
    trialWeight: 2.0,
    contentSelector: { tierKey: 'multi_step_inference', description: 'Bank tier 3, hardest available cases; thin.', implemented: true },
  },
  8: {
    level: 8,
    description: 'Novel / abstract case reasoning — design-of-record',
    targetSupport: 'recognition_only',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.85,
    readiness: 'aspirational',
    trialWeight: 2.5,
    contentSelector: {
      tierKey: 'novel_abstract_case',
      description: 'Bank not yet extended with novel-domain abstract cases — ceiling clamp blocks advancement.',
      implemented: false,
    },
  },
};

export function getDetectiveMindLevelSpec(level: number): DetectiveMindLevelSpec {
  return DETECTIVE_MIND_LEVELS[level] ?? DETECTIVE_MIND_LEVELS[1];
}

/** Receptive ladder: "on-target" means the trial's support was at or
 *  ABOVE the rung's independence requirement. A hint-assisted trial does
 *  NOT meet an independent rung's target. Mirrors meaning-match. */
export function isOnTargetDetectiveMindTrial(
  trial: { support: SupportLevel },
  level: number,
): boolean {
  const spec = getDetectiveMindLevelSpec(level);
  if (spec.targetSupport === 'recognition_only') {
    return rank(trial.support) <= rank('recognition_only');
  }
  return true;
}

export function evidenceMetForDetectiveMindLevel(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
): boolean {
  const spec = getDetectiveMindLevelSpec(level);
  const onTarget = trials.filter((t) => isOnTargetDetectiveMindTrial(t, level));
  if (onTarget.length < spec.minOnTargetAttempts) return false;
  const correct = onTarget.filter((t) => t.correct).length;
  return correct / onTarget.length >= spec.minOnTargetAccuracy;
}

export function calculateDetectiveMindProgressDelta(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
  options: { trialWeight?: number } = {},
): number {
  const spec = getDetectiveMindLevelSpec(level);
  const weight = options.trialWeight ?? spec.trialWeight;
  let total = 0;
  for (const t of trials) {
    const base = trialCredit(t);
    if (base <= 0) continue;
    if (isOnTargetDetectiveMindTrial(t, level)) total += base * 1.25;
    else total += base * 0.4;
  }
  return total / weight;
}

export { SUPPORT_CREDIT };

export function highestImplementedDetectiveMindLevel(): number {
  return computeImplementedCeiling(DETECTIVE_MIND_LEVELS);
}
