/**
 * Actual Sentence Construction progression hook with controlled persistence
 * transport. No production backend or patient account is contacted.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/progression/clinicalProgression', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/progression/clinicalProgression')>();
  return {
    ...original,
    loadProgressionStateChecked: vi.fn(async (ids: {
      userId: string; profileId: string; exerciseSlug: string;
    }) => ({ state: original.defaultProgressionState(ids), verified: true, source: 'new' })),
    saveProgressionState: vi.fn(async () => ({ ok: true })),
  };
});
vi.mock('@/lib/mastery/readMasteryGate', () => ({
  readMasteryGate: vi.fn(async () => ({ verdict: 'skip' })),
}));

import {
  defaultProgressionState, loadProgressionStateChecked, saveProgressionState,
} from '@/lib/progression/clinicalProgression';
import { useSentenceConstructionProgression } from '@/hooks/useSentenceConstructionProgression';

const ids = { userId: 'synthetic-user', profileId: 'synthetic-patient' };
const grammarSlug = 'sentence-construction';
const success = { correct: true, support: 'choice_based' as const };

beforeEach(() => {
  vi.mocked(loadProgressionStateChecked).mockReset().mockImplementation(async identity => ({
    state: defaultProgressionState(identity), verified: true, source: 'new',
  }));
  vi.mocked(saveProgressionState).mockReset().mockResolvedValue({ ok: true });
});

describe('Sentence Construction: verified saved clinical level', () => {
  it('uses verified existing L6 syntax rung, preserves prior progress and records only this patient', async () => {
    vi.mocked(loadProgressionStateChecked).mockImplementation(async identity => ({
      state: { ...defaultProgressionState(identity), currentLevel: 6,
        stableLevel: 6, progressPct: 30 },
      verified: true, source: 'stored',
    }));
    const { result } = renderHook(() => useSentenceConstructionProgression(ids));
    expect(result.current.loaded).toBe(false);
    expect(result.current.startingLevel).toBeNull();
    await waitFor(() => expect(result.current.verified).toBe(true));
    expect(result.current.startingLevel).toBe(6);

    act(() => {
      for (let n = 0; n < 6; n++) result.current.recordTrialOutcome(success);
    });
    expect(result.current.__bufferedTrialCount()).toBe(6);

    await act(async () => {
      const saved = await result.current.flushAtSessionEnd({ sessionId: 'synthetic-session' });
      expect(saved).toMatchObject({ ok: true });
    });
    expect(saveProgressionState).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveProgressionState).mock.calls[0][0]).toMatchObject({
      userId: ids.userId, profileId: ids.profileId, exerciseSlug: grammarSlug,
      currentLevel: 6, lastSessionId: 'synthetic-session',
    });
    expect(vi.mocked(saveProgressionState).mock.calls[0][0].progressPct).toBeGreaterThan(30);
    await act(async () => {
      await result.current.flushAtSessionEnd({ sessionId: 'synthetic-session' });
    });
    expect(saveProgressionState).toHaveBeenCalledTimes(1);
  });

  it('treats an explicit RLS/network read error as practice-only, never as a new L1 patient', async () => {
    vi.mocked(loadProgressionStateChecked).mockImplementation(async identity => ({
      state: defaultProgressionState(identity),
      verified: false, source: 'unverified', error: 'synthetic RLS denial',
    }));
    const { result } = renderHook(() => useSentenceConstructionProgression(ids));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.startingLevel).toBe(1);
    expect(result.current.verified).toBe(false);
    act(() => result.current.recordTrialOutcome(success));
    expect(result.current.__bufferedTrialCount()).toBe(0);
    let outcome: { ok: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.flushAtSessionEnd({ sessionId: 'synthetic-session' });
    });
    expect(outcome).toMatchObject({ ok: false, skipped: true });
    expect(saveProgressionState).not.toHaveBeenCalled();
  });

  it('handles a rejected read without an infinite spinner, with all saving blocked', async () => {
    vi.mocked(loadProgressionStateChecked).mockRejectedValueOnce(new Error('synthetic network error'));
    const { result } = renderHook(() => useSentenceConstructionProgression(ids));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.startingLevel).toBe(1);
    expect(result.current.verified).toBe(false);
    act(() => result.current.recordTrialOutcome(success));
    await act(async () => {
      await result.current.flushAtSessionEnd({ sessionId: 'synthetic-session' });
    });
    expect(saveProgressionState).not.toHaveBeenCalled();
  });

  it('does not save practice if profile is missing, but does not trap the patient at loading', async () => {
    const { result } = renderHook(() =>
      useSentenceConstructionProgression({ userId: ids.userId, profileId: null }),
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.startingLevel).toBe(1);
    expect(result.current.verified).toBe(false);
    act(() => result.current.recordTrialOutcome(success));
    await act(async () => {
      await result.current.flushAtSessionEnd({ sessionId: 'synthetic-session' });
    });
    expect(result.current.__bufferedTrialCount()).toBe(0);
    expect(saveProgressionState).not.toHaveBeenCalled();
  });

  it('patient switch clears buffered results, rejects old callback and never displays old level', async () => {
    vi.mocked(loadProgressionStateChecked).mockImplementation(async identity => ({
      state: { ...defaultProgressionState(identity),
        currentLevel: identity.profileId === 'patient-a' ? 7 : 2 },
      verified: true, source: 'stored',
    }));
    const { result, rerender } = renderHook(
      ({ profileId }) => useSentenceConstructionProgression({ userId: ids.userId, profileId }),
      { initialProps: { profileId: 'patient-a' } },
    );
    await waitFor(() => expect(result.current.startingLevel).toBe(7));
    const oldRecord = result.current.recordTrialOutcome;
    act(() => result.current.recordTrialOutcome(success));
    expect(result.current.__bufferedTrialCount()).toBe(1);
    rerender({ profileId: 'patient-b' });
    expect(result.current.startingLevel).toBeNull();
    act(() => oldRecord(success));
    await waitFor(() => expect(result.current.startingLevel).toBe(2));
    expect(result.current.__bufferedTrialCount()).toBe(0);
    act(() => result.current.recordTrialOutcome(success));
    await act(async () => {
      await result.current.flushAtSessionEnd({ sessionId: 'session-b' });
    });
    expect(saveProgressionState).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveProgressionState).mock.calls[0][0].profileId).toBe('patient-b');
  });

  it('failed save retains the same trials for a safe retry instead of claiming completion', async () => {
    vi.mocked(saveProgressionState)
      .mockResolvedValueOnce({ ok: false, error: 'synthetic write failure' })
      .mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() => useSentenceConstructionProgression(ids));
    await waitFor(() => expect(result.current.verified).toBe(true));
    act(() => result.current.recordTrialOutcome(success));
    let first: { ok: boolean } | undefined;
    await act(async () => {
      first = await result.current.flushAtSessionEnd({ sessionId: 'synthetic-session' });
    });
    expect(first?.ok).toBe(false);
    expect(result.current.__bufferedTrialCount()).toBe(1);
    await act(async () => {
      await result.current.flushAtSessionEnd({ sessionId: 'synthetic-session' });
    });
    expect(saveProgressionState).toHaveBeenCalledTimes(2);
  });

  it('guards overlapping Finish requests and suppresses a second patient-state write', async () => {
    let resolveSave!: (value: { ok: boolean }) => void;
    vi.mocked(saveProgressionState).mockImplementationOnce(() =>
      new Promise(resolve => { resolveSave = resolve; }),
    );
    const { result } = renderHook(() => useSentenceConstructionProgression(ids));
    await waitFor(() => expect(result.current.verified).toBe(true));
    act(() => result.current.recordTrialOutcome(success));
    let first!: ReturnType<typeof result.current.flushAtSessionEnd>;
    await act(async () => {
      first = result.current.flushAtSessionEnd({ sessionId: 'synthetic-session' });
    });
    // The mastery gate is async; wait until the first save is actually pending.
    await waitFor(() => expect(saveProgressionState).toHaveBeenCalledTimes(1));
    await act(async () => {
      const second = await result.current.flushAtSessionEnd({ sessionId: 'synthetic-session' });
      expect(second.skipped).toBe(true);
    });
    expect(saveProgressionState).toHaveBeenCalledTimes(1);
    await act(async () => { resolveSave({ ok: true }); await first; });
    await act(async () => {
      await result.current.flushAtSessionEnd({ sessionId: 'synthetic-session' });
    });
    expect(saveProgressionState).toHaveBeenCalledTimes(1);
  });

  it('does not replay already-saved session progress after refresh', async () => {
    vi.mocked(loadProgressionStateChecked).mockImplementation(async identity => ({
      state: { ...defaultProgressionState(identity), lastSessionId: 'synthetic-session' },
      verified: true, source: 'stored',
    }));
    const { result } = renderHook(() => useSentenceConstructionProgression(ids));
    await waitFor(() => expect(result.current.verified).toBe(true));
    act(() => result.current.recordTrialOutcome(success));
    await act(async () => {
      const response = await result.current.flushAtSessionEnd({ sessionId: 'synthetic-session' });
      expect(response).toMatchObject({ ok: true, skipped: true });
    });
    expect(saveProgressionState).not.toHaveBeenCalled();
  });
});
