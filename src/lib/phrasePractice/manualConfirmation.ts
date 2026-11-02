/**
 * The target phrase is printed in full throughout the trial, including after
 * Next/Restart. Even without playing TTS, this is visual lexical support.
 * Never report these rounds as uncued independent spoken production.
 */
export const VISIBLE_PHRASE_CUE_LEVEL = 1 as const;

/**
 * User-confirmed phrase practice is participation evidence, not ASR verification.
 * A self-report must not fabricate a transcript or word-match percentage.
 */
export function buildManualPhraseConfirmation(input: {
  phraseId: string;
  difficulty: number;
  cueLevel: number;
  timeMs: number;
  attempts: number;
}): {
  correct: true;
  manualConfirmed: true;
  wordAccuracy: null;
  whisperTranscript: undefined;
  phraseId: string;
  difficulty: number;
  cueLevel: number;
  timeMs: number;
  repetitions: number;
} {
  return {
    correct: true,
    manualConfirmed: true,
    wordAccuracy: null,
    whisperTranscript: undefined,
    phraseId: input.phraseId,
    difficulty: input.difficulty,
    cueLevel: input.cueLevel,
    timeMs: Math.max(0, input.timeMs),
    repetitions: Math.max(1, input.attempts + 1),
  };
}

/** Only Phrase Practice has a separately audited self-report path.
 * Generic "I Said It" clicks on other embedded exercises used to fabricate
 * a `correct` scored trial despite those games owning their own outcomes.
 */
export function canSelfReportPracticeFromLegacyExercise(routeId: string | null | undefined): boolean {
  return routeId === 'word-practice';
}
