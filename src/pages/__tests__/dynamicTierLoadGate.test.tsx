/**
 * The clinical floor must reach the game ON ITS FIRST MOUNT.
 *
 * Pages such as Sentence Construction and Dual-Load Naming call
 * `useDynamicTier` at page scope and then render the game behind a
 * `progression.loaded` gate. React runs the page's hooks before the gate can
 * return a spinner, so the controller was seeded with the pre-load default and
 * kept it. Worse, the gate opens in the SAME render in which the floor
 * resolves, and both games freeze their content pool at mount — so an
 * adoption that lands one commit later fixes the badge and the telemetry while
 * the patient still answers Level-1 items.
 *
 * A hook-level rerender test cannot see this: it reads state after the render
 * settles. This harness records the prop value the child saw when it MOUNTED.
 *
 * Mirrors the harness style of photoNamingExercise.loadGate.test.tsx: the real
 * pages pull far too many providers to mount, so this uses the exact same
 * primitives the pages use.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

let resolveLoad: ((v: unknown) => void) | null = null;
vi.mock('@/lib/progression/clinicalProgression', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/progression/clinicalProgression')>();
  return {
    ...actual,
    loadProgressionState: vi.fn(() => new Promise((res) => { resolveLoad = res as never; })),
    saveProgressionState: vi.fn(async () => ({ ok: true })),
  };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useProfile', () => ({ useProfile: () => ({ activeProfile: { id: 'p1' } }) }));
vi.mock('@/hooks/use-toast', () => ({ toast: () => {} }));
vi.mock('@/hooks/useAdaptationTrialLogger', () => ({
  useAdaptationTrialLogger: () => ({ logTrial: () => {}, flush: async () => {} }),
}));
vi.mock('@/hooks/useAdaptationEventLogger', () => ({
  useAdaptationEventLogger: () => ({ logDifficultyChange: () => {} }),
}));
vi.mock('@/hooks/useExerciseGating', () => ({ useExerciseGating: () => ({ capabilityScores: null }) }));

import { useDynamicTier } from '@/hooks/useDynamicTier';
import { useSentenceConstructionProgression } from '@/hooks/useSentenceConstructionProgression';
import { resolveEffectiveSentenceConstructionInitialDifficulty } from '@/lib/progression/sentenceConstructionDifficultyBridge';

/** Stands in for the game: records the difficulty it was handed at mount. */
const mountedWith: number[] = [];
function FakeGame({ difficultyLevel }: { difficultyLevel: number }) {
  const atMount = React.useRef(difficultyLevel);
  React.useEffect(() => { mountedWith.push(atMount.current); }, []);
  return <div data-testid="game" data-mounted-with={String(atMount.current)} />;
}

function PageHarness() {
  const progression = useSentenceConstructionProgression({ userId: 'u1', profileId: 'p1' });
  const bridge = resolveEffectiveSentenceConstructionInitialDifficulty({
    sessionAdaptationDifficulty: 1,
    clinicalLevel: progression.startingLevel,
    supportBaseline: progression.state?.supportBaseline ?? 0,
  });
  // Page scope, exactly like the real pages — runs before any gate can return.
  const dynamicTier = useDynamicTier({
    exerciseSlug: 'sentence-construction',
    sessionId: null,
    initialTier: bridge.effective,
    minTier: 1,
    maxTier: 10,
    targetSuccessRate: 0.75,
  });

  if (!progression.loaded) return <div data-testid="loading" />;
  return <FakeGame difficultyLevel={dynamicTier.currentTier} />;
}

describe('clinical floor reaches the game at mount', () => {
  beforeEach(() => {
    resolveLoad = null;
    mountedWith.length = 0;
  });

  it('mounts the game with the resolved floor, not the pre-load default', async () => {
    render(<PageHarness />);
    expect(screen.getByTestId('loading')).toBeDefined();

    await act(async () => {
      resolveLoad?.({
        userId: 'u1',
        profileId: 'p1',
        exerciseSlug: 'sentence-construction',
        currentLevel: 5,
        progressPct: 0,
        supportBaseline: 0,
        stableLevel: 5,
        consecutiveSuccessSessions: 0,
        consecutiveStruggleSessions: 0,
        lastSessionId: null,
        lastUpdatedAt: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    });

    const game = await screen.findByTestId('game');
    const expected = resolveEffectiveSentenceConstructionInitialDifficulty({
      sessionAdaptationDifficulty: 1,
      clinicalLevel: 5,
      supportBaseline: 0,
    }).effective;

    expect(expected).toBeGreaterThan(1);
    // The value the game captured on its very first render.
    expect(Number(game.getAttribute('data-mounted-with'))).toBe(expected);
    expect(mountedWith).toEqual([expected]);
  });
});
