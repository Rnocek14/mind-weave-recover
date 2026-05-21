/**
 * Dual-Load Naming — structural ladder (Phase 2, Wave 3).
 *
 * Expressive confrontation-naming-under-load task: patient memorises a
 * 3-word list, names 6 pictures (the load), then recalls the list.
 * `submitTrial` emits `trialMode: 'production'` and the slug IS added
 * to ADOPTED_TRIAL_MODE_SLUGS — trials route into expressive mastery.
 *
 * Clinical basis & honest scope: see docs/clinical-evidence/dual-load-naming.md.
 * TL;DR: Dual-task naming under WM load (Murray & Lenz; Salis WM-in-aphasia
 * reviews) targets interference resistance during retrieval. The specific
 * 3-tier content collapse (familiar concrete → mixed-frequency → low-frequency)
 * shipped here is a CLINICALLY MOTIVATED CALIBRATION DEFAULT against the
 * existing DUAL_LOAD_SETS bank's tier 1–3 spread.
 *
 * Support axis (executive / open-production):
 *   The current game UI has no in-trial scaffold control — there is no
 *   hint button, no phonemic cue, no carrier prompt. The patient simply
 *   speaks under the load. Every trial is `open_response`. The ladder
 *   advances on combined naming + recall accuracy at progressively harder
 *   content tiers, not on scaffold fading.
 *
 * Phase 1 readiness:
 *   L1–L4 → ready (bank tier 1 — familiar high-frequency targets)
 *   L5–L6 → ready (bank tier 2 — mixed-frequency targets)
 *   L7    → thin  (bank tier 3 — low-frequency, sparse)
 *   L8    → aspirational (no constrained-output runtime mode that
 *           lengthens the memory list beyond 3 or adds distractors)
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

export interface DualLoadNamingLevelSpec {
  level: number;
  description: string;
  targetSupport: SupportLevel;
  minOnTargetAttempts: number;
  minOnTargetAccuracy: number;
  readiness: 'ready' | 'thin' | 'aspirational';
  trialWeight: number;
  contentSelector?: {
    tierKey:
      | 'familiar_short'
      | 'familiar_extended'
      | 'mixed_frequency'
      | 'mixed_frequency_sustained'
      | 'low_frequency'
      | 'constrained_output';
    description: string;
    implemented: boolean;
  };
}

/**
 * Level ladder (confrontation naming under WM load):
 *   L1–L2 — Familiar high-frequency targets, 3-word load; light accuracy bar
 *   L3–L4 — Familiar extended bank (tier 1 boundary); full coverage required
 *   L5–L6 — Mixed-frequency targets (bank tier 2); sustained productivity
 *   L7    — Low-frequency targets (bank tier 3, thin)
 *   L8    — Constrained-output: longer memory list / distractor task
 *           (aspirational; no runtime mode yet)
 */
export const DUAL_LOAD_NAMING_LEVELS: Record<number, DualLoadNamingLevelSpec> = {
  1: {
    level: 1,
    description: 'Familiar targets under 3-word load — light accuracy bar',
    targetSupport: 'open_response',
    minOnTargetAttempts: 3,
    minOnTargetAccuracy: 0.6,
    readiness: 'ready',
    trialWeight: 0.4,
    contentSelector: { tierKey: 'familiar_short', description: 'Bank tier 1: kitchen / clothing / body-part naming sets.', implemented: true },
  },
  2: {
    level: 2,
    description: 'Familiar targets — full coverage required',
    targetSupport: 'open_response',
    minOnTargetAttempts: 3,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.55,
    contentSelector: { tierKey: 'familiar_short', description: 'Bank tier 1 with stricter accuracy expectation.', implemented: true },
  },
  3: {
    level: 3,
    description: 'Familiar extended — bank tier 1 boundary',
    targetSupport: 'open_response',
    minOnTargetAttempts: 3,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.75,
    contentSelector: { tierKey: 'familiar_extended', description: 'Bank tier 1 deeper rotation; tier 2 boundary stimuli.', implemented: true },
  },
  4: {
    level: 4,
    description: 'Familiar extended — recall + naming integrity',
    targetSupport: 'open_response',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.0,
    contentSelector: { tierKey: 'familiar_extended', description: 'Bank tier 1/2 with recall score expectation.', implemented: true },
  },
  5: {
    level: 5,
    description: 'Mixed-frequency targets — bank tier 2',
    targetSupport: 'open_response',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.25,
    contentSelector: { tierKey: 'mixed_frequency', description: 'Bank tier 2: less common concrete targets under load.', implemented: true },
  },
  6: {
    level: 6,
    description: 'Mixed-frequency — sustained productivity',
    targetSupport: 'open_response',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.8,
    readiness: 'ready',
    trialWeight: 1.5,
    contentSelector: { tierKey: 'mixed_frequency_sustained', description: 'Bank tier 2 with higher per-trial naming-accuracy expectation.', implemented: true },
  },
  7: {
    level: 7,
    description: 'Low-frequency targets — thin bank',
    targetSupport: 'open_response',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
    trialWeight: 2.0,
    contentSelector: { tierKey: 'low_frequency', description: 'Bank tier 3: low-frequency targets under load; sparse coverage, rotation only.', implemented: true },
  },
  8: {
    level: 8,
    description: 'Constrained-output (longer memory list / distractor) — design-of-record',
    targetSupport: 'open_response',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.85,
    readiness: 'aspirational',
    trialWeight: 2.5,
    contentSelector: {
      tierKey: 'constrained_output',
      description: 'No runtime mode that lengthens the memory list beyond 3 or adds a distractor task — ceiling clamp blocks promotion.',
      implemented: false,
    },
  },
};

export function getDualLoadNamingLevelSpec(level: number): DualLoadNamingLevelSpec {
  return DUAL_LOAD_NAMING_LEVELS[level] ?? DUAL_LOAD_NAMING_LEVELS[1];
}

export function isOnTargetDualLoadNamingTrial(
  trial: { support: SupportLevel },
  level: number,
): boolean {
  const spec = getDualLoadNamingLevelSpec(level);
  return rank(trial.support) >= rank(spec.targetSupport);
}

export function evidenceMetForDualLoadNamingLevel(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
): boolean {
  const spec = getDualLoadNamingLevelSpec(level);
  const onTarget = trials.filter((t) => isOnTargetDualLoadNamingTrial(t, level));
  if (onTarget.length < spec.minOnTargetAttempts) return false;
  const correct = onTarget.filter((t) => t.correct).length;
  return correct / onTarget.length >= spec.minOnTargetAccuracy;
}

export function calculateDualLoadNamingProgressDelta(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
  options: { trialWeight?: number } = {},
): number {
  const spec = getDualLoadNamingLevelSpec(level);
  const weight = options.trialWeight ?? spec.trialWeight;
  let total = 0;
  for (const t of trials) {
    const base = trialCredit(t);
    if (base <= 0) continue;
    if (isOnTargetDualLoadNamingTrial(t, level)) total += base * 1.25;
    else total += base * 0.4;
  }
  return total / weight;
}

export { SUPPORT_CREDIT };

export function highestImplementedDualLoadNamingLevel(): number {
  return computeImplementedCeiling(DUAL_LOAD_NAMING_LEVELS);
}
