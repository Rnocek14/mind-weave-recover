import { describe, expect, it } from 'vitest';
import {
  TWO_CLUES_HELD_FOR_REVIEW,
  getPuzzles,
  type TwoCluesPuzzle,
} from '@/data/twoCluesBank';
import {
  TWO_CLUES_SCORING_DEBOUNCE_MS,
  interpretTwoCluesSpeech,
} from '@/lib/twoCluesResponse';
import { scoreAnswer } from '@/lib/twoCluesScorer';
import { twoCluesBankDifficultyForClinicalLevel } from '@/lib/progression/twoCluesDifficultyBridge';

// A fixture for the real reported "holds" + "water" ambiguity. The item is
// excluded from new sessions pending content review, but previously presented
// trials still require correct interpretation.
const waterPuzzle: TwoCluesPuzzle = {
  id: 'tc-mid-12',
  clues: ['holds', 'water'],
  category: 'home',
  difficulty: 2,
  anchors: ['bucket', 'cup', 'glass'],
  anchorAliases: { bucket: ['buckets'], glass: ['glasses'] },
  cluster: ['container', 'pail', 'jug', 'pot', 'tank', 'bottle'],
  nearMisses: ['sponge', 'cloth', 'bag'],
  coachHints: {},
};

describe('Two Clues: wait for the patient to finish', () => {
  it('does not turn repetition of the clues into a candidate answer', () => {
    for (const phrase of [
      'holds water',
      'holds ... and water',
      'um holds and water',
      'golds and water', // observed speech-recognition confusion
      'what holds water',
      "I don't know",
    ]) {
      const result = interpretTwoCluesSpeech(phrase, waterPuzzle);
      expect(result.thinkingAloud, phrase).toBe(true);
      expect(result.candidate, phrase).toBe('');
    }
  });

  it('extracts the actual answer after clue rehearsal across segments', async () => {
    const result = interpretTwoCluesSpeech('holds and water ... um I think a cup', waterPuzzle);
    expect(result.thinkingAloud).toBe(false);
    expect(result.candidate).toBe('cup');
    expect((await scoreAnswer(result.candidate, waterPuzzle)).tier).toBe('strong');
  });

  it('recognizes bottle as a valid related answer instead of declaring it wrong', async () => {
    const result = interpretTwoCluesSpeech('golds ... water ... bottle', waterPuzzle);
    expect(result.candidate).toBe('bottle');
    expect((await scoreAnswer(result.candidate, waterPuzzle)).tier).toBe('related');
  });

  it('uses the last self-corrected response instead of an abandoned earlier guess', async () => {
    const result = interpretTwoCluesSpeech('holds water, bottle, no, cup', waterPuzzle);
    expect(result.candidate).toBe('cup');
    expect((await scoreAnswer(result.candidate, waterPuzzle)).tier).toBe('strong');
  });

  it('can accept an explicit answer that overlaps a clue word', () => {
    const overlapping: TwoCluesPuzzle = {
      ...waterPuzzle,
      anchors: ['water'],
      cluster: ['cup'],
    };
    expect(interpretTwoCluesSpeech('water', overlapping).thinkingAloud).toBe(true);
    expect(interpretTwoCluesSpeech("I think it's water", overlapping).candidate).toBe('water');
  });

  it('uses a generous silence window rather than the old 1.5s', () => {
    expect(TWO_CLUES_SCORING_DEBOUNCE_MS).toBeGreaterThanOrEqual(4000);
  });
});

describe('Two Clues: content-quality quarantine', () => {
  it('removes ambiguous water/secret items from new puzzle selection until review', () => {
    const heldIds = ['tc-mid-12', 'tc-hard-t3-1', 'tc-exp-10'];
    const allItems = getPuzzles();
    for (const id of heldIds) {
      expect(TWO_CLUES_HELD_FOR_REVIEW.has(id)).toBe(true);
      expect(allItems.some((puzzle) => puzzle.id === id)).toBe(false);
    }
    expect(getPuzzles({ difficulty: 1 }).length).toBeGreaterThan(0);
    expect(getPuzzles({ difficulty: 2 }).length).toBeGreaterThan(0);
    expect(getPuzzles({ difficulty: 3 }).length).toBeGreaterThan(0);
  });
});

describe('Two Clues: clinical content tier is respected by the bank', () => {
  it.each([
    [1, 1], [2, 1], [3, 2], [4, 2], [5, 3], [6, 3], [7, 3], [8, 3],
  ])('clinical level %i selects bank difficulty %i', (level, bank) => {
    expect(twoCluesBankDifficultyForClinicalLevel(level)).toBe(bank);
    const puzzles = getPuzzles({ difficulty: twoCluesBankDifficultyForClinicalLevel(level) });
    expect(puzzles.length).toBeGreaterThan(0);
    expect(puzzles.every((puzzle) => puzzle.difficulty === bank)).toBe(true);
  });

  it('defaults to easier material when no verified clinical level exists', () => {
    expect(twoCluesBankDifficultyForClinicalLevel(null)).toBe(1);
    expect(twoCluesBankDifficultyForClinicalLevel(Number.NaN)).toBe(1);
  });
});
