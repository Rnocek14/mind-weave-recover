import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  updateTrial: vi.fn(), checkAndAdjust: vi.fn(), recordTrial: vi.fn(),
}));
vi.mock('@/hooks/useAdaptiveDifficulty', () => ({
  useAdaptiveDifficulty: () => ({
    currentDifficulty: 3, updateTrial: mocks.updateTrial, checkAndAdjust: mocks.checkAndAdjust,
  }),
}));
vi.mock('@/hooks/useEngagementMonitor', () => ({
  useEngagementMonitor: () => ({
    getState: () => ({ signals: { cueDependency: 0 } }),
    recordTrial: mocks.recordTrial,
  }),
}));
vi.mock('@/hooks/useGameSounds', () => ({
  useGameSounds: () => ({
    playSuccess: vi.fn(), playError: vi.fn(), playLevelUp: vi.fn(),
    playLevelDown: vi.fn(), playTimeout: vi.fn(), playStreak: vi.fn(),
  }),
}));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

import { PatternMatchGame } from '../PatternMatchGame';

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('PatternMatchGame — actual stage selection and result provenance', () => {
  it('stage 1 shows a simultaneous one-item visual choice and does not run adaptive promotion', () => {
    const onTrial = vi.fn(), complete = vi.fn();
    render(<PatternMatchGame totalTrials={1} initialDifficulty={3} practiceLevel={1}
      onTrialComplete={onTrial} onGameComplete={complete} />);
    expect(screen.getByText(/Practice 1\/8/)).toBeTruthy();
    const choices = screen.getAllByRole('button', { name: /Pattern choice/ });
    expect(choices).toHaveLength(2);
    fireEvent.click(choices[0]);
    expect(onTrial).toHaveBeenCalledWith(expect.objectContaining({
      practiceStage: 1, matchRule: 'exact', patternSize: 1, supportShown: true,
    }));
    expect(mocks.updateTrial).not.toHaveBeenCalled();
    expect(mocks.checkAndAdjust).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1501));
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('stage 7 alternates real shape-only and color-only matching per trial', () => {
    const onTrial=vi.fn(),complete=vi.fn();
    render(<PatternMatchGame totalTrials={2} initialDifficulty={3} practiceLevel={7}
      onTrialComplete={onTrial} onGameComplete={complete} />);
    act(() => vi.advanceTimersByTime(6500));
    expect(screen.getByText(/Match the SHAPES/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', {name:/Pattern choice/})[0]);
    expect(onTrial).toHaveBeenLastCalledWith(expect.objectContaining({
      practiceStage:7,matchRule:'shape',patternSize:4,supportShown:false,
    }));
    act(() => vi.advanceTimersByTime(1500));
    act(() => vi.advanceTimersByTime(6500));
    expect(screen.getByText(/Match the COLORS/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button',{name:/Pattern choice/})[0]);
    expect(onTrial).toHaveBeenCalledTimes(2);
    expect(onTrial).toHaveBeenLastCalledWith(expect.objectContaining({
      practiceStage:7,matchRule:'color',patternSize:4,supportShown:false,
    }));
    expect(mocks.updateTrial).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1500));
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
