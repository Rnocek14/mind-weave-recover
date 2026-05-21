/**
 * Phonological Awareness — receptive/acoustic ladder (Phase 2, Wave 3).
 *
 * Receptive-safe variant: Phonological Awareness is an auditory
 * metalinguistic-judgment task. The patient hears two words and picks
 * Same/Different (or Rhyme/No-rhyme). Its `submitTrial` call site emits
 * `trialMode: 'recognition'` and the slug is INTENTIONALLY NOT in
 * ADOPTED_TRIAL_MODE_SLUGS — routing this metalinguistic-judgment task
 * into the expressive mastery track would conflate axes. Same precedent
 * as MinimalPairs / MeaningMatch / DetectiveMind. A receptive mastery
 * track is the right home and is explicitly deferred.
 *
 * What this ladder DOES drive today:
 *   - Persistent Clinical Level (1–8) on `clinical_progression_state`.
 *   - Engine-difficulty FLOOR via the bridge.
 *   - Ceiling clamp.
 *   - Soft-regression parity.
 *
 * Clinical basis & honest scope: see docs/clinical-evidence/phonological-awareness.md.
 * TL;DR: Phonological-awareness training (rhyme/alliteration → onset-rime
 * → full segmentation/manipulation; Adams 1990; Anthony & Francis 2005;
 * Kendall et al. 2008 in aphasia). Per-level thresholds and the bank-
 * difficulty mapping are CLINICALLY MOTIVATED CALIBRATION DEFAULTS, not
 * a literature-proven head-to-head hierarchy.
 *
 * Support ladder (acoustic / receptive):
 *   recognition_only — the game has no hint / replay-slow scaffold today.
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

export interface PhonologicalAwarenessLevelSpec {
  level: number;
  description: string;
  /** Receptive task — targetSupport is the *maximum* support considered
   *  on-target (`recognition_only` everywhere; the game has no scaffold). */
  targetSupport: SupportLevel;
  minOnTargetAttempts: number;
  minOnTargetAccuracy: number;
  readiness: 'ready' | 'thin' | 'aspirational';
  trialWeight: number;
  contentSelector?: {
    tierKey:
      | 'rhyme_basic'
      | 'rhyme_extended'
      | 'onset_alliteration'
      | 'coda_contrast'
      | 'vowel_contrast'
      | 'multi_phoneme'
      | 'nonword_low_freq'
      | 'degraded_signal';
    description: string;
    implemented: boolean;
  };
}

/**
 * Level ladder (phonological-awareness independence):
 *   L1 — Rhyme judgment, basic (bank difficulty 1)
 *   L2 — Rhyme + onset, extended (bank difficulty 1–2)
 *   L3 — Onset/alliteration discrimination (bank difficulty 2)
 *   L4 — Coda discrimination (bank difficulty 2–3)
 *   L5 — Vowel-contrast discrimination (bank difficulty 3–4)
 *   L6 — Multi-phoneme contrasts (bank difficulty 4)
 *   L7 — Nonword / low-frequency contrasts (bank difficulty 5, thin)
 *   L8 — Degraded-signal discrimination (aspirational; no runtime mode)
 */
export const PHONOLOGICAL_AWARENESS_LEVELS: Record<number, PhonologicalAwarenessLevelSpec> = {
  1: {
    level: 1,
    description: 'Rhyme judgment — basic pairs',
    targetSupport: 'recognition_only',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.4,
    contentSelector: { tierKey: 'rhyme_basic', description: 'Bank difficulty 1: rhyme / no-rhyme word pairs.', implemented: true },
  },
  2: {
    level: 2,
    description: 'Rhyme + onset — extended',
    targetSupport: 'recognition_only',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 0.55,
    contentSelector: { tierKey: 'rhyme_extended', description: 'Bank difficulty 1–2: rhyme + onset alliteration items.', implemented: true },
  },
  3: {
    level: 3,
    description: 'Onset / alliteration discrimination',
    targetSupport: 'recognition_only',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 0.75,
    contentSelector: { tierKey: 'onset_alliteration', description: 'Bank difficulty 2: same/different starting sound.', implemented: true },
  },
  4: {
    level: 4,
    description: 'Coda (final-sound) discrimination',
    targetSupport: 'recognition_only',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.0,
    contentSelector: { tierKey: 'coda_contrast', description: 'Bank difficulty 2–3: same/different ending sound.', implemented: true },
  },
  5: {
    level: 5,
    description: 'Vowel-contrast discrimination',
    targetSupport: 'recognition_only',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.25,
    contentSelector: { tierKey: 'vowel_contrast', description: 'Bank difficulty 3–4: same/different middle sound.', implemented: true },
  },
  6: {
    level: 6,
    description: 'Multi-phoneme contrasts',
    targetSupport: 'recognition_only',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.8,
    readiness: 'ready',
    trialWeight: 1.5,
    contentSelector: { tierKey: 'multi_phoneme', description: 'Bank difficulty 4: pairs differing in more than one feature.', implemented: true },
  },
  7: {
    level: 7,
    description: 'Nonword / low-frequency contrasts — thin bank',
    targetSupport: 'recognition_only',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
    trialWeight: 2.0,
    contentSelector: { tierKey: 'nonword_low_freq', description: 'Bank difficulty 5: nonword pairs; sparse coverage, rotation only.', implemented: true },
  },
  8: {
    level: 8,
    description: 'Degraded-signal discrimination — design-of-record',
    targetSupport: 'recognition_only',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.85,
    readiness: 'aspirational',
    trialWeight: 2.5,
    contentSelector: {
      tierKey: 'degraded_signal',
      description: 'No runtime mode for degraded audio / noise-masked stimuli — ceiling clamp blocks promotion.',
      implemented: false,
    },
  },
};

export function getPhonologicalAwarenessLevelSpec(level: number): PhonologicalAwarenessLevelSpec {
  return PHONOLOGICAL_AWARENESS_LEVELS[level] ?? PHONOLOGICAL_AWARENESS_LEVELS[1];
}

/** Receptive ladder: every rung's target is `recognition_only`. The
 *  game has no in-trial scaffold today, so every trial is on-target by
 *  support. Mirrors meaning-match / detective-mind. */
export function isOnTargetPhonologicalAwarenessTrial(
  trial: { support: SupportLevel },
  level: number,
): boolean {
  const spec = getPhonologicalAwarenessLevelSpec(level);
  if (spec.targetSupport === 'recognition_only') {
    return rank(trial.support) <= rank('recognition_only');
  }
  return true;
}

export function evidenceMetForPhonologicalAwarenessLevel(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
): boolean {
  const spec = getPhonologicalAwarenessLevelSpec(level);
  const onTarget = trials.filter((t) => isOnTargetPhonologicalAwarenessTrial(t, level));
  if (onTarget.length < spec.minOnTargetAttempts) return false;
  const correct = onTarget.filter((t) => t.correct).length;
  return correct / onTarget.length >= spec.minOnTargetAccuracy;
}

export function calculatePhonologicalAwarenessProgressDelta(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
  options: { trialWeight?: number } = {},
): number {
  const spec = getPhonologicalAwarenessLevelSpec(level);
  const weight = options.trialWeight ?? spec.trialWeight;
  let total = 0;
  for (const t of trials) {
    const base = trialCredit(t);
    if (base <= 0) continue;
    if (isOnTargetPhonologicalAwarenessTrial(t, level)) total += base * 1.25;
    else total += base * 0.4;
  }
  return total / weight;
}

export { SUPPORT_CREDIT };

export function highestImplementedPhonologicalAwarenessLevel(): number {
  return computeImplementedCeiling(PHONOLOGICAL_AWARENESS_LEVELS);
}
