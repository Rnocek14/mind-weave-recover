/**
 * Patient-style Pattern Match playthrough of the real rendered game.
 *
 * External telemetry, sounds, and adaptation persistence are mocked; the
 * phase transitions, answer locking, level rerender and final-score
 * reporting are from the production PatternMatchGame component.
 */
import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PatternMatchGame } from '@/components/PatternMatchGame';

const spies = vi.hoisted(() => ({
  updateTrial: vi.fn(),
  recordTrial: vi.fn(),
  checkAndAdjust: vi.fn(),
  playSuccess: vi.fn(),
  playError: vi.fn(),
}));

vi.mock('@/hooks/useAdaptiveDifficulty', () => ({
  useAdaptiveDifficulty: () => {
    const [currentDifficulty, setCurrentDifficulty] = useState(3);
    return {
      currentDifficulty,
      updateTrial: spies.updateTrial,
      checkAndAdjust: () => {
        spies.checkAndAdjust();
        // Force a visible level change at the previous round boundary,
        // reproducing the stale-difficulty closure risk in the real game.
        setCurrentDifficulty(7);
      },
    };
  },
}));
vi.mock('@/hooks/useEngagementMonitor', () => ({
  useEngagementMonitor: () => ({
    recordTrial: spies.recordTrial,
    getState: () => ({ signals: { cueDependency: 0 } }),
  }),
}));
vi.mock('@/hooks/useGameSounds', () => ({
  useGameSounds: () => ({
    playSuccess: spies.playSuccess,
    playError: spies.playError,
    playLevelUp: vi.fn(),
    playLevelDown: vi.fn(),
  }),
}));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

const choiceButtons = () => screen.getAllByRole('button', { name: /Pattern choice \d+ of \d+/ });

describe('PatternMatchGame real patient playthrough', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('accepts only one choice per round, applies updated level to next round, and completes once', () => {
    const onTrialComplete = vi.fn();
    const onGameComplete = vi.fn();
    render(
      <PatternMatchGame
        totalTrials={2}
        initialDifficulty={3}
        slowMode
        onTrialComplete={onTrialComplete}
        onGameComplete={onGameComplete}
      />,
    );

    expect(screen.getByText('Remember this pattern', { exact: false })).toBeTruthy();
    const progress = screen.getByRole('progressbar', { name: 'Completed pattern trials' });
    expect(progress.getAttribute('aria-valuenow')).toBe('0');

    act(() => { vi.advanceTimersByTime(6000); });
    expect(screen.getByText('Find the matching pattern', { exact: false })).toBeTruthy();
    expect(choiceButtons()).toHaveLength(3); // level 3 = 3 displayed choices

    const first = choiceButtons()[0];
    fireEvent.click(first);
    fireEvent.click(first); // rapid double tap must not create a second event
    expect(onTrialComplete).toHaveBeenCalledTimes(1);
    expect(spies.recordTrial).toHaveBeenCalledTimes(1);
    expect(progress.getAttribute('aria-valuenow')).toBe('50');
    expect(onGameComplete).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(1500); });
    expect(screen.getByText('Trial 2/2')).toBeTruthy();
    expect(screen.getByText('Lv 7')).toBeTruthy();
    expect(screen.queryAllByRole('button', { name: /Pattern choice/ })).toHaveLength(0);

    act(() => { vi.advanceTimersByTime(6000); });
    expect(choiceButtons()).toHaveLength(4); // updated level 7 = 4 choices
    fireEvent.click(choiceButtons()[0]);
    expect(onTrialComplete).toHaveBeenCalledTimes(2);
    expect(progress.getAttribute('aria-valuenow')).toBe('100');

    act(() => { vi.advanceTimersByTime(1500); });
    const successes = onTrialComplete.mock.calls.filter(([entry]) => entry.correct).length;
    expect(onGameComplete).toHaveBeenCalledTimes(1);
    expect(onGameComplete).toHaveBeenCalledWith(successes);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onGameComplete).toHaveBeenCalledTimes(1);
  });

  it('cancels delayed UI transitions when patient leaves mid-pattern', () => {
    const onTrialComplete = vi.fn();
    const onGameComplete = vi.fn();
    const { unmount } = render(
      <PatternMatchGame
        totalTrials={2}
        slowMode
        onTrialComplete={onTrialComplete}
        onGameComplete={onGameComplete}
      />,
    );
    act(() => { vi.advanceTimersByTime(700); });
    unmount();
    act(() => { vi.advanceTimersByTime(10000); });
    expect(onTrialComplete).not.toHaveBeenCalled();
    expect(onGameComplete).not.toHaveBeenCalled();
  });
});
