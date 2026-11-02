import { describe, expect, it } from 'vitest';
import { PHRASE_BANK } from '@/data/phraseBank';
import { getPhraseTrainingPrompt, getPhraseTrainingStage, getPhraseTrialsForTraining, resolvePhrasePracticeStage } from '@/lib/phrasePractice/trainingStages';

describe('Phrase Practice executable script training modes', () => {
  it('selects two genuinely different bank bands, not just new labels', () => {
    const one = getPhraseTrainingStage(1)!;
    const two = getPhraseTrainingStage(2)!;
    const three = getPhraseTrainingStage(3)!;
    expect([one.engineLevel, two.engineLevel, three.engineLevel]).toEqual([1, 1, 3]);
    expect([one.mode, two.mode, three.mode]).toEqual(['modeled', 'completion', 'key_words']);
    expect([one.autoModel, two.autoModel, three.autoModel]).toEqual([true, false, false]);
  });

  it('does not invent unsupported saved clinical stages', () => {
    for (const level of [null, undefined, -1, 0, 4, 8, NaN, 1.5]) {
      expect(getPhraseTrainingStage(level)).toBeNull();
    }
  });

  it('always shows the full modeled script in stage one', () => {
    for (const trial of PHRASE_BANK.filter(t => t.difficulty === 1).slice(0, 5)) {
      expect(getPhraseTrainingPrompt(trial, getPhraseTrainingStage(1)).text).toBe(trial.phrase);
    }
  });

  it('does not leak hidden full phrases in completion mode, even for two-word scripts', () => {
    const stage = getPhraseTrainingStage(2);
    const playable = getPhraseTrialsForTraining(stage!, 20);
    expect(playable).toHaveLength(20);
    for (const trial of playable) {
      expect(trial.difficulty).toBe(1);
      expect(trial.phrase.trim().split(/\\s+/).length).toBeGreaterThanOrEqual(2);
      const prompt = getPhraseTrainingPrompt(trial, stage);
      expect(prompt.fullPhraseRevealed).toBe(false);
      expect(prompt.text).toContain('_____');
      expect(prompt.text).not.toBe(trial.phrase);
      expect(prompt.evidenceSupport).toBe('partial_script');
    }
    // A one-word item remains valid for modeled repetition, but could not
    // produce a phrase completion prompt without inventing target words.
    const oneWord = PHRASE_BANK.find(t => t.id === 'hello')!;
    expect(getPhraseTrainingPrompt(oneWord, stage).fullPhraseRevealed).toBe(true);
  });

  it('offers a meaningful clue or accessible full-script rescue for stage three', () => {
    const stage = getPhraseTrainingStage(3);
    const playable = getPhraseTrialsForTraining(stage!, 12);
    expect(playable).toHaveLength(12);
    for (const trial of playable) {
      expect(trial.difficulty).toBe(2);
      const prompt = getPhraseTrainingPrompt(trial, stage);
      expect(prompt.text.trim().length).toBeGreaterThan(0);
      expect(prompt.evidenceSupport).toBe('word_clues');
      expect(prompt.fullPhraseRevealed).toBe(false);
      expect(prompt.text).not.toBe(trial.phrase);
      const rescue = getPhraseTrainingPrompt(trial, stage, true);
      expect(rescue.text).toBe(trial.phrase);
      expect(rescue.fullPhraseRevealed).toBe(true);
      expect(rescue.evidenceSupport).toBe('visible_script');
    }
  });
  it('allows a session-only caregiver choice without modifying a saved stage', () => {
    const saved = getPhraseTrainingStage(1)!;
    const overridden = resolvePhrasePracticeStage(saved, 3);
    expect(overridden).toMatchObject({ level: 3, engineLevel: 3, mode: 'key_words' });
    expect(saved.level).toBe(1);
    expect(resolvePhrasePracticeStage(saved, null)).toBe(saved);
  });

});
