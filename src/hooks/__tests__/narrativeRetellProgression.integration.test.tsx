import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/progression/clinicalProgression', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/progression/clinicalProgression')>();
  return {
    ...actual,
    loadProgressionState: vi.fn(async (ids: { userId: string; profileId: string; exerciseSlug: string }) =>
      actual.defaultProgressionState(ids)),
    saveProgressionState: vi.fn(async () => ({ ok: true })),
  };
});
vi.mock('@/lib/mastery/readMasteryGate', () => ({
  readMasteryGate: vi.fn(async () => ({ verdict: 'skip', confidence: undefined, skills: [] })),
}));

import { useNarrativeRetellProgression } from '@/hooks/useNarrativeRetellProgression';
import { saveProgressionState } from '@/lib/progression/clinicalProgression';

const ids = { userId: 'test-user', profileId: 'patient-a' };
const good = { correct: true, support: 'independent' as const };

describe('Narrative Retell clinical progression integration', () => {
  beforeEach(() => vi.mocked(saveProgressionState).mockReset().mockResolvedValue({ ok: true }));

  it('loads saved-level gate before accepting clinical trials', async () => {
    const { result } = renderHook(() => useNarrativeRetellProgression(ids));
    expect(result.current.loaded).toBe(false);
    expect(result.current.startingLevel).toBeNull();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.startingLevel).toBe(1);
  });

  it('counts only one valid attempt per story and flushes once', async () => {
    const { result } = renderHook(() => useNarrativeRetellProgression(ids));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => {
      result.current.recordTrialOutcome({ ...good, correct: false, storyId: 'same-story' });
      result.current.recordTrialOutcome({ ...good, storyId: 'same-story' });
      result.current.recordTrialOutcome({ ...good, storyId: 'new-story' });
    });
    expect(result.current.__bufferedTrialCount()).toBe(2);
    await act(async () => { await result.current.flushAtSessionEnd({ sessionId: 'test-session' }); });
    expect(saveProgressionState).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(saveProgressionState).mock.calls[0][0];
    expect(saved.profileId).toBe(ids.profileId);
    expect(saved.exerciseSlug).toBe('narrative-retell');
    expect(saved.lastSessionId).toBe('test-session');
    expect(saved.progressPct).toBeGreaterThan(0);
    await act(async () => { await result.current.flushAtSessionEnd({ sessionId: 'test-session' }); });
    expect(saveProgressionState).toHaveBeenCalledTimes(1);
  });

  it('rejects an old asynchronous callback after a patient profile switch', async () => {
    const { result, rerender } = renderHook(
      ({ profileId }: { profileId: string }) =>
        useNarrativeRetellProgression({ userId: ids.userId, profileId }),
      { initialProps: { profileId: 'patient-a' } },
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const lateCallbackFromPatientA = result.current.recordTrialOutcome;

    rerender({ profileId: 'patient-b' });
    // The old patient's state must never be exposed on the new profile's
    // first render, before its async load is complete.
    expect(result.current.startingLevel).toBeNull();
    lateCallbackFromPatientA({ ...good, storyId: 'patient-a-late' });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.recordTrialOutcome({ ...good, storyId: 'patient-b-trial' }));
    expect(result.current.__bufferedTrialCount()).toBe(1);
    await act(async () => { await result.current.flushAtSessionEnd({ sessionId: 'session-b' }); });
    expect(saveProgressionState).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(saveProgressionState).mock.calls[0][0];
    expect(saved.profileId).toBe('patient-b');
    expect(saved.progressPct).toBeGreaterThan(0);
  });

  it('does not mark an unsuccessful save as complete and can retry the same buffer', async () => {
    vi.mocked(saveProgressionState)
      .mockResolvedValueOnce({ ok: false, error: 'isolated-test network failure' })
      .mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() => useNarrativeRetellProgression(ids));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.recordTrialOutcome({ ...good, storyId: 'story-1' }));
    let first: { ok: boolean } | null = null;
    await act(async () => { first = await result.current.flushAtSessionEnd({ sessionId: 'test-session' }); });
    expect(first).toMatchObject({ ok: false });
    expect(result.current.__bufferedTrialCount()).toBe(1);
    await act(async () => { await result.current.flushAtSessionEnd({ sessionId: 'test-session' }); });
    expect(saveProgressionState).toHaveBeenCalledTimes(2);
  });
});
