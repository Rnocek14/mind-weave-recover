/**
 * Describe & Guess: distinguish meaningful supported/typed circumlocution
 * practice from independent spoken expressive evidence.
 *
 * The game's eight proposed clinical levels are design-only. This file
 * does NOT create a progression ladder or define a clinical recovery cutoff.
 */
import type { DescribeGuessTrialResult } from '@/hooks/useDescribeGuessGame';

export type DescribeGuessInputMode = 'spoken' | 'typed' | 'unknown';

export interface DescribeGuessEvidence {
  practiceSuccessful: boolean;
  independentSpokenScoreEligible: boolean;
  shouldAdaptSpokenTask: boolean;
  trialMode: 'production' | 'scaffolded' | 'mixed';
  cueCount: number;
  inputMode: DescribeGuessInputMode;
  validCommunication: boolean;
}

export function classifyDescribeGuessEvidence(result: DescribeGuessTrialResult): DescribeGuessEvidence {
  const mode = result.inputMode ?? 'unknown';
  const prompts = Array.isArray(result.promptsShown) ? result.promptsShown.length : 0;
  // Description content and word/meaning scores are separate dimensions.
  // A meaningful but unsuccessful uncued attempt can legitimately contribute
  // a scored 0 to an explicitly identified spoken-practice denominator.
  const validCommunication = result.communicationWin === true &&
    typeof result.transcript === 'string' &&
    result.transcript.trim().length > 0;
  // A caller's spoken mode flag is not itself evidence that recognition ran.
  // Without the original browser transcript, abstain from independent scores
  // and speech-driven adaptation rather than promoting unverified text.
  const hasBrowserTranscript = typeof result.browserTranscript === 'string' &&
    result.browserTranscript.trim().length > 0;
  const spoken = mode === 'spoken' && validCommunication && hasBrowserTranscript;
  const independent = spoken && prompts === 0;
  return {
    practiceSuccessful: result.meaningWin === true || result.wordWin === true,
    independentSpokenScoreEligible: independent,
    shouldAdaptSpokenTask: spoken,
    trialMode: independent ? 'production' : spoken ? 'scaffolded' : 'mixed',
    cueCount: prompts,
    inputMode: mode,
    validCommunication,
  };
}
