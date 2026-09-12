/**
 * The clinical floor usually arrives after the first render.
 *
 * Pages call `useDynamicTier` at page scope, so React runs it before any render
 * gate can return a spinner. While the engine kept whatever `initialTier` it saw
 * on that first render, a patient's stored clinical level never reached the
 * controller and the whole session ran at the default tier — the load gate
 * protected the game's markup but not the value it was meant to protect.
 * (Sentence Construction and Dual-Load Naming both hit this.)
 */
import { describe, it, expect, vi } from 'vitest';
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
vi.mock('@/hooks/useExerciseGating', () => ({
  useExerciseGating: () => ({ capabilityScores: null }),
}));

import { useDynamicTier } from '@/hooks/useDynamicTier';

function mount(initialTier: number, maxTier = 10) {
  return renderHook(
    (p: { initialTier: number }) =>
      useDynamicTier({
        exerciseSlug: 'sentence-construction',
        sessionId: null,
        initialTier: p.initialTier,
        minTier: 1,
        maxTier,
        targetSuccessRate: 0.75,
      }),
    { initialProps: { initialTier } },
  );
}

describe('useDynamicTier — late clinical floor', () => {
  it('adopts a floor that resolves after the first render', () => {
    const h = mount(1);
    expect(h.result.current.currentTier).toBe(1);
    h.rerender({ initialTier: 6 });
    expect(h.result.current.currentTier).toBe(6);
  });

  it('keeps the adopted floor once play begins', () => {
    const h = mount(1);
    h.rerender({ initialTier: 6 });
    act(() => { h.result.current.recordTrial({ correct: true }); });
    h.rerender({ initialTier: 1 });
    expect(h.result.current.currentTier).toBe(6);
  });

  it('maps a late floor onto a three-tier game', () => {
    const h = mount(1, 3);
    h.rerender({ initialTier: 3 });
    expect(h.result.current.currentTier).toBe(3);
  });
});
