/**
 * Minimal Pairs — level-specific clinical criteria (Phase 1 stub).
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
}

export const MINIMAL_PAIRS_LEVELS: Record<number, MinimalPairsLevelSpec> = {
  1: {
    level: 1,
    description: 'Distinct contrasts — easy to hear apart',
    targetSupport: 'after_replay',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
  },
  2: {
    level: 2,
    description: 'Distinct contrasts — slightly faster pace',
    targetSupport: 'after_replay',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
  },
  3: {
    level: 3,
    description: 'Distinct contrasts — independent on first listen',
    targetSupport: 'first_listen',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
  },
  4: {
    level: 4,
    description: 'Single-feature contrasts — first listen target',
    targetSupport: 'first_listen',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
  },
  5: {
    level: 5,
    description: 'Single-feature contrasts — higher accuracy bar',
    targetSupport: 'first_listen',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.75,
    readiness: 'thin',
  },
  6: {
    level: 6,
    description: 'Single-feature contrasts — broadened phoneme coverage',
    targetSupport: 'first_listen',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
  },
  7: {
    level: 7,
    description: 'Single-feature contrasts — sustained performance',
    targetSupport: 'first_listen',
    minOnTargetAttempts: 8,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
  },
  8: {
    level: 8,
    description: 'Fast discrimination under load (Phase 2 — aspirational)',
    targetSupport: 'first_listen',
    minOnTargetAttempts: 8,
    minOnTargetAccuracy: 0.85,
    readiness: 'aspirational',
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
 * Level-aware progress delta. Mirrors PhotoNaming weighting:
 *   - on-target correct  → base credit × 1.25 (consistency bonus)
 *   - below-target correct → base credit × 0.4 (practice credit)
 *   - incorrect → 0
 */
export function calculateMinimalPairsProgressDelta(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
  options: { trialWeight?: number } = {},
): number {
  const weight = options.trialWeight ?? 2.5;
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
