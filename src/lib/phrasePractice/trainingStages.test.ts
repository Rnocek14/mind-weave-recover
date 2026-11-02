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
    for (const level of [null, undefined, -1, 0, 9, NaN, 1.5]) {
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
      expect(trial.phrase.trim().split(/\s+/).length).toBeGreaterThanOrEqual(2);
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
  it('selects real harder scripts rather than repeating Stage 1–3 content', () => {
    const modes=([1,2,3,4,5,6,7,8] as const).map(level=>getPhraseTrainingStage(level)!);
    expect(modes.map(m=>m.engineLevel)).toEqual([1,1,3,5,7,7,9,9]);
    expect(modes.map(m=>m.mode)).toEqual([
      'modeled','completion','key_words','modeled','completion','key_words','scenario','repair',
    ]);
    for(const level of [4,5,6,7,8] as const){
      const stage=getPhraseTrainingStage(level)!;
      const trials=getPhraseTrialsForTraining(stage,5);
      expect(trials).toHaveLength(5);
      expect(trials.every(t=>t.difficulty===(level===4?3:level<=6?4:5))).toBe(true);
      for(const trial of trials){
        const prompt=getPhraseTrainingPrompt(trial,stage);
        expect(prompt.text).toBeTruthy();
        if(level>4) {
          expect(prompt.text).not.toBe(trial.phrase);
          expect(prompt.fullPhraseRevealed).toBe(false);
        }
        if(level>=7){
          expect(prompt.evidenceSupport).toBe(level===7?'situational_prompt':'repair_prompt');
          expect(prompt.text.toLowerCase()).not.toContain(trial.phrase.toLowerCase());
        }
        const rescue=getPhraseTrainingPrompt(trial,stage,true);
        expect(rescue.fullPhraseRevealed).toBe(true);
        expect(rescue.text).toBe(trial.phrase);
      }
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
