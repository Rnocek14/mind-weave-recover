import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDescribeGuessGame } from '@/hooks/useDescribeGuessGame';
import type { DescribeGuessTrial } from '@/data/describeGuessBank';

vi.mock('@/hooks/useGameSounds', () => ({
  useGameSounds: () => ({ playSuccess: vi.fn() }),
}));

vi.mock('@/lib/semanticSimilarity', () => ({
  getSemanticSimilarity: vi.fn().mockResolvedValue(0.55),
}));

const fabricatedTrial: DescribeGuessTrial = {
  id: 'cue-integrity-test',
  target: 'lighthouse',
  photoBankId: 'unused',
  acceptedWords: [],
  wordAliases: {},
  featureKeywords: {
    function: ['flashing ships'],
    location: ['coastline'],
    appearance: ['tall beam'],
    material: ['brickwork'],
    category: ['navigation tower'],
  },
  difficulty: 1,
  category: 'objects',
};

describe('Describe & Guess supported versus independent description', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('seeing the strategy guide is not a cue: the hook starts with zero requested prompts', () => {
    const { result } = renderHook(() => useDescribeGuessGame({ trialCount: 1, difficulty: 1 }));
    expect(result.current.promptsShown).toEqual([]);
    expect(result.current.featureTypesUsed.size).toBe(0);
    expect(result.current.featureTypesSpoken.size).toBe(0);
  });

  it('asking Maya to read a question records the cue but does not award a spoken feature', () => {
    const { result } = renderHook(() => useDescribeGuessGame({ trialCount: 1, difficulty: 1 }));

    act(() => {
      result.current.recordFeatureChip('function', 'What do you use it for?');
      result.current.recordFeatureChip('appearance', 'What does it look like?');
      result.current.recordFeatureChip('function', 'What do you use it for?'); // same help repeated
    });

    expect(result.current.promptsShown).toEqual([
      'What do you use it for?',
      'What does it look like?',
    ]);
    expect(result.current.featureTypesUsed.size).toBe(0);
    expect(result.current.featureTypesSpoken.size).toBe(0);
  });

  it('two tapped cue buttons without trial-relevant speech cannot satisfy the 2-feature guess rule', async () => {
    const { result } = renderHook(() => useDescribeGuessGame({ trialCount: 1, difficulty: 1 }));
    act(() => {
      result.current.recordFeatureChip('function', 'What do you use it for?');
      result.current.recordFeatureChip('appearance', 'What does it look like?');
    });

    let guess: Awaited<ReturnType<typeof result.current.evaluateGuess>> | undefined;
    await act(async () => {
      guess = await result.current.evaluateGuess(
        'It is very tall and heavy with a smooth green surface.',
        fabricatedTrial,
      );
    });

    expect(guess?.featureCount).toBe(0);
    expect(guess?.rulesPassed).not.toContain('C');
    expect(guess?.guessed).toBe(false);
  });

  it('a feature spoken by the patient lights the guide without changing cue dependence', () => {
    const { result } = renderHook(() => useDescribeGuessGame({ trialCount: 1, difficulty: 1 }));
    const trial = result.current.currentTrial;
    expect(trial).toBeTruthy();

    // The hook's public current trial bank determines what counts as a feature.
    const keyword = trial?.featureKeywords.function?.[0];
    expect(keyword).toBeTruthy();

    act(() => {
      result.current.recordSpokenFeatures(`You can use it to ${keyword}.`);
    });
    expect(result.current.featureTypesSpoken.has('function')).toBe(true);
    expect(result.current.promptsShown).toEqual([]);
  });
});
