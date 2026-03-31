import { normalizeASROutput } from '@/lib/speechNormalizer';

const LOW_SIGNAL_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'go', 'goes',
  'have', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'our', 'so',
  'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those',
  'to', 'up', 'use', 'walk', 'we', 'with', 'you', 'your'
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function getPhraseScore(words: string[]): number {
  const meaningfulCount = words.filter((word) => !LOW_SIGNAL_WORDS.has(word) && word.length > 2).length;
  const totalLength = words.reduce((sum, word) => sum + word.length, 0);
  const endsWithMeaningfulWord = meaningfulCount > 0 && !LOW_SIGNAL_WORDS.has(words[words.length - 1]);

  return meaningfulCount * 5 + totalLength * 0.08 + (endsWithMeaningfulWord ? 0.5 : 0);
}

export function getSemanticAnalysisText(transcript: string): string {
  return normalizeASROutput(transcript)
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Select the most semantically useful 2-4 word phrases instead of the first few n-grams.
 * This helps long descriptions because the best clue often appears later in the sentence.
 */
export function extractCandidatePhrases(text: string, maxPhrases = 5): string[] {
  const words = tokenize(text);
  const seen = new Set<string>();
  const phrases: Array<{ phrase: string; score: number }> = [];

  for (let size = 2; size <= 4; size++) {
    for (let index = 0; index <= words.length - size; index++) {
      const slice = words.slice(index, index + size);
      const phrase = slice.join(' ');
      if (seen.has(phrase)) continue;

      const score = getPhraseScore(slice);
      if (score <= 0.5) continue;

      seen.add(phrase);
      phrases.push({ phrase, score });
    }
  }

  return phrases
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPhrases)
    .map(({ phrase }) => phrase);
}