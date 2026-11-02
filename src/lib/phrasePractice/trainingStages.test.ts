import { describe, expect, it } from 'vitest';
import { PHRASE_BANK } from '@/data/phraseBank';
import { getPhraseTrainingPrompt, getPhraseTrainingStage } from '@/lib/phrasePractice/trainingStages';

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
    for (const trial of PHRASE_BANK.filter(t => t.difficulty === 1)) {
      const prompt = getPhraseTrainingPrompt(trial, stage);
      expect(prompt.fullPhraseRevealed).toBe(false);
      expect(prompt.text).toContain('_____');
      expect(prompt.text).not.toBe(trial.phrase);
      expect(prompt.evidenceSupport).toBe('partial_script');
    }
  });

  it('offers a meaningful clue or accessible full-script rescue for stage three', () => {
    const stage = getPhraseTrainingStage(3);
    for (const trial of PHRASE_BANK.filter(t => t.difficulty === 2)) {
      const prompt = getPhraseTrainingPrompt(trial, stage);
      expect(prompt.text.trim().length).toBeGreaterThan(0);
      expect(prompt.evidenceSupport === 'word_clues' || prompt.fullPhraseRevealed).toBe(true);
      const rescue = getPhraseTrainingPrompt(trial, stage, true);
      expect(rescue.text).toBe(trial.phrase);
      expect(rescue.fullPhraseRevealed).toBe(true);
      expect(rescue.evidenceSupport).toBe('visible_script');
    }
  });
});
