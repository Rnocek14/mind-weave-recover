/**
 * Narrative Retell — separate meaningful participation, supported narrative
 * practice and browser-recognized spoken performance.
 *
 * This game has NO implemented eight-stage clinical ladder or expressive
 * mastery. The existing 60% event-coverage heuristic is an in-game success
 * criterion, NOT a clinical language-recovery threshold.
 */
import type { NarrativeTrialResult } from '@/hooks/useNarrativeRetellGame';

export type NarrativeInputMode = 'spoken' | 'typed' | 'none';
export type NarrativeCompletionReason = 'completed' | 'skipped';

/**
 * Component-to-page provenance bridge. Called with the original input
 * source before logging; assignment does not change the narrative scorer.
 */
export function annotateNarrativeResult(
  result: NarrativeTrialResult,
  evidence: {
    inputMode: NarrativeInputMode;
    completionReason: NarrativeCompletionReason;
    responseValid: boolean;
    browserTranscript?: string | null;
  },
): NarrativeTrialResult {
  result.inputMode = evidence.inputMode;
  result.completionReason = evidence.completionReason;
  result.responseValid = evidence.responseValid;
  result.browserTranscript = evidence.inputMode === 'spoken'
    ? (evidence.browserTranscript ?? null)
    : null;
  return result;
}

export interface NarrativeRoundEvidence {
  practiceSuccessful: boolean;
  /** Browser-recognized, valid speech-mode retell with no surfaced aids. */
  independentSpokenScoreEligible: boolean;
  /** Typed, skipped, invalid and scaffolded rounds remain practice-only. */
  trialMode: 'production' | 'scaffolded' | 'mixed';
  /** Explicit support source; no model or test inference. */
  support: 'none' | 'visual_or_stall_prompt';
  /** Keeps the existing game threshold consistent across score readers. */
  requiredEventCoverage: 0.6;
}

/**
 * Provisional browser transcript is not proof of speaker identity or
 * transcription quality in aphasia. An empty or rejected attempt cannot
 * prove patient decline, and typed retelling cannot become speech success.
 */
export function classifyNarrativeRoundEvidence(result: NarrativeTrialResult): NarrativeRoundEvidence {
  const validCoverage = Number.isFinite(result.eventCoverage) &&
    result.eventCoverage >= 0 && result.eventCoverage <= 1;
  const responseValid = result.responseValid === true && !result.skipped &&
    result.completionReason === 'completed' && result.transcript.trim().length > 0;
  const practiceSuccessful = validCoverage && responseValid &&
    result.eventCoverage >= 0.6;
  const visual = result.visualSupport;
  const supportUsed = !!visual && (
    visual.stallCount > 0 ||
    visual.maxResolvedSupport > 0 ||
    visual.maxStallReveal > 0 ||
    visual.rescueTriggered
  );
  const independentSpokenScoreEligible = validCoverage && responseValid &&
    result.inputMode === 'spoken' &&
    !!result.browserTranscript?.trim() &&
    !supportUsed;
  return {
    practiceSuccessful,
    independentSpokenScoreEligible,
    trialMode: independentSpokenScoreEligible ? 'production' :
      result.inputMode === 'spoken' && responseValid && supportUsed ? 'scaffolded' : 'mixed',
    support: supportUsed ? 'visual_or_stall_prompt' : 'none',
    requiredEventCoverage: 0.6,
  };
}
