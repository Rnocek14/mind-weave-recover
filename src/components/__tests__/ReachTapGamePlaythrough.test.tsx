/**
 * Reach & Tap patient playthrough: render the REAL game component. Screen
 * geometry and nonclinical external hooks are controlled; hit/miss locking,
 * timers, finalization and touch targets are exercised as shipped.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReachTapGame } from '@/components/ReachTapGame';

const mocks = vi.hoisted(() => ({
  updateTrial: vi.fn(),
  recordTrial: vi.fn(),
  checkAndAdjust: vi.fn(),
  playSuccess: vi.fn(),
  playTimeout: vi.fn(),
}));
vi.mock('@/hooks/useAdaptiveDifficulty', () => ({
  useAdaptiveDifficulty: () => ({
    currentDifficulty: 1,
    updateTrial: mocks.updateTrial,
    checkAndAdjust: mocks.checkAndAdjust,
  }),
}));
vi.mock('@/hooks/useEngagementMonitor', () => ({
  useEngagementMonitor: () => ({
    recordTrial: mocks.recordTrial,
    getState: () => ({ signals: { cueDependency: 0 } }),
  }),
}));
vi.mock('@/hooks/useGameSounds', () => ({
  useGameSounds: () => ({
    playSuccess: mocks.playSuccess,
    playTimeout: mocks.playTimeout,
    playLevelUp: vi.fn(),
    playLevelDown: vi.fn(),
    playStreak: vi.fn(),
  }),
}));

describe('ReachTapGame patient touch flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0, y: 0, width: 320, height: 440,
      left: 0, top: 0, right: 320, bottom: 440,
      toJSON: () => ({}),
    } as DOMRect));
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('records each star tap once and never spawns an eleventh/unwanted final target', () => {
    const onTrialComplete = vi.fn();
    const onGameComplete = vi.fn();
    render(
      <ReachTapGame
        variant="left-side-hunt"
        totalTrials={2}
        initialDifficulty={1}
        slowMode
        onTrialComplete={onTrialComplete}
        onGameComplete={onGameComplete}
      />,
    );

    const progress = screen.getByRole('progressbar', { name: 'Completed Reach and Tap trials' });
    expect(progress.getAttribute('aria-valuenow')).toBe('0');

    act(() => { vi.advanceTimersByTime(500); });
    let star = screen.getByRole('button', { name: 'Tap the star target' });
    expect(Number.parseFloat(star.style.left)).toBeGreaterThanOrEqual(12);
    expect(Number.parseFloat(star.style.left) + Number.parseFloat(star.style.width))
      .toBeLessThanOrEqual(320 - 12);
    fireEvent.click(star);
    fireEvent.click(star);
    expect(onTrialComplete).toHaveBeenCalledTimes(1);
    expect(progress.getAttribute('aria-valuenow')).toBe('50');

    act(() => { vi.advanceTimersByTime(800); });
    act(() => { vi.advanceTimersByTime(1000); });
    star = screen.getByRole('button', { name: 'Tap the star target' });
    fireEvent.click(star);
    fireEvent.click(star);
    expect(onTrialComplete).toHaveBeenCalledTimes(2);
    expect(onGameComplete).not.toHaveBeenCalled();
    expect(progress.getAttribute('aria-valuenow')).toBe('100');

    act(() => { vi.advanceTimersByTime(800); });
    expect(onGameComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Practice complete')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.queryByRole('button', { name: 'Tap the star target' })).toBeNull();
    expect(onGameComplete).toHaveBeenCalledTimes(1);
  });

  it('cleans up pending feedback when the patient exits during a trial', () => {
    const onTrialComplete = vi.fn();
    const onGameComplete = vi.fn();
    const { unmount } = render(
      <ReachTapGame
        totalTrials={1}
        initialDifficulty={1}
        slowMode
        onTrialComplete={onTrialComplete}
        onGameComplete={onGameComplete}
      />,
    );
    act(() => { vi.advanceTimersByTime(500); });
    fireEvent.click(screen.getByRole('button', { name: 'Tap the target' }));
    expect(onTrialComplete).toHaveBeenCalledTimes(1);
    unmount();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onGameComplete).not.toHaveBeenCalled();
  });
});
