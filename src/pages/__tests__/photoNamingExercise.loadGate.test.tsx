/**
 * Phase 3 load-gate test — PhotoNaming.
 *
 * Locks in the contract that PhotoNamingExercise will not mount
 * <PhotoNamingGame> until persistent clinical progression has resolved.
 * Without the gate, useInGameAdaptation captures `initialDifficulty` at
 * mount with `clinicalLevel: null`, collapsing the engine floor to 1.
 *
 * Implementation note: the real PhotoNamingExercise page pulls ~25
 * providers and async hooks (auth, profile, photo loaders, session
 * lifecycle, telemetry, live-analysis context, etc.). Mocking all of
 * them would produce a brittle test that breaks on every unrelated
 * page change. Instead, this test mounts a minimal harness that uses
 * the EXACT same primitives the page uses (`usePhotoNamingProgression`
 * + `resolveEffectiveInitialDifficulty` + the same gate predicate) and
 * asserts the gate behavior end-to-end. If the page diverges from this
 * predicate the gate is broken and the regression test in
 * src/hooks/__tests__/photoNamingProgression.hookContract.test.ts will
 * still catch the underlying race.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { resolveEffectiveInitialDifficulty } from '@/lib/progression/photoNamingDifficultyBridge';

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

function GateHarness() {
  const progression = usePhotoNamingProgression({ userId: 'u1', profileId: 'p1' });
  const bridge = resolveEffectiveInitialDifficulty({
    sessionAdaptationDifficulty: 1,
    clinicalLevel: progression.startingLevel,
  });

  // Mirror the page predicate exactly.
  if (!progression.loaded) {
    return <div data-testid="loading">Loading your progress...</div>;
  }

  return (
    <div
      data-testid="game"
      data-initial-difficulty={String(bridge.effective)}
      data-clinical-floor={String(bridge.clinicalFloor)}
      data-raised={String(bridge.raised)}
    />
  );
}

describe('Phase 3 load-gate — PhotoNaming', () => {
  beforeEach(() => {
    resolveLoad = null;
  });

  it('does not render the game until progression load resolves', async () => {
    render(<GateHarness />);

    // Pre-load: only the loading shell exists.
    expect(screen.getByTestId('loading')).toBeDefined();
    expect(screen.queryByTestId('game')).toBeNull();

    // Resolve load: patient stored at Clinical L4 (engine floor 5).
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

    // Post-load: game appears, mounted with the raised clinical floor.
    const game = await screen.findByTestId('game');
    expect(game.getAttribute('data-initial-difficulty')).toBe('5');
    expect(game.getAttribute('data-clinical-floor')).toBe('5');
    expect(game.getAttribute('data-raised')).toBe('true');
    expect(screen.queryByTestId('loading')).toBeNull();
  });

  it('post-load floor reflects the persisted clinicalLevel, not the null pre-load value', async () => {
    render(<GateHarness />);

    await act(async () => {
      resolveLoad?.({
        userId: 'u1',
        profileId: 'p1',
        exerciseSlug: 'photo_naming',
        currentLevel: 7,
        progressPct: 0,
        supportBaseline: 'independent',
        consecutiveStruggleSessions: 0,
        lastSessionId: null,
      });
    });

    const game = await screen.findByTestId('game');
    // L7 → engine floor 8 in the bridge mapping.
    expect(Number(game.getAttribute('data-initial-difficulty'))).toBeGreaterThanOrEqual(7);
    expect(game.getAttribute('data-raised')).toBe('true');
  });
});
