/**
 * Fix the Sentence — domain-specific clinical level ladder.
 *
 * Clinical basis & honest scope: see docs/clinical-evidence/fix-sentence.md.
 * TL;DR: staged scaffold-fading is the design rationale (Mapping Therapy,
 * TUF, VNeST). The specific scaffold→open ordering shipped here is a
 * clinical design choice, NOT a literature-proven cue ranking. Numeric
 * thresholds (accuracy bars, SUPPORT_CREDIT, trialWeight) are CLINICALLY
 * MOTIVATED CALIBRATION DEFAULTS — tunable, not evidence-based constants.
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
  /**
   * PR6 (Phase 2.5): per-level content-selection contract. Pure metadata —
   * the runtime selector lives in `fixSentenceContentSelector.ts`. Lets dev
   * tools, tests, and clinician-facing surfaces describe what content each
   * level uses, separately from the evidence/accuracy rule.
   */
  contentSelector?: {
    tierKey:
      | 'baseline'
      | 'single_error_common_verbs'
      | 'two_error'
      | 'mixed_morphology'
      | 'embedded_clauses'
      | 'open_ended_repair';
    description: string;
    implemented: boolean;
  };
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
    contentSelector: { tierKey: 'baseline', description: 'Engine difficulty bands handle L1–L3 content.', implemented: true },
  },
  2: {
    level: 2,
    description: 'Repairs within-category swaps with structural support',
    targetSupport: 'choice_based',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.7,
    trialWeight: 0.55,
    contentSelector: { tierKey: 'baseline', description: 'Engine difficulty bands handle L1–L3 content.', implemented: true },
  },
  3: {
    level: 3,
    description: 'Repairs semantic swaps independently',
    targetSupport: 'open_response',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.7,
    trialWeight: 0.75,
    contentSelector: { tierKey: 'baseline', description: 'Engine difficulty bands handle L1–L3 content.', implemented: true },
  },
  4: {
    level: 4,
    description: 'Single-error sentences with common action verbs',
    targetSupport: 'open_response',
    minOnTargetAttempts: 4,
    minOnTargetAccuracy: 0.7,
    trialWeight: 1.0,
    contentSelector: {
      tierKey: 'single_error_common_verbs',
      description: 'function_error cohort filtered to sentences containing a common transitive verb.',
      implemented: true,
    },
  },
  5: {
    level: 5,
    description: 'Two-error sentences (NOT implemented — selector skips honestly)',
    targetSupport: 'open_response',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    trialWeight: 1.25,
    contentSelector: {
      tierKey: 'two_error',
      description: 'Requires multi-error trial schema + multi-target scoring — NOT yet implemented; selector skips honestly.',
      implemented: false,
    },
  },
  6: {
    level: 6,
    description: 'Mixed morphology (NOT implemented — selector skips honestly)',
    targetSupport: 'open_response',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.8,
    trialWeight: 1.7,
    contentSelector: {
      tierKey: 'mixed_morphology',
      description: 'Requires morphology/inflection tags on bank + morpheme-aware scorer — NOT yet implemented; selector skips honestly.',
      implemented: false,
    },
  },
  7: {
    level: 7,
    description: 'Embedded clauses (NOT implemented — selector skips honestly)',
    targetSupport: 'open_response',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.8,
    trialWeight: 2.0,
    contentSelector: {
      tierKey: 'embedded_clauses',
      description: 'Requires syntactic-structure tags (relative/complement clauses) on bank — NOT yet implemented; selector skips honestly.',
      implemented: false,
    },
  },
  8: {
    level: 8,
    description: 'Open-ended repair (NOT implemented — selector skips honestly)',
    targetSupport: 'open_response',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.85,
    trialWeight: 2.5,
    contentSelector: {
      tierKey: 'open_ended_repair',
      description: 'Requires LLM-graded open-ended judge or expanded fix banks — NOT yet implemented; selector skips honestly.',
      implemented: false,
    },
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
 * Cue-dependency gate (PR3).
 *
 * Threshold above which the *session* is judged scaffold-reliant and a
 * pending level-up is held even when accuracy + minOnTargetAttempts pass.
 * Clinically motivated calibration default — not an evidence-derived
 * constant. Mirrors the in-game adaptive UP-escalation guard
 * (`useAdaptiveDifficulty.cueDependencyEscalationThreshold = 0.5`).
 */
export const FIX_SENTENCE_CUE_DEPENDENCY_BLOCK_THRESHOLD = 0.5;

/**
 * Fraction of trials in the session that landed *below* the level's target
 * support tier (i.e. relied on `choice_based` / `highlight_plus_choice`
 * scaffolding when open response was expected). Empty trial list → 0.
 */
export function cueDependencyForFixSentenceSession(
  trials: Array<{ support: SupportLevel }>,
  level: number,
): number {
  if (trials.length === 0) return 0;
  const scaffolded = trials.filter((t) => !isOnTargetFixSentenceTrial(t, level)).length;
  return scaffolded / trials.length;
}

/**
 * Returns true when the cue-dependency fraction for this session exceeds
 * the block threshold. Caller ANDs this into `evidenceMet` to hold the
 * level until the patient demonstrates the same accuracy with less help.
 */
export function isFixSentenceCueDependencyBlocking(
  trials: Array<{ support: SupportLevel }>,
  level: number,
  threshold = FIX_SENTENCE_CUE_DEPENDENCY_BLOCK_THRESHOLD,
): boolean {
  return cueDependencyForFixSentenceSession(trials, level) > threshold;
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

/** Highest level whose contentSelector ships differentiated content. */
export function highestImplementedFixSentenceLevel(): number {
  return computeImplementedCeiling(FIX_SENTENCE_LEVELS);
}
