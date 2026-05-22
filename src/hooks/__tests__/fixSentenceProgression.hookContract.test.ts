/**
 * Phase 1A — Hook contract test for Fix Sentence progression.
 *
 * Mirrors the photoNamingProgression.hookContract.test.ts template.
 * Verifies the load-gate contract: before the DB load resolves,
 * `loaded === false` and `startingLevel === null`. After it resolves
 * with currentLevel=N, `startingLevel === N`.
 *
 * Read-only against the hook. Does NOT modify progression or scoring.
 *
 * Template note: when adding a new per-slug contract test, copy this
 * file, swap the hook import and slug, and adjust the persisted level
 * value. Keep the assertion shape identical so the suite stays uniform.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

let resolveLoad: ((v: unknown) => void) | null = null;
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

import { useFixSentenceProgression } from '@/hooks/useFixSentenceProgression';

describe('Fix Sentence — progression load-gate contract', () => {
  beforeEach(() => {
    resolveLoad = null;
  });

  it('first render: loaded=false, startingLevel=null', () => {
    const { result } = renderHook(() =>
      useFixSentenceProgression({ userId: 'u1', profileId: 'p1' }),
    );
    expect(result.current.loaded).toBe(false);
    expect(result.current.startingLevel).toBeNull();
  });

  it('after load resolves with currentLevel=3, startingLevel=3', async () => {
    const { result } = renderHook(() =>
      useFixSentenceProgression({ userId: 'u1', profileId: 'p1' }),
    );

    await act(async () => {
      resolveLoad?.({
        userId: 'u1',
        profileId: 'p1',
        exerciseSlug: 'fix-sentence',
        currentLevel: 3,
        progressPct: 0,
        supportBaseline: 'independent',
        consecutiveStruggleSessions: 0,
        lastSessionId: null,
      });
    });

    expect(result.current.loaded).toBe(true);
    expect(result.current.startingLevel).toBe(3);
  });
});
