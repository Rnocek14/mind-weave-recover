/**
 * Two Clues patient-speech interpretation.
 *
 * A person with aphasia may repeat the clues, pause, restart, and then give
 * the answer. Such rehearsal is not an incorrect response, and recognition
 * segments must not be graded before the person has finished.
 */
import type { TwoCluesPuzzle } from '@/data/twoCluesBank';
import { extractAnswerFromTranscript, removeClueWords } from '@/lib/speechNormalizer';

// Product pacing default, not a validated clinical response-time threshold.
export const TWO_CLUES_SCORING_DEBOUNCE_MS = 4500;

type ClueFields = Pick<
  TwoCluesPuzzle,
  'clues' | 'anchors' | 'anchorAliases' | 'cluster' | 'clusterAliases'
>;

export interface TwoCluesSpeechInterpretation {
  filteredTranscript: string;
  candidate: string;
  thinkingAloud: boolean;
}

const REHEARSAL_WORDS = new Set([
  'a', 'an', 'and', 'or', 'the', 'it', "it's", 'is', 'was', 'that', "that's",
  'these', 'those', 'i', 'im', "i'm", 'well', 'so', 'hmm', 'um', 'uh', 'umm',
  'okay', 'ok', 'maybe', 'think', 'thinking', 'let', 'me', 'see', 'what',
  'could', 'would', 'be', 'then', 'again', 'repeat', 'wait', 'no', 'nope',
]);

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter(Boolean);
}

function noAnswerPhrase(words: string[]): boolean {
  return /^(?:(?:i|we) )?(?:don't know|dont know|do not know|not sure|can't remember|cant remember)$/
    .test(words.join(' '));
}

/**
 * Extract the last explicit accepted word/phrase when a patient rehearses
 * the clues first (e.g. "holds and water ... a cup"). If there is no
 * supported answer yet, keep listening without treating the rehearsal as
 * incorrect. An unfamiliar transcript is a candidate for manual confirmation,
 * not automatic negative scoring.
 */
export function interpretTwoCluesSpeech(
  raw: string,
  puzzle: ClueFields,
): TwoCluesSpeechInterpretation {
  const spokenTokens = tokens(raw);
  const clueTokens = new Set(puzzle.clues.flatMap(tokens));
  const clueRehearsal =
    spokenTokens.length > 0 &&
    spokenTokens.every((word) => clueTokens.has(word) || REHEARSAL_WORDS.has(word));

  const preservedAnswers = [
    ...puzzle.anchors,
    ...Object.values(puzzle.anchorAliases ?? {}).flat(),
    ...puzzle.cluster,
    ...Object.values(puzzle.clusterAliases ?? {}).flat(),
  ];
  const filteredTranscript = removeClueWords(raw, puzzle.clues, preservedAnswers);
  const remainingTokens = tokens(filteredTranscript);
  const meaningfulTokens = remainingTokens.filter((word) => !REHEARSAL_WORDS.has(word));

  if (
    !spokenTokens.length ||
    clueRehearsal ||
    meaningfulTokens.length === 0 ||
    noAnswerPhrase(remainingTokens)
  ) {
    return { filteredTranscript, candidate: '', thinkingAloud: true };
  }

  const meaningfulTail = ' ' + meaningfulTokens.join(' ');
  const knownAnswers = [...new Set(preservedAnswers.map((word) => tokens(word).join(' ')))]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  // A phrase at the END is a candidate answer. Do not match a word just
  // mentioned mid-rehearsal ("not a cup, maybe ...") as a final answer.
  const lastKnownAnswer = knownAnswers.find((word) => meaningfulTail.endsWith(' ' + word));
  const candidate = lastKnownAnswer ?? extractAnswerFromTranscript(filteredTranscript);

  return { filteredTranscript, candidate, thinkingAloud: false };
}
