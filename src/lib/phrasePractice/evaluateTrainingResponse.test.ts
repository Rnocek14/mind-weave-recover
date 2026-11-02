import { describe, expect, it } from 'vitest';
import { PHRASE_BANK, evaluatePhraseMatch } from '@/data/phraseBank';
import { evaluatePhraseTrainingResponse } from '@/lib/phrasePractice/evaluateTrainingResponse';
import { getPhraseTrainingStage } from '@/lib/phrasePractice/trainingStages';

const tier1 = PHRASE_BANK.filter(t => t.difficulty === 1 && t.phrase.trim().split(/\s+/).length >= 2);

describe('Phrase Practice completion speech evaluation via production matcher', () => {
  it('accepts the missing word of a two-word completion when full-phrase scoring would fail', () => {
    const twoWords = tier1.find(t => t.phrase.trim().split(/\s+/).length === 2);
    expect(twoWords).toBeDefined();
    const missing = twoWords!.phrase.trim().split(/\s+/).slice(1).join(' ');
    expect(evaluatePhraseMatch(missing, twoWords!).match).toBe(false);
    const response = evaluatePhraseTrainingResponse(missing, twoWords!, getPhraseTrainingStage(2));
    expect(response.match).toBe(true);
    expect(response.wordAccuracy).toBe(1);
  });

  it('credits missing words for every playable Stage 2 script', () => {
    expect(tier1.length).toBeGreaterThan(3);
    for (const trial of tier1) {
      const hidden = trial.phrase.trim().split(/\s+/).slice(1).join(' ');
      expect(evaluatePhraseTrainingResponse(hidden, trial, getPhraseTrainingStage(2)).match,
        `Rejected correct completion for ${trial.id}`).toBe(true);
    }
  });

  it('accepts a complete spoken script as an alternative, without requiring it', () => {
    for (const trial of tier1.slice(0, 10)) {
      const evaluation = evaluatePhraseTrainingResponse(trial.phrase, trial, getPhraseTrainingStage(2));
      expect(evaluation.match).toBe(true);
    }
  });

  it('rejects merely repeating the visible word in Stage 2', () => {
    for (const trial of tier1) {
      const visible = trial.phrase.trim().split(/\s+/)[0];
      expect(evaluatePhraseTrainingResponse(visible, trial, getPhraseTrainingStage(2)).match,
        `Incorrectly counted visible prompt alone for ${trial.id}`).toBe(false);
    }
  });

  it('keeps Stage 1 modeled practice and ordinary unstaged scoring aligned with the original evaluator', () => {
    const example = tier1[0];
    for (const stage of [getPhraseTrainingStage(1), null]) {
      for (const spoken of [example.phrase, 'unrelated zebra', example.phrase.split(' ')[0]]) {
        expect(evaluatePhraseTrainingResponse(spoken, example, stage))
          .toEqual(evaluatePhraseMatch(spoken, example));
      }
    }
  });
  it('rejects echoing only the displayed key words in Stage 3, even when the old matcher passed', () => {
    const target = PHRASE_BANK.find(t => t.id === 'more_water')!;
    expect(target).toBeDefined();
    expect(evaluatePhraseMatch('more water', target).match).toBe(true);
    const result = evaluatePhraseTrainingResponse('um more water', target, getPhraseTrainingStage(3));
    expect(result.match).toBe(false);
    expect(result.wordAccuracy).toBeGreaterThan(0); // useful participation evidence
  });

  it('still accepts the actual target or additional natural language beyond the shown clues', () => {
    const target = PHRASE_BANK.find(t => t.id === 'more_water')!;
    expect(evaluatePhraseTrainingResponse('More water please', target, getPhraseTrainingStage(3)).match).toBe(true);
    expect(evaluatePhraseTrainingResponse('Water please', target, getPhraseTrainingStage(3)).match).toBe(true);
  });

  it('never credits clue-only speech on any tier-2 Stage 3 bank phrase', () => {
    const stage = getPhraseTrainingStage(3)!;
    const trials = PHRASE_BANK.filter(t => t.difficulty === 2 && (t.cueWords?.length ?? 0) > 0);
    expect(trials.length).toBeGreaterThan(5);
    for (const target of trials) {
      const echo = target.cueWords!.join(' ');
      expect(evaluatePhraseTrainingResponse(echo, target, stage).match,
        `Credited cue-only echo for ${target.id}`).toBe(false);
    }
  });

});
