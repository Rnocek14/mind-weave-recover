/**
 * Load-race regression test — Phase 3 acceptance criterion.
 *
 * Bug being captured (currently EXPECTED TO FAIL once fix lands):
 *   `usePhotoNamingProgression` loads `currentLevel` from the DB
 *   asynchronously. On first render, `startingLevel` is `null`, so
 *   `resolveEffectiveInitialDifficulty({ clinicalLevel: null, ... })`
 *   collapses the floor to 1. `useInGameAdaptation` captures
 *   `initialDifficulty` at mount time, so a patient stored at
 *   Clinical L4 (engine floor 5) starts the session at engine 1.
 *
 * Acceptance criterion for the Phase 3 render-gate fix:
 *   The "first render" assertion below must change from `effective: 1`
 *   to "render is gated until loaded === true" (no initialDifficulty
 *   computed before progression load resolves).
 *
 * For now this test PROVES the race exists. Do not delete it when
 * Phase 3 ships — instead, repurpose it to assert the gate behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { resolveEffectiveInitialDifficulty } from '@/lib/progression/photoNamingDifficultyBridge';

// Mock the DB loader so we control when "load" resolves.
let resolveLoad: ((v: any) => void) | null = null;
vi.mock('@/lib/progression/clinicalProgression', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/progression/clinicalProgression')>();
  return {
    ...actual,
    loadProgressionState: vi.fn(
      () =>
        new Promise((res) => {
          resolveLoad = res;
        }),
    ),
    saveProgressionState: vi.fn(async () => ({ ok: true })),
  };
});

import { usePhotoNamingProgression } from '@/hooks/usePhotoNamingProgression';

describe('Phase 3 load-race regression — Photo Naming', () => {
  beforeEach(() => {
    resolveLoad = null;
  });

  it('first render: clinicalLevel is null, bridge collapses engine floor to 1 (BUG)', () => {
    const { result } = renderHook(() =>
      usePhotoNamingProgression({ userId: 'u1', profileId: 'p1' }),
    );

    // Synchronous first render — load() is in-flight, state unresolved.
    expect(result.current.loaded).toBe(false);
    expect(result.current.startingLevel).toBeNull();

    // What the page does at mount:
    const bridge = resolveEffectiveInitialDifficulty({
      sessionAdaptationDifficulty: 1,
      clinicalLevel: result.current.startingLevel,
    });

    // The race manifests here: a patient stored at L4 (floor 5) starts at 1.
    expect(bridge.effective).toBe(1);
    expect(bridge.clinicalFloor).toBe(1);
    expect(bridge.raised).toBe(false);
  });

  it('after load resolves to currentLevel=4, bridge raises engine floor to 5', async () => {
    const { result } = renderHook(() =>
      usePhotoNamingProgression({ userId: 'u1', profileId: 'p1' }),
    );

    // Snapshot the broken pre-load value first.
    const preLoadBridge = resolveEffectiveInitialDifficulty({
      sessionAdaptationDifficulty: 1,
      clinicalLevel: result.current.startingLevel,
    });
    expect(preLoadBridge.effective).toBe(1);

    // Resolve the DB load — patient is at Clinical L4.
    await act(async () => {
      resolveLoad?.({
        userId: 'u1',
        profileId: 'p1',
        exerciseSlug: 'photo_naming',
        currentLevel: 4,
        progressPct: 0,
        supportBaseline: 'independent',
        consecutiveStruggleSessions: 0,
        lastSessionId: null,
      });
    });

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.startingLevel).toBe(4);

    const postLoadBridge = resolveEffectiveInitialDifficulty({
      sessionAdaptationDifficulty: 1,
      clinicalLevel: result.current.startingLevel,
    });
    expect(postLoadBridge.effective).toBe(5);
    expect(postLoadBridge.clinicalFloor).toBe(5);
    expect(postLoadBridge.raised).toBe(true);

    // Gap captured by the regression: useInGameAdaptation reads
    // initialDifficulty ONCE at mount (preLoadBridge.effective = 1),
    // so the session runs at engine 1 even though the patient's
    // persisted floor is engine 5.
    expect(preLoadBridge.effective).not.toBe(postLoadBridge.effective);
  });
});
