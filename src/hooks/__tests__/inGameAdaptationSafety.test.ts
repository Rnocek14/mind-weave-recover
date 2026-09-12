/**
 * Safety contract for the shared in-session adaptation engine.
 *
 * These pin two rules the clinical contracts state explicitly:
 *
 *  1. "Never punish a single trial or a single session."
 *     (src/docs/PER_GAME_LEVELING_CONTRACT.md §1.4)
 *     The emergency two-step drop belongs to a run of errors —
 *     "4 errors in a row → emergency 2-step step-down"
 *     (src/docs/EXERCISE_ADAPTATION_GUIDE.md) — not to the first miss of a
 *     session, which previously read as a 0% success rate on a one-trial window.
 *
 *  2. A level is earned by evidence gathered AT that level.
 *     The rolling window is cleared whenever the level moves, so a correct
 *     streak can no longer escalate on every single trial once the window fills.
 *
 *  3. The persistent clinical level usually loads after first render, so the
 *     hook adopts a later `initialDifficulty` until the first trial is recorded
 *     (and never after that, so in-session adaptation is never clobbered).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/hooks/useProfile', () => ({ useProfile: () => ({ activeProfile: null }) }));
vi.mock('@/hooks/use-toast', () => ({ toast: () => {} }));
vi.mock('@/hooks/useAdaptationTrialLogger', () => ({
  useAdaptationTrialLogger: () => ({ logTrial: () => {}, flush: async () => {} }),
}));
vi.mock('@/hooks/useAdaptationEventLogger', () => ({
  useAdaptationEventLogger: () => ({ logDifficultyChange: () => {} }),
}));

import { useInGameAdaptation } from '@/hooks/useInGameAdaptation';

const BOUNDS = { floor: 1, ceiling: 10, suggestedStart: 5 };

function mount(initialDifficulty: number, overrides: Record<string, unknown> = {}) {
  return renderHook(
    (props: { initialDifficulty: number }) =>
      useInGameAdaptation({
        exerciseSlug: 'photo_naming',
        sessionId: null,
        initialDifficulty: props.initialDifficulty,
        bounds: BOUNDS,
        autoLog: false,
        enableDifficultyToasts: false,
        ...overrides,
      }),
    { initialProps: { initialDifficulty } },
  );
}

/** Drive a stream of trials and return the level after each one. */
function play(result: ReturnType<typeof mount>, stream: boolean[]): number[] {
  const levels: number[] = [];
  for (const correct of stream) {
    act(() => {
      const r = result.result.current.recordTrial({ correct, reactionTimeMs: 1200 });
      levels.push(r.newDifficulty);
    });
  }
  return levels;
}

describe('useInGameAdaptation — never punish a single trial', () => {
  beforeEach(() => vi.clearAllMocks());

  it('holds the level when the first trial of a session is wrong', () => {
    const h = mount(5);
    expect(play(h, [false])).toEqual([5]);
  });

  it('holds the level through two and three early misses', () => {
    expect(play(mount(5), [false, false])).toEqual([5, 5]);
    expect(play(mount(5), [true, false, false])).toEqual([5, 5, 5]);
  });

  it('still steps down two levels after four errors in a row', () => {
    const levels = play(mount(5), [false, false, false, false]);
    expect(levels[3]).toBe(3);
  });

  it('does not fire the emergency drop below the capability floor', () => {
    const levels = play(mount(2), [false, false, false, false]);
    expect(levels[3]).toBe(1);
  });
});

describe('useInGameAdaptation — a level is earned at that level', () => {
  it('does not escalate on every trial of a long correct streak', () => {
    const levels = play(mount(5), [true, true, true, true, true, true, true, true]);
    // One move per full window of evidence, not one per trial.
    expect(levels[7]).toBeLessThanOrEqual(7);
    expect(levels[7]).toBeGreaterThan(5);
  });

  it('requires a fresh window after a change before moving again', () => {
    const h = mount(5);
    const levels = play(h, [true, true, true, true, true]);
    expect(levels[3]).toBe(6); // window filled -> one step up
    expect(levels[4]).toBe(6); // next trial alone is not new evidence
  });
});

describe('useInGameAdaptation — late clinical level adoption', () => {
  it('adopts a higher initialDifficulty that arrives before the first trial', () => {
    const h = mount(1);
    expect(h.result.current.currentDifficulty).toBe(1);
    h.rerender({ initialDifficulty: 5 });
    expect(h.result.current.currentDifficulty).toBe(5);
  });

  it('ignores a changed initialDifficulty once play has started', () => {
    const h = mount(5);
    play(h, [true]);
    h.rerender({ initialDifficulty: 1 });
    expect(h.result.current.currentDifficulty).toBe(5);
  });
});
