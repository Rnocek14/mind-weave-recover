import { describe, expect, it } from 'vitest';
import { formatDetectiveOptionsForSpeech } from './detectiveMindSpeech';

describe('Detective Mind spoken option labels', () => {
  it('announces all three options including the final C', () => {
    expect(formatDetectiveOptionsForSpeech(['Dogs', 'Cats', 'Birds']))
      .toBe('Option A: Dogs. Option B: Cats. Option C: Birds');
  });

  it('announces every option even when there are four', () => {
    expect(formatDetectiveOptionsForSpeech(['First', 'Second', 'Third', 'Fourth']))
      .toBe('Option A: First. Option B: Second. Option C: Third. Option D: Fourth');
  });

  it('uses the displayed/shuffled order, not the original case order', () => {
    expect(formatDetectiveOptionsForSpeech(['Correct', 'Distractor 2', 'Distractor 1']))
      .toBe('Option A: Correct. Option B: Distractor 2. Option C: Distractor 1');
  });

  it('handles an empty selection without inventing an answer', () => {
    expect(formatDetectiveOptionsForSpeech([])).toBe('');
  });
});
