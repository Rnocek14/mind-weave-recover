import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useGameSounds', () => ({
  useGameSounds: () => ({ playSuccess: vi.fn() }),
}));

import { useDescribeGuessGame } from './useDescribeGuessGame';

const guess = {
  guessed: true,
  confidence: 0.82,
  bestWord: null,
  bestSimilarity: 0.8,
  top3Avg: 0.8,
  featureCount: 2,
  rulesPassed: ['meaning', 'features'],
};

describe('useDescribeGuessGame original result provenance', () => {
  it('never fabricates speech transcription from a typed description', async () => {
    const onTrialComplete = vi.fn();
    const { result } = renderHook(() => useDescribeGuessGame({
      trialCount: 1, difficulty: 1, onTrialComplete,
    }));
    expect(result.current.currentTrial).toBeTruthy();

    let output: ReturnType<typeof result.current.finalizeTrial> | undefined = undefined;
    await act(async () => {
      output = result.current.finalizeTrial(
        'you put a drink in this and hold it',
        guess,
        false,
        false,
        'typed',
      );
      await Promise.resolve();
    });

    expect(output).toMatchObject({
      inputMode: 'typed',
      browserTranscript: null,
      meaningWin: true,
    });
    expect(onTrialComplete).toHaveBeenCalledWith(
      expect.objectContaining({ inputMode: 'typed', browserTranscript: null }),
    );
  });

  it('retains actual recognized speech provenance when the source is spoken', async () => {
    const { result } = renderHook(() => useDescribeGuessGame({
      trialCount: 1, difficulty: 1,
    }));
    let output: ReturnType<typeof result.current.finalizeTrial> | undefined = undefined;
    act(() => {
      output = result.current.finalizeTrial(
        'this is something to hold your drink',
        guess, false, false, 'spoken',
      );
    });
    expect(output).toMatchObject({
      inputMode: 'spoken',
      browserTranscript: 'this is something to hold your drink',
    });
  });

  it('defaults missing source tags to unknown, never independent spoken truth', () => {
    const { result } = renderHook(() => useDescribeGuessGame({
      trialCount: 1, difficulty: 1,
    }));
    let output: ReturnType<typeof result.current.finalizeTrial> | undefined = undefined;
    act(() => {
      output = result.current.finalizeTrial('you drink from it', guess, false);
    });
    expect(output).toMatchObject({
      inputMode: 'unknown',
      browserTranscript: null,
    });
  });
});
