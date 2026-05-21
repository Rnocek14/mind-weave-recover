/**
 * Meaning Match — receptive/comprehension ladder (Phase 1, Wave 1).
 *
 * Receptive-safe variant: Meaning Match is a multiple-choice comprehension
 * task. Its `submitTrial` call site continues to emit `trialMode: 'recognition'`
 * and the slug is INTENTIONALLY NOT added to ADOPTED_TRIAL_MODE_SLUGS — routing
 * to the expressive mastery track would conflate the axes (same rationale as
 * Minimal Pairs). A receptive mastery track is the right home for this game
 * and is explicitly deferred.
 *
 * What this ladder DOES drive today:
 *   - Persistent Clinical Level (1–8) on `clinical_progression_state`.
 *   - Engine-difficulty FLOOR via the bridge (the in-session adapter may
 *     still escalate above the floor).
 *   - Ceiling clamp (advancement past unimplemented tiers is blocked).
 *   - Soft-regression parity with PhotoNaming/FixSentence.
 *
 * Clinical basis & honest scope: see docs/clinical-evidence/meaning-match.md.
 * TL;DR: lexical-semantic comprehension hierarchies (concrete → abstract,
 * close → distant semantic distractors) are well-established in aphasia
 * therapy (PALPA, ASHA practice patterns). Per-level accuracy bars and
 * tier-to-difficulty mapping shipped here are CLINICALLY MOTIVATED
 * CALIBRATION DEFAULTS, not literature-proven constants.
 *
 * Support ladder (comprehension axis):
 *   recognition_only → semantic_cue (keyword highlight)
 * Meaning Match does not escalate beyond semantic_cue.
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

export interface MeaningMatchLevelSpec {
  level: number;
  description: string;
  /** Receptive task — targetSupport describes the *minimum* support
   *  considered "on-target" for the rung. Higher rungs require the
   *  patient to succeed without hint scaffolding. */
  targetSupport: SupportLevel;
  minOnTargetAttempts: number;
  minOnTargetAccuracy: number;
  readiness: 'ready' | 'thin' | 'aspirational';
  trialWeight: number;
  contentSelector?: {
    tierKey:
      | 'concrete_close'
      | 'concrete_mixed'
      | 'mixed_semantic'
      | 'abstract_close'
      | 'abstract_distant'
      | 'figurative';
    description: string;
    implemented: boolean;
  };
}

/**
 * Level ladder (clinical meaning):
 *   L1 concrete nouns, distant distractors, hint OK
 *   L2 concrete nouns, close distractors, hint OK
 *   L3 concrete nouns, no hint
 *   L4 mixed concrete/abstract, no hint
 *   L5 abstract concepts, close semantic distractors
 *   L6 abstract concepts under semantic-distance pressure (thin bank)
 *   L7 mixed-abstractness, low-frequency lexemes (thin bank)
 *   L8 figurative / idiomatic comprehension (aspirational)
 */
export const MEANING_MATCH_LEVELS: Record<number, MeaningMatchLevelSpec> = {
  1: {
    level: 1,
    description: 'Concrete nouns, distant distractors — hint allowed',
    targetSupport: 'semantic_cue',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.4,
    contentSelector: { tierKey: 'concrete_close', description: 'Concrete imageable items, low semantic-distance pressure.', implemented: true },
  },
  2: {
    level: 2,
    description: 'Concrete nouns, close distractors — hint allowed',
    targetSupport: 'semantic_cue',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 0.55,
    contentSelector: { tierKey: 'concrete_close', description: 'Concrete items with closer semantic neighbours.', implemented: true },
  },
  3: {
    level: 3,
    description: 'Concrete nouns — independent (no hint)',
    targetSupport: 'recognition_only',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.75,
    contentSelector: { tierKey: 'concrete_mixed', description: 'Concrete items, no scaffold.', implemented: true },
  },
  4: {
    level: 4,
    description: 'Mixed concrete + abstract — no hint',
    targetSupport: 'recognition_only',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.0,
    contentSelector: { tierKey: 'mixed_semantic', description: 'Concrete + abstract mix; no scaffold.', implemented: true },
  },
  5: {
    level: 5,
    description: 'Abstract concepts, close semantic distractors',
    targetSupport: 'recognition_only',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.25,
    contentSelector: { tierKey: 'abstract_close', description: 'Abstract items with close-distance distractors.', implemented: true },
  },
  6: {
    level: 6,
    description: 'Abstract concepts under distance pressure',
    targetSupport: 'recognition_only',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
    trialWeight: 1.7,
    contentSelector: { tierKey: 'abstract_distant', description: 'Abstract bank pressure tier; thin coverage, rotation only.', implemented: true },
  },
  7: {
    level: 7,
    description: 'Mixed-abstractness, low-frequency lexemes',
    targetSupport: 'recognition_only',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
    trialWeight: 2.0,
    contentSelector: { tierKey: 'abstract_distant', description: 'Low-frequency abstract items; thin bank, rotation only.', implemented: true },
  },
  8: {
    level: 8,
    description: 'Figurative / idiomatic comprehension — design-of-record',
    targetSupport: 'recognition_only',
    minOnTargetAttempts: 8,
    minOnTargetAccuracy: 0.85,
    readiness: 'aspirational',
    trialWeight: 2.5,
    contentSelector: {
      tierKey: 'figurative',
      description: 'Figurative/idiomatic bank not yet shipped — ceiling clamp blocks advancement until bank exists.',
      implemented: false,
    },
  },
};

export function getMeaningMatchLevelSpec(level: number): MeaningMatchLevelSpec {
  return MEANING_MATCH_LEVELS[level] ?? MEANING_MATCH_LEVELS[1];
}

/** For receptive ladders, "on-target" means the trial's support was at or
 *  ABOVE the rung's minimum independence requirement. A trial that used a
 *  hint (semantic_cue) does NOT meet an independent rung's target. */
export function isOnTargetMeaningMatchTrial(
  trial: { support: SupportLevel },
  level: number,
): boolean {
  const spec = getMeaningMatchLevelSpec(level);
  // Inverted for the comprehension axis: independence is *lower* support.
  //   spec.targetSupport === 'recognition_only' → needs raw no-hint trial.
  //   spec.targetSupport === 'semantic_cue'     → any support OK.
  if (spec.targetSupport === 'recognition_only') {
    return rank(trial.support) <= rank('recognition_only');
  }
  return true;
}

export function evidenceMetForMeaningMatchLevel(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
): boolean {
  const spec = getMeaningMatchLevelSpec(level);
  const onTarget = trials.filter((t) => isOnTargetMeaningMatchTrial(t, level));
  if (onTarget.length < spec.minOnTargetAttempts) return false;
  const correct = onTarget.filter((t) => t.correct).length;
  return correct / onTarget.length >= spec.minOnTargetAccuracy;
}

export function calculateMeaningMatchProgressDelta(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
  options: { trialWeight?: number } = {},
): number {
  const spec = getMeaningMatchLevelSpec(level);
  const weight = options.trialWeight ?? spec.trialWeight;
  let total = 0;
  for (const t of trials) {
    const base = trialCredit(t);
    if (base <= 0) continue;
    if (isOnTargetMeaningMatchTrial(t, level)) total += base * 1.25;
    else total += base * 0.4;
  }
  return total / weight;
}

export { SUPPORT_CREDIT };

export function highestImplementedMeaningMatchLevel(): number {
  return computeImplementedCeiling(MEANING_MATCH_LEVELS);
}
