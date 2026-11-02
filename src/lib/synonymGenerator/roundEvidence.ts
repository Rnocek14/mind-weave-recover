/**
 * Synonym Generator round-evidence contract.
 *
 * A successful word-matching practice task is not necessarily spoken
 * language production. Keep the legacy threshold, but separate the
 * task's feedback from eligibility for verified spoken accuracy,
 * clinical progression, in-session adaptation and expressive mastery.
 */
import { isFillerOnly } from '@/lib/clinical/classifyUtteranceValidity';

export type SynonymInputMode = 'spoken' | 'typed' | 'mixed' | 'none';
export type SynonymCompletionReason = 'timer' | 'early';

/** Use the EXISTING game thresholds on the page and in the game. */
export function getSynonymSuccessThreshold(difficulty: number): number {
  if (!Number.isFinite(difficulty)) return 4; // fail conservatively on bad data
  if (difficulty <= 2) return 2;
  if (difficulty <= 4) return 3;
  return 4;
}

export function getSynonymInputMode(
  spokenTokens: number,
  typedEntries: number,
): SynonymInputMode {
  const spoken = Number.isFinite(spokenTokens) && spokenTokens > 0;
  const typed = Number.isFinite(typedEntries) && typedEntries > 0;
  if (spoken && typed) return 'mixed';
  if (spoken) return 'spoken';
  if (typed) return 'typed';
  return 'none';
}

export interface SynonymRoundEvidenceInput {
  inputMode: SynonymInputMode;
  completionReason: SynonymCompletionReason;
  difficulty: number;
  matchCount: number;
  /** Actual recognizer output, never fabricated from expected words. */
  browserTranscript?: string | null;
}

export interface SynonymRoundEvidence {
  /** Keeps gameplay feedback and practice summaries available. */
  practiceSuccessful: boolean;
  /** Only a full timed, speech-only round may be an expressive trial. */
  trialMode: 'production' | 'mixed';
  /** The downstream unified-trial writer skips clinical progression if false. */
  clinicalProgressionEligible: boolean;
  /** Separate score flag for clinician-facing verified summary consumers. */
  verifiedSpokenScoreEligible: boolean;
  /** The threshold applied to this exact played content difficulty. */
  requiredMatches: number;
}

/**
 * The browser speech recognizer reports words, not clinical ASR correctness.
 * 'Spoken' here means recognized speech-mode input, not proof of the speaker,
 * an acoustic diagnosis, or demonstrated functional transfer.
 */
export function classifySynonymRoundEvidence(
  input: SynonymRoundEvidenceInput,
): SynonymRoundEvidence {
  const requiredMatches = getSynonymSuccessThreshold(input.difficulty);
  const practiceSuccessful = Number.isFinite(input.matchCount) &&
    input.matchCount >= requiredMatches;
  // A browser speech callback containing only "um/uh/hmm", or no raw
  // transcript at all, is NOT sufficient evidence of a speech attempt.
  // Reuse the existing utterance-validity filler detector; do not invent
  // target words, an ASR transcript, or clinical speaker verification.
  const transcript = (input.browserTranscript ?? '').trim();
  const hasScorableTranscript = transcript.length > 0 && !isFillerOnly(transcript);
  const eligible = input.inputMode === 'spoken' && input.completionReason === 'timer' &&
    hasScorableTranscript &&
    Number.isFinite(input.difficulty) && input.difficulty >= 1 && input.difficulty <= 10 &&
    Number.isFinite(input.matchCount) && input.matchCount >= 0;
  return {
    requiredMatches,
    practiceSuccessful,
    trialMode: eligible ? 'production' : 'mixed',
    clinicalProgressionEligible: eligible,
    verifiedSpokenScoreEligible: eligible,
  };
}
