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

export function evaluatePhraseTrainingResponse(
  spoken: string,
  trial: PhraseTrial,
  stage: PhraseTrainingStage | null | undefined,
): ReturnType<typeof evaluatePhraseMatch> {
  const full = evaluatePhraseMatch(spoken, trial);
  if (!stage || stage.mode !== 'completion' || full.match) return full;

  const words = trial.phrase.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return full;

  // Match only the words hidden behind the blanks. Avoid mutating the bank
  // trial, which is shared by the next round and by the audit metadata.
  const hiddenPart = words.slice(1).join(' ');
  const completion = evaluatePhraseMatch(spoken, { ...trial, phrase: hiddenPart });
  return completion.match ? completion : full;
}
