/**
 * Fix Sentence — per-trial taskParameters builder (wave-13 telemetry QA).
 *
 * Pure module so the mapping from a FixSentenceTrialResult to the
 * telemetry payload is testable without rendering the exercise page.
 * Adds the tier-specific fields the L5/L6 launches introduced:
 *   - bank_error_type: the trial's authored error class
 *     (semantic_swap / morphology_error / …) — distinct from the
 *     submission-level errorType (correct/incorrect_close/incorrect_fix)
 *   - morphology_error_class: tense/agreement/… for L6 trials
 *   - phase1_fix / phase2_fix: the two-error repair halves; a PARTIAL
 *     with phase2_fix === null is an abandoned second repair, which is
 *     NOT the same clinical event as a near-miss close_miss
 *   - two_error_trial: fast filter for L5 analysis queries
 */
import type { FixSentenceTrialResult } from '@/hooks/useFixSentenceGame';
import type { FixSentenceTrial } from '@/data/fixSentenceBank';
import {
  FIX_SENTENCE_BANK,
  FIX_SENTENCE_TWO_ERROR_BANK,
  FIX_SENTENCE_MORPHOLOGY_BANK,
} from '@/data/fixSentenceBank';

let trialById: Map<string, FixSentenceTrial> | null = null;

export function lookupFixSentenceTrial(trialId: string): FixSentenceTrial | undefined {
  if (!trialById) {
    trialById = new Map();
    for (const t of [
      ...FIX_SENTENCE_BANK,
      ...FIX_SENTENCE_TWO_ERROR_BANK,
      ...FIX_SENTENCE_MORPHOLOGY_BANK,
    ]) {
      trialById.set(t.id, t);
    }
  }
  return trialById.get(trialId);
}

export function buildFixSentenceTaskParameters(
  result: FixSentenceTrialResult,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const trial = lookupFixSentenceTrial(result.trialId);
  return {
    trial_id: result.trialId,
    sentence: result.sentence,
    wrong_word: result.wrongWord,
    spoken_word: result.spokenWord,
    matched_fix: result.matchedFix,
    self_corrected: result.selfCorrected,
    semantic_similarity: result.semanticSimilarity,
    difficulty: result.difficulty,
    trial_source: 'fix_sentence_bank',
    close_miss: !result.isCorrect && result.isPartialCredit && result.phase1Fix == null,
    bank_error_type: trial?.errorType ?? null,
    morphology_error_class: trial?.morphology?.errorClass ?? null,
    two_error_trial: trial?.secondError != null,
    phase1_fix: result.phase1Fix ?? null,
    phase2_fix: result.phase2Fix ?? null,
    phase2_abandoned: result.phase1Fix != null && result.phase2Fix === null && result.isPartialCredit,
    ...extra,
  };
}
