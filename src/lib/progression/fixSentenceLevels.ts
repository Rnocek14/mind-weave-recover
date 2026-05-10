/**
 * Fix the Sentence — domain-specific clinical level ladder.
 *
 * IMPORTANT: Fix Sentence is NOT lexical retrieval. Its rehab progression is
 * about *sentence-repair independence* — detecting an error in a structured
 * sentence and producing a grammatically/semantically coherent replacement
 * without scaffolding. So we deliberately do NOT reuse Photo Naming's
 * naming-independence semantics. We share the persistence architecture and
 * the accounting discipline; we do NOT share the level meanings.
 *
 * Support tiers used here (already declared in clinicalProgression.ts):
 *   open_response          — patient produced the fix from their own retrieval
 *   choice_based           — patient chose from offered alternatives
 *   highlight_plus_choice  — wrong word highlighted AND choices offered
 *
 * Pure module — no I/O, no React.
 */

import type { SupportLevel } from './clinicalProgression';
import { SUPPORT_CREDIT, trialCredit } from './clinicalProgression';

const SUPPORT_RANK: Record<string, number> = {
  highlight_plus_choice: 0,
  choice_based: 1,
  open_response: 2,
};

function rank(s: SupportLevel): number {
  return SUPPORT_RANK[s] ?? -1;
}

export interface FixSentenceLevelSpec {
  level: number;
  /** Human-readable clinical description of what this level trains. */
  description: string;
  /**
   * Minimum support tier (rank) that counts as on-target evidence at this
   * level. A trial at or above this rank contributes to evidenceMet.
   */
  targetSupport: SupportLevel;
  minOnTargetAttempts: number;
  minOnTargetAccuracy: number;
  /**
   * Per-level divisor for `calculateFixSentenceProgressDelta`. Lower values
   * graduate the level faster — early levels intentionally cadence quickly so
   * patients see motion within ~3 sessions; later levels slow the climb to
   * demand more evidence. Mirrors the per-level weighting calibration shipped
   * for Photo Naming.
   */
  trialWeight: number;
}

/**
 * Level ladder (sentence-repair independence):
 *   L1 — Detects & repairs obvious category violations (highlight + open is OK)
 *   L2 — Repairs within-category semantic swaps with structural support
 *   L3 — Repairs semantic swaps independently
 *   L4 — Repairs function-mismatch errors with light support
 *   L5 — Repairs function-mismatch errors independently
 *   L6 — Independent repair across categories with reduced latency
 *   L7 — Repairs multi-valid / ambiguous sentences independently
 *   L8 — Stable functional sentence repair with generalization
 *
 * Until per-level *content* tiers exist beyond the Fix Sentence bank's
 * 3-tier structure, L4–L8 raise the accuracy bar instead of changing the
 * required support tier. That keeps the ladder honest: a session that only
 * succeeds with heavy scaffolding cannot graduate L3+.
 */
export const FIX_SENTENCE_LEVELS: Record<number, FixSentenceLevelSpec> = {
  1: {
    level: 1,
    description: 'Detects & repairs obvious category violations',
    targetSupport: 'highlight_plus_choice',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.7,
    trialWeight: 0.4,
  },
  2: {
    level: 2,
    description: 'Repairs within-category swaps with structural support',
    targetSupport: 'choice_based',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.7,
    trialWeight: 0.55,
  },
  3: {
    level: 3,
    description: 'Repairs semantic swaps independently',
    targetSupport: 'open_response',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.7,
    trialWeight: 0.75,
  },
  4: {
    level: 4,
    description: 'Repairs function-mismatch errors with light support',
    targetSupport: 'open_response',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.7,
    trialWeight: 1.0,
  },
  5: {
    level: 5,
    description: 'Repairs function-mismatch errors independently',
    targetSupport: 'open_response',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    trialWeight: 1.25,
  },
  6: {
    level: 6,
    description: 'Independent repair across categories, reduced latency',
    targetSupport: 'open_response',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.8,
    trialWeight: 1.7,
  },
  7: {
    level: 7,
    description: 'Repairs multi-valid / ambiguous sentences independently',
    targetSupport: 'open_response',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.8,
    trialWeight: 2.0,
  },
  8: {
    level: 8,
    description: 'Stable functional sentence repair with generalization',
    targetSupport: 'open_response',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.85,
    trialWeight: 2.5,
  },
};

export function getFixSentenceLevelSpec(level: number): FixSentenceLevelSpec {
  return FIX_SENTENCE_LEVELS[level] ?? FIX_SENTENCE_LEVELS[1];
}

export function isOnTargetFixSentenceTrial(
  trial: { support: SupportLevel },
  level: number,
): boolean {
  const spec = getFixSentenceLevelSpec(level);
  return rank(trial.support) >= rank(spec.targetSupport);
}

export function evidenceMetForFixSentenceLevel(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
): boolean {
  const spec = getFixSentenceLevelSpec(level);
  const onTarget = trials.filter((t) => isOnTargetFixSentenceTrial(t, level));
  if (onTarget.length < spec.minOnTargetAttempts) return false;
  const correct = onTarget.filter((t) => t.correct).length;
  return correct / onTarget.length >= spec.minOnTargetAccuracy;
}

/**
 * Per-trial weighted progress contribution. On-target trials earn the full
 * support credit + a small consistency bonus; below-target trials count as
 * partial practice credit only and cannot graduate the level on their own.
 *
 * Defaults to the level-specific `trialWeight` so early levels graduate in
 * ~3 sessions and later levels demand more evidence. Callers may still pass
 * an explicit override for tests or simulation.
 */
export function calculateFixSentenceProgressDelta(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
  options: { trialWeight?: number } = {},
): number {
  const spec = getFixSentenceLevelSpec(level);
  const weight = options.trialWeight ?? spec.trialWeight;
  let total = 0;
  for (const t of trials) {
    const base = trialCredit(t);
    if (base <= 0) continue;
    if (isOnTargetFixSentenceTrial(t, level)) {
      total += base * 1.25;
    } else {
      total += base * 0.4;
    }
  }
  return total / weight;
}

export { SUPPORT_CREDIT };
