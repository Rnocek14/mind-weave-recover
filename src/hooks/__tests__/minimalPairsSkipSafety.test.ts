/** Unanswered sound pairs are not measured clinical mistakes. */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useMinimalPairsGame } from '@/hooks/useMinimalPairsGame';

afterEach(() => cleanup());

describe('Minimal Pairs unanswered skip integrity', () => {
  it('advances to the next pair without adding a scored response', () => {
    const { result } = renderHook(() =>
      useMinimalPairsGame({ totalTrials: 3, difficultyLevel: 1 })
    );
    expect(result.current.state.currentTrial).not.toBeNull();
    const before = result.current.state.trialIndex;
    act(() => result.current.skipTrial());
    const state = result.current.state;
    expect(state.trialIndex).toBe(before + 1);
    expect(state.skippedCount).toBe(1);
    expect(state.score).toBe(0);
    expect(state.correctCount).toBe(0);
    expect(state.incorrectCount).toBe(0);
    expect(state.selectedIndex).toBeNull();
    expect(state.isCorrect).toBeNull();
    expect(state.showFeedback).toBe(false);
  });

  it('finishing entirely by skipping never invents incorrect responses', () => {
    const { result } = renderHook(() =>
      useMinimalPairsGame({ totalTrials: 3, difficultyLevel: 1 })
    );
    const count = result.current.state.totalTrials;
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      act(() => result.current.skipTrial());
    }
    expect(result.current.state.isComplete).toBe(true);
    expect(result.current.state.skippedCount).toBe(count);
    expect(result.current.state.correctCount).toBe(0);
    expect(result.current.state.incorrectCount).toBe(0);
    expect(result.current.state.score).toBe(0);
  });

  it('the next genuinely answered pair is the first measured response', () => {
    const { result } = renderHook(() =>
      useMinimalPairsGame({ totalTrials: 3, difficultyLevel: 1 })
    );
    act(() => result.current.skipTrial());
    const target = result.current.state.currentTrial!.targetIndex;
    act(() => result.current.selectAnswer(target));
    expect(result.current.state.correctCount).toBe(1);
    expect(result.current.state.incorrectCount).toBe(0);
    expect(result.current.state.skippedCount).toBe(1);
    expect(result.current.state.showFeedback).toBe(true);
    const atFeedback = result.current.state.trialIndex;
    act(() => result.current.skipTrial());
    expect(result.current.state.trialIndex).toBe(atFeedback);
    expect(result.current.state.skippedCount).toBe(1);
  });

  it('reset clears the skip count and all measured data', () => {
    const { result } = renderHook(() =>
      useMinimalPairsGame({ totalTrials: 3, difficultyLevel: 1 })
    );
    act(() => result.current.skipTrial());
    expect(result.current.state.skippedCount).toBe(1);
    act(() => result.current.reset());
    expect(result.current.state.skippedCount).toBe(0);
    expect(result.current.state.trialIndex).toBe(0);
    expect(result.current.state.isComplete).toBe(false);
  });
});
