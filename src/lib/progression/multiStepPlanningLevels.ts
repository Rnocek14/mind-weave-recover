/**
 * Multi-Step Planning — structural ladder (Phase 2, Wave 2).
 *
 * Expressive discourse-level executive task: patient speaks an ordered
 * multi-step plan for a goal. `submitTrial` emits `trialMode: 'production'`
 * and the slug IS added to ADOPTED_TRIAL_MODE_SLUGS — trials route into
 * expressive mastery alongside the other discourse/production tasks.
 *
 * Clinical basis & honest scope: see docs/clinical-evidence/multi-step-planning.md.
 * TL;DR: Multi-step procedural discourse training is well-supported in
 * cognitive-communication / executive-function rehab (Sohlberg & Mateer
 * APT framework; script training literature). The specific 3-tier complexity
 * progression (familiar daily tasks → multi-stage planning → novel/abstract
 * goals) shipped here is a CLINICALLY MOTIVATED CALIBRATION DEFAULT against
 * the existing PLANNING_ITEMS bank's tier 1–3 spread, not a literature-proven
 * head-to-head hierarchy. Per-level accuracy bars are tunable.
 *
 * Support axis (executive / open-production):
 *   The current game UI has no in-trial scaffold control — the patient
 *   simply speaks. Every trial is `open_response`. The ladder advances on
 *   accuracy + sequence-coverage growth at progressively harder content
 *   tiers, not on scaffold fading. This matches MSP's clinical reality.
 *
 * Phase 1 readiness:
 *   L1–L4 → ready (bank tier 1 — familiar daily procedures)
 *   L5–L6 → ready (bank tier 2 — multi-stage planning with constraints)
 *   L7    → thin  (bank tier 3 — novel/abstract goals, sparse coverage)
 *   L8    → aspirational (no constrained-output runtime mode; ceiling clamp)
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

export interface MultiStepPlanningLevelSpec {
  level: number;
  description: string;
  targetSupport: SupportLevel;
  minOnTargetAttempts: number;
  minOnTargetAccuracy: number;
  readiness: 'ready' | 'thin' | 'aspirational';
  trialWeight: number;
  contentSelector?: {
    tierKey:
      | 'daily_familiar'
      | 'daily_extended'
      | 'multi_stage'
      | 'multi_stage_constrained'
      | 'novel_abstract'
      | 'constrained_output';
    description: string;
    implemented: boolean;
  };
}

/**
 * Level ladder (procedural-discourse independence + complexity):
 *   L1–L2 — Familiar daily routines (bank tier 1), light accuracy bar
 *   L3–L4 — Extended daily routines (bank tier 1–2), full coverage required
 *   L5–L6 — Multi-stage planning with constraints (bank tier 2)
 *   L7    — Novel / abstract goals (bank tier 3, thin)
 *   L8    — Constrained-output spontaneous planning (aspirational; no
 *           runtime mode that enforces step-count / temporal markers yet)
 */
export const MULTI_STEP_PLANNING_LEVELS: Record<number, MultiStepPlanningLevelSpec> = {
  1: {
    level: 1,
    description: 'Familiar daily routine — partial coverage acceptable',
    targetSupport: 'open_response',
    minOnTargetAttempts: 3,
    minOnTargetAccuracy: 0.6,
    readiness: 'ready',
    trialWeight: 0.4,
    contentSelector: { tierKey: 'daily_familiar', description: 'Bank tier 1: brushing teeth, making tea, etc.', implemented: true },
  },
  2: {
    level: 2,
    description: 'Familiar daily routine — full step coverage',
    targetSupport: 'open_response',
    minOnTargetAttempts: 3,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.55,
    contentSelector: { tierKey: 'daily_familiar', description: 'Bank tier 1 with stricter coverage requirement.', implemented: true },
  },
  3: {
    level: 3,
    description: 'Extended daily routine — ordered steps required',
    targetSupport: 'open_response',
    minOnTargetAttempts: 3,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.75,
    contentSelector: { tierKey: 'daily_extended', description: 'Bank tier 1–2 boundary: getting ready for work, grocery run.', implemented: true },
  },
  4: {
    level: 4,
    description: 'Extended routine — temporal markers + sequence integrity',
    targetSupport: 'open_response',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.0,
    contentSelector: { tierKey: 'daily_extended', description: 'Bank tier 2 with sequence-score expectation.', implemented: true },
  },
  5: {
    level: 5,
    description: 'Multi-stage planning — bank tier 2',
    targetSupport: 'open_response',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.25,
    contentSelector: { tierKey: 'multi_stage', description: 'Bank tier 2: planning a small event, packing for a trip.', implemented: true },
  },
  6: {
    level: 6,
    description: 'Multi-stage planning under constraints',
    targetSupport: 'open_response',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.8,
    readiness: 'ready',
    trialWeight: 1.5,
    contentSelector: { tierKey: 'multi_stage_constrained', description: 'Bank tier 2 with constraint cues (budget, time, dependencies).', implemented: true },
  },
  7: {
    level: 7,
    description: 'Novel / abstract goals — bank tier 3',
    targetSupport: 'open_response',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
    trialWeight: 2.0,
    contentSelector: { tierKey: 'novel_abstract', description: 'Bank tier 3 — sparse; rotation only.', implemented: true },
  },
  8: {
    level: 8,
    description: 'Constrained-output spontaneous planning — design-of-record',
    targetSupport: 'open_response',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.85,
    readiness: 'aspirational',
    trialWeight: 2.5,
    contentSelector: {
      tierKey: 'constrained_output',
      description: 'No runtime mode that enforces step-count / temporal markers — ceiling clamp blocks promotion.',
      implemented: false,
    },
  },
};

export function getMultiStepPlanningLevelSpec(level: number): MultiStepPlanningLevelSpec {
  return MULTI_STEP_PLANNING_LEVELS[level] ?? MULTI_STEP_PLANNING_LEVELS[1];
}

export function isOnTargetMultiStepPlanningTrial(
  trial: { support: SupportLevel },
  level: number,
): boolean {
  const spec = getMultiStepPlanningLevelSpec(level);
  return rank(trial.support) >= rank(spec.targetSupport);
}

export function evidenceMetForMultiStepPlanningLevel(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
): boolean {
  const spec = getMultiStepPlanningLevelSpec(level);
  const onTarget = trials.filter((t) => isOnTargetMultiStepPlanningTrial(t, level));
  if (onTarget.length < spec.minOnTargetAttempts) return false;
  const correct = onTarget.filter((t) => t.correct).length;
  return correct / onTarget.length >= spec.minOnTargetAccuracy;
}

export function calculateMultiStepPlanningProgressDelta(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
  options: { trialWeight?: number } = {},
): number {
  const spec = getMultiStepPlanningLevelSpec(level);
  const weight = options.trialWeight ?? spec.trialWeight;
  let total = 0;
  for (const t of trials) {
    const base = trialCredit(t);
    if (base <= 0) continue;
    if (isOnTargetMultiStepPlanningTrial(t, level)) total += base * 1.25;
    else total += base * 0.4;
  }
  return total / weight;
}

export { SUPPORT_CREDIT };

export function highestImplementedMultiStepPlanningLevel(): number {
  return computeImplementedCeiling(MULTI_STEP_PLANNING_LEVELS);
}
