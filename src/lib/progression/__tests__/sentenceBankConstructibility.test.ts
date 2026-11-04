/**
 * Audits the real 1–10 sentence bank, not a hand-copied fixture.
 * Patients must be able to build EVERY displayed answer with the actual
 * tiles supplied, including duplicated articles/pronouns at harder levels.
 */
import { describe, expect, it } from 'vitest';
import { SENTENCE_TRIALS, getTrialsForDifficulty } from '@/data/sentenceBank';
import { sentenceClinicalPool, SENTENCE_CLINICAL_DIFFICULTIES } from '@/lib/progression/sentenceConstructionContentSelector';

function word(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9']/g, '');
}

function counts(words: readonly string[]): Map<string, number> {
  const tally = new Map<string, number>();
  for (const item of words.map(word)) tally.set(item, (tally.get(item) ?? 0) + 1);
  return tally;
}

describe('Sentence Construction — real clinical bank integrity', () => {
  it('provides stable unique stimulus IDs and supported difficulty ranges', () => {
    expect(SENTENCE_TRIALS.length).toBeGreaterThan(100);
    expect(new Set(SENTENCE_TRIALS.map(trial => trial.id)).size).toBe(SENTENCE_TRIALS.length);
    for (const trial of SENTENCE_TRIALS) {
      expect(Number.isInteger(trial.difficulty), trial.id).toBe(true);
      expect(trial.difficulty, trial.id).toBeGreaterThanOrEqual(1);
      expect(trial.difficulty, trial.id).toBeLessThanOrEqual(10);
      expect(trial.grammarFocus.trim().length, trial.id).toBeGreaterThan(0);
      expect(trial.modelAudio?.trim(), trial.id).toBe(trial.targetSentence.trim());
    }
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
    'every difficulty-%i target is constructible from its real tile multiset',
    (difficulty) => {
      const trials = getTrialsForDifficulty(difficulty);
      expect(trials.length).toBeGreaterThanOrEqual(8);
      const issues: string[] = [];
      for (const trial of trials) {
        const expected = trial.targetSentence.split(/\s+/).map(word);
        const answer = trial.correctAnswer.map(word);
        if (JSON.stringify(expected) !== JSON.stringify(answer)) {
          issues.push(`${trial.id}: targetSentence differs from correctAnswer`);
        }
        const tiles = counts(trial.options);
        const selected = counts(trial.correctAnswer);
        const distractors = counts(trial.distractors);
        for (const [token, required] of selected) {
          if ((tiles.get(token) ?? 0) < required) {
            issues.push(`${trial.id}: ${JSON.stringify(token)} requires ${required} tiles but has ${tiles.get(token) ?? 0}`);
          }
        }
        for (const [token, required] of distractors) {
          if ((tiles.get(token) ?? 0) - (selected.get(token) ?? 0) < required) {
            issues.push(`${trial.id}: declared distractor ${JSON.stringify(token)} is not an extra tile`);
          }
        }
      }
      expect(issues).toEqual([]);
    },
  );

  it('keeps real upper-level grammar cohorts separate, including passive and conditional forms', () => {
    expect(SENTENCE_CLINICAL_DIFFICULTIES[6]).toEqual([7]);
    expect(SENTENCE_CLINICAL_DIFFICULTIES[7]).toEqual([8]);
    expect(SENTENCE_CLINICAL_DIFFICULTIES[8]).toEqual([9, 10]);
    const subordinate = sentenceClinicalPool(6);
    const relatives = sentenceClinicalPool(7);
    const advanced = sentenceClinicalPool(8);
    expect(subordinate.some(t => /subordinat/i.test(t.grammarFocus))).toBe(true);
    expect(relatives.some(t => /relative/i.test(t.grammarFocus))).toBe(true);
    expect(advanced.some(t => t.grammarFocus === 'passive_voice')).toBe(true);
    expect(advanced.some(t => t.grammarFocus === 'conditionals')).toBe(true);
    for (const [level, pool] of [[6, subordinate], [7, relatives], [8, advanced]] as const) {
      expect(pool.length, `clinical L${level}`).toBeGreaterThanOrEqual(8);
    }
  });
});
