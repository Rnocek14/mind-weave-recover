import { describe, expect, it } from 'vitest';
import { mergeMeasuredExerciseScores } from '../exerciseScoreEligibility';

describe('clinical per-exercise score eligibility', () => {
  it('does not convert no participation into 0% accuracy', () => {
    const existing = { photo_naming: 80 };
    expect(mergeMeasuredExerciseScores(existing, 'minimal_pairs', 0, 0))
      .toEqual({ photo_naming: 80 });
    expect(existing).toEqual({ photo_naming: 80 });
  });

  it('preserves earlier evidence when another exercise was skipped', () => {
    const existing = { minimal_pairs: 90, fix_sentence: 75 };
    expect(mergeMeasuredExerciseScores(existing, 'minimal_pairs', 0, 0))
      .toEqual(existing);
  });

  it('does include a genuine incorrect measured trial', () => {
    expect(mergeMeasuredExerciseScores({}, 'minimal_pairs', 0, 1))
      .toEqual({ minimal_pairs: 0 });
  });

  it('includes measured positive scores and leaves existing domains alone', () => {
    expect(mergeMeasuredExerciseScores({ photo_naming: 70 }, 'fix_sentence', 85, 3))
      .toEqual({ photo_naming: 70, fix_sentence: 85 });
  });

  it('does not persist an invalid numeric score', () => {
    expect(mergeMeasuredExerciseScores({}, 'minimal_pairs', Number.NaN, 2))
      .toEqual({});
  });
});
