import { describe, expect, it } from 'vitest';
import { getDescribeGuessTrainingStage, getDescribeGuessStageTrials } from '@/lib/describeGuess/trainingStages';

describe('Describe & Guess executable training stages', () => {
  it('changes actual starting support and photo complexity by stage', () => {
    const modes = [1, 2, 3].map(l => getDescribeGuessTrainingStage(l)!);
    expect(modes.map(m => m.itemTier)).toEqual([1, 1, 2]);
    expect(modes.map(m => m.initialVisiblePrompts)).toEqual([3, 0, 0]);
    expect(modes.every(m => !!m.label)).toBe(true);
  });

  it('does not falsely activate unimplemented clinical levels', () => {
    for (const n of [-1, 0, 4, 8, 2.5, NaN, null, undefined]) {
      expect(getDescribeGuessTrainingStage(n)).toBeNull();
    }
  });

  it.each([1, 2, 3])('selects photographed items in the stage %s complexity tier', level => {
    const stage = getDescribeGuessTrainingStage(level)!;
    const trials = getDescribeGuessStageTrials(stage, 6);
    expect(trials.length).toBe(6);
    expect(trials.every(t => t.difficulty === stage.itemTier)).toBe(true);
    expect(new Set(trials.map(t => t.id)).size).toBe(trials.length);
  });

  it('never pads a stage from an easier/adjacent photo tier', () => {
    const stage = getDescribeGuessTrainingStage(3)!;
    const chosen = getDescribeGuessStageTrials(stage, 80);
    expect(chosen.every(t => t.difficulty === 2)).toBe(true);
  });
});
