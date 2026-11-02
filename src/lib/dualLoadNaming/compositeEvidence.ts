/**
 * Dual-Load Naming measures TWO different tasks:
 *   1. browser-recognized spoken picture naming during memory load
 *   2. typed recall of the previously presented word list
 *
 * It is a mixed-modality composite. A successful typed recall cannot itself
 * establish independent expressive speech recovery. The existing game
 * success definition is preserved (>=0.67 recall AND >=0.60 naming).
 */
import type { DualLoadTrialResult } from '@/hooks/useDualLoadNamingGame';
import { isFillerOnly } from '@/lib/clinical/classifyUtteranceValidity';

export interface DualLoadCompositeEvidence {
  combinedSuccess: boolean;
  clinicalProgressionEligible: boolean;
  trialMode: 'mixed';
  scorableSpokenNamingAttempts: number;
  namingAttemptCount: number;
  skippedOrUnscorableNamingAttempts: number;
  recallInputMode: 'typed';
  namingInputMode: 'browser_speech';
}

/** Existing threshold used by the actual game's adaptation hook. */
export function isDualLoadCombinedSuccess(input: Pick<DualLoadTrialResult, 'namingAccuracy' | 'recallAccuracy'>): boolean {
  return Number.isFinite(input.recallAccuracy) && input.recallAccuracy >= 0.67 &&
    Number.isFinite(input.namingAccuracy) && input.namingAccuracy >= 0.6;
}

export function classifyDualLoadCompositeEvidence(
  result: DualLoadTrialResult,
): DualLoadCompositeEvidence {
  const attempts = Array.isArray(result.namingAttempts) ? result.namingAttempts : [];
  const scorable = attempts.filter(attempt => {
    const transcript = (attempt.userResponse ?? '').trim();
    return transcript.length > 0 && !isFillerOnly(transcript);
  }).length;
  const measuresValid =
    Number.isFinite(result.namingAccuracy) && result.namingAccuracy >= 0 && result.namingAccuracy <= 1 &&
    Number.isFinite(result.recallAccuracy) && result.recallAccuracy >= 0 && result.recallAccuracy <= 1;
  return {
    combinedSuccess: isDualLoadCombinedSuccess(result),
    // When all spoken targets were skipped, or recognized only filler, there
    // is no valid basis for a spoken under-load performance conclusion.
    // The memory-typing task is still logged as practice.
    clinicalProgressionEligible: measuresValid && scorable > 0,
    // Mixed task: never send composite recall+speech success to expressive
    // production mastery. A separate naming-only measure is needed for that.
    trialMode: 'mixed',
    scorableSpokenNamingAttempts: scorable,
    namingAttemptCount: attempts.length,
    skippedOrUnscorableNamingAttempts: attempts.length - scorable,
    recallInputMode: 'typed',
    namingInputMode: 'browser_speech',
  };
}
