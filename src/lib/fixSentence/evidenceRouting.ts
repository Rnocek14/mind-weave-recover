/**
 * Fix Sentence evidence ownership: a typed word, tap, partial repair or
 * mixed-channel sentence must never be represented as independently
 * recognized speech. This is a source/provenance decision, NOT a new
 * lexical-scoring or clinical mastery algorithm.
 *
 * Clinical progression for the pre-existing supported L1–L2 recognition
 * task is preserved. Verified speech accuracy has a separate denominator.
 */
import type { FixSentenceTrialResult, FixSentenceInputMode } from '@/hooks/useFixSentenceGame';

export interface FixSentenceEvidenceRoute {
  inputMode: FixSentenceInputMode;
  trialMode: 'production' | 'recognition' | 'scaffolded' | 'mixed';
  clinicalProgressionEligible: boolean;
  verifiedSpeechScoreEligible: boolean;
  independentSpokenScoreEligible: boolean;
  /** Browser hypotheses are not provider-verified speech. */
  browserTranscript: string | null;
}

export function routeFixSentenceEvidence(result: FixSentenceTrialResult): FixSentenceEvidenceRoute {
  // Older call sites without an explicit source fail closed.
  const inputMode = result.inputMode ?? 'unknown';
  const isBrowser = inputMode === 'browser_recognized';
  const isChoice = inputMode === 'choice';
  const supported = result.support === 'choice_based' ||
    result.support === 'highlight_plus_choice';
  const independent = isBrowser && !supported && !result.phaseAdvance;
  const clinicalProgressionEligible = isBrowser || isChoice;
  return {
    inputMode,
    trialMode: isChoice ? 'recognition' :
      isBrowser ? (supported ? 'scaffolded' : 'production') : 'mixed',
    // Retain existing game-specific supported recognition rungs; do not
    // promote typed, unverified, mixed or abandoned evidence as recovery.
    clinicalProgressionEligible,
    // A word selected from on-screen tiles is a receptive practice outcome,
    // not speech accuracy, even when the patient also speaks it.
    verifiedSpeechScoreEligible: independent,
    independentSpokenScoreEligible: independent,
    browserTranscript: isBrowser ? result.spokenWord : null,
  };
}
