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
  const spoken = mode === 'spoken' && validCommunication;
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
