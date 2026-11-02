import { describe, expect, it } from 'vitest';
import { buildPatternChoices, type PatternItem } from '@/lib/patternMatch/buildPatternChoices';

const sample: PatternItem[] = [
  { shape: 'circle', color: 'red' },
  { shape: 'circle', color: 'red' },
];
const serialize = (board: PatternItem[]) => JSON.stringify(board);

describe('Pattern Match selectable boards', () => {
  for (const constant of [0, 0.5, 0.999999]) {
    it(`always terminates with unique options and exactly one answer at random=${constant}`, () => {
      const { options, correctIndex } = buildPatternChoices(sample, 4, () => constant);
      expect(options).toHaveLength(4);
      expect(new Set(options.map(serialize)).size).toBe(4);
      expect(options.filter((board) => serialize(board) === serialize(sample))).toHaveLength(1);
      expect(serialize(options[correctIndex])).toBe(serialize(sample));
    });
  }

  it('does not change original pattern or share its item objects', () => {
    const before = serialize(sample);
    const { options } = buildPatternChoices(sample, 3, () => 0);
    expect(serialize(sample)).toBe(before);
    expect(options.every((board) => board.every((item, i) => item !== sample[i]))).toBe(true);
  });

  it('returns a non-playable result for an empty pattern', () => {
    expect(buildPatternChoices([], 4)).toEqual({ options: [], correctIndex: -1 });
  });

  it('honors a two-choice easier round', () => {
    expect(buildPatternChoices(sample, 2, () => 0.5).options).toHaveLength(2);
  });
});
