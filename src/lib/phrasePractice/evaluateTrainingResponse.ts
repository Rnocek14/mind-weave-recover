/**
 * Phrase Practice evaluator routed to the ACTUAL visible prompt.
 *
 * A "Finish the phrase" task presents the first word and blanks. A patient
 * who says only the missing words is answering correctly. Requiring the
 * entire printed script would misclassify correct completions, particularly
 * two-word phrases such as "Thank you" → "you".
 *
 * Existing speech-ASR word similarity and the exact SAME practice threshold
 * apply to both utterance shapes; no new mastery threshold is introduced.
 * These outcomes are assisted practice, never independent communication.
 */
import { evaluatePhraseMatch, type PhraseTrial } from '@/data/phraseBank';
import type { PhraseTrainingStage } from '@/lib/phrasePractice/trainingStages';

/**
 * A Stage 3 response containing ONLY words printed as key-word clues is
 * prompt echo, not successful functional phrase creation. Do not discard a
 * genuine additional word/phrase, and ignore fillers such as "um" in that
 * comparison. The normal phrase evaluator still provides partial accuracy.
 */
export function isPhraseCueOnlyEcho(
  spoken: string,
  cueWords: readonly string[] | null | undefined,
): boolean {
  const tokenize = (text: string) => text.toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/).filter(Boolean);
  const cues = new Set((cueWords ?? []).flatMap(tokenize));
  const spokenTokens = tokenize(spoken).filter(word =>
    !/^(?:um+|uh+|hmm+|mm+|er+|ah+|eh+)$/.test(word),
  );
  return cues.size > 0 && spokenTokens.length > 0 &&
    spokenTokens.every(word => cues.has(word));
}

export function evaluatePhraseTrainingResponse(
  spoken: string,
  trial: PhraseTrial,
  stage: PhraseTrainingStage | null | undefined,
): ReturnType<typeof evaluatePhraseMatch> {
  const full = evaluatePhraseMatch(spoken, trial);
  // The clue words are visible. Repeating them alone is not equivalent to
  // producing an actual phrase, even when the old 60% practice matcher says
  // two of the three target tokens were present.
  if (stage?.mode === 'key_words' && isPhraseCueOnlyEcho(spoken, trial.cueWords)) {
    return { ...full, match: false };
  }
  if (!stage || stage.mode !== 'completion' || full.match) return full;

  const words = trial.phrase.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return full;

  // Match only the words hidden behind the blanks. Avoid mutating the bank
  // trial, which is shared by the next round and by the audit metadata.
  const hiddenPart = words.slice(1).join(' ');
  const completion = evaluatePhraseMatch(spoken, { ...trial, phrase: hiddenPart });
  return completion.match ? completion : full;
}
