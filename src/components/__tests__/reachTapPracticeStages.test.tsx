import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  updateTrial: vi.fn(), checkAndAdjust: vi.fn(), recordTrial: vi.fn(),
}));
vi.mock('@/hooks/useAdaptiveDifficulty', () => ({
  useAdaptiveDifficulty: () => ({
    currentDifficulty: 6, updateTrial: mocks.updateTrial, checkAndAdjust: mocks.checkAndAdjust,
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
    playSuccess: vi.fn(), playTimeout: vi.fn(), playLevelUp: vi.fn(),
    playLevelDown: vi.fn(), playStreak: vi.fn(),
  }),
}));

import { ReachTapGame } from '../ReachTapGame';

const originalBounds = HTMLElement.prototype.getBoundingClientRect;
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers();
  HTMLElement.prototype.getBoundingClientRect = () => ({
    x: 0, y: 0, left: 0, top: 0, right: 420, bottom: 320,
    width: 420, height: 320, toJSON: () => ({}),
  });
});
afterEach(() => {
  cleanup(); vi.useRealTimers(); HTMLElement.prototype.getBoundingClientRect=originalBounds;
});

describe('ReachTapGame — actual staged motor/left-search gameplay', () => {
  it('alternates the target side at stage 5 and never auto-escalates motor stage', () => {
    const trial=vi.fn(),complete=vi.fn();
    render(<ReachTapGame totalTrials={2} initialDifficulty={5} practiceLevel={5}
      onTrialComplete={trial} onGameComplete={complete} />);
    act(() => vi.advanceTimersByTime(550));
    expect(screen.getByText(/Practice stage 5\/8/)).toBeTruthy();
    const first=screen.getByRole('button',{name:'Tap the target'});
    fireEvent.click(first);
    expect(trial).toHaveBeenLastCalledWith(expect.objectContaining({
      practiceStage:5,targetSide:'left',visualGuidePresented:false,
    }));
    act(() => vi.advanceTimersByTime(1900));
    const second=screen.getByRole('button',{name:'Tap the target'});
    fireEvent.click(second);
    expect(trial).toHaveBeenLastCalledWith(expect.objectContaining({
      practiceStage:5,targetSide:'right',visualGuidePresented:false,
    }));
    act(() => vi.advanceTimersByTime(900));
    expect(complete).toHaveBeenCalledTimes(1);
    expect(mocks.updateTrial).not.toHaveBeenCalled();
    expect(mocks.checkAndAdjust).not.toHaveBeenCalled();
  });

  it('adds genuine search distractors only at the configured high left-hunt stages',()=>{
    const trial=vi.fn();
    render(<ReachTapGame totalTrials={1} initialDifficulty={2} practiceLevel={8}
      variant="left-side-hunt" onTrialComplete={trial} onGameComplete={vi.fn()} />);
    act(() => vi.advanceTimersByTime(550));
    expect(screen.getByText(/Practice stage 8\/8/)).toBeTruthy();
    expect(screen.getByText(/new busy layout/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Tap the star target'}));
    expect(trial).toHaveBeenCalledWith(expect.objectContaining({
      practiceStage:8,distractorsShown:5,visualGuidePresented:false,
    }));
    expect(mocks.updateTrial).not.toHaveBeenCalled();
  });
});
