/**
 * Sentence Construction: clinical grammar progression, not merely a higher
 * arbitrary 1–10 engine difficulty. The existing bank's real content is:
 * 1 SVO; 2 expanded SVO/articles/prepositions; 3 agreement;
 * 4–5 word order + tense; 6 coordinating; 7 subordinating;
 * 8 relative clauses; 9–10 multi-clause, conditional and passive.
 *
 * We never silently substitute an unrelated grammar band.
 */
import { SENTENCE_TRIALS, type SentenceTrial } from '@/data/sentenceBank';
import { shuffleArray } from '@/lib/shuffle';

export const SENTENCE_CLINICAL_DIFFICULTIES: Record<number, readonly number[]> = {
  1: [1], 2: [2], 3: [3], 4: [4, 5],
  5: [6], 6: [7], 7: [8], 8: [9, 10],
};

export function sentenceClinicalPool(level: number): SentenceTrial[] {
  const safe = Math.max(1, Math.min(8, Math.round(level || 1)));
  const allowed = SENTENCE_CLINICAL_DIFFICULTIES[safe];
  return SENTENCE_TRIALS.filter(trial => allowed.includes(trial.difficulty));
}

/** In-game adaptation selects within the current grammar band, never leaps
 * to a different clinical syntax rung without persisted promotion. */
export function getClinicalSentenceTrials(
  clinicalLevel: number,
  count: number,
  engineDifficulty?: number,
): SentenceTrial[] {
  const pool = sentenceClinicalPool(clinicalLevel);
  const allowed = SENTENCE_CLINICAL_DIFFICULTIES[Math.max(1, Math.min(8, Math.round(clinicalLevel || 1)))];
  const preferred = engineDifficulty == null
    ? pool
    : pool.filter(trial => trial.difficulty === allowed.reduce(
        (best, d) => Math.abs(d - engineDifficulty) < Math.abs(best - engineDifficulty) ? d : best,
        allowed[0],
      ));
  // Allow the other difficulty within the same *clinical* level if the
  // preferred subset is too short, but never borrow from another level.
  const remaining = pool.filter(trial => !preferred.includes(trial));
  return [...shuffleArray(preferred), ...shuffleArray(remaining)].slice(0, count);
}
