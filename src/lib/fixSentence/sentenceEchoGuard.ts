/**
 * Did they answer, or did they read the sentence back?
 *
 * Fix the Sentence shows a sentence with one wrong word and asks for a better
 * one. Now that the microphone is open beside the choice tiles, it hears
 * everything — including the very natural habit of re-reading the sentence
 * aloud while hunting for the odd word, and Maya's own "Hear it again" audio.
 *
 * Those are not answers, and scoring them as wrong ones takes an attempt away
 * from someone who never offered anything.
 *
 * THE RULE, which is specific to this task: the answer REPLACES a word, so an
 * utterance built entirely of words already in the sentence cannot be one.
 *
 * Two exemptions, both learned the hard way:
 *
 *   - anything containing an accepted fix is an answer, because a handful of
 *     trials legitimately reuse a word from their own sentence;
 *   - the bare WRONG WORD is an answer. They found the odd word and repeated
 *     it instead of replacing it, which deserves a verdict rather than
 *     silence. It is by definition a sentence word and never an accepted fix,
 *     so it would otherwise be swallowed whole.
 *
 * Fillers are stripped FIRST, with the same normalizer the layers below use.
 * Testing the raw transcript meant a single "um" defeated the whole guard —
 * "um I wore a" fell through to the echo filter, whose own stopword list then
 * ate um/i/a/on/my and left too few tokens to clear its thresholds, so it was
 * scored as a wrong attempt while the identical fragment without the "um" was
 * dropped correctly. A leading "um" is the norm for the people this app is
 * for, so that asymmetry pointed the wrong way as hard as it could.
 */
import { normalizeASROutput } from '@/lib/speechNormalizer';

export interface SentenceEchoInput {
  sentence?: string | null;
  wrongWord?: string | null;
  acceptedFixes?: string[] | null;
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();

export function isSentenceEcho(transcript: string, trial: SentenceEchoInput): boolean {
  if (!transcript || !trial?.sentence) return false;

  const sentenceWords = new Set(norm(trial.sentence).split(' ').filter(Boolean));
  const said = norm(normalizeASROutput(transcript)).split(' ').filter(Boolean);
  if (said.length === 0) return false;

  const fixes = new Set((trial.acceptedFixes ?? []).map((f) => norm(f)));
  if (said.some((w) => fixes.has(w))) return false;

  const wrongWord = norm(trial.wrongWord ?? '');
  if (wrongWord && said.every((w) => w === wrongWord)) return false;

  return said.every((w) => sentenceWords.has(w));
}
