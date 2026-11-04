import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/progression/clinicalProgression', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/progression/clinicalProgression')>();
  return {
    ...real,
    loadProgressionStateChecked: vi.fn(async (ids: { userId: string; profileId: string; exerciseSlug: string }) => ({
      state: real.defaultProgressionState(ids), verified: true, source: 'new',
    })),
    saveProgressionState: vi.fn(async () => ({ ok: true })),
  };
});
vi.mock('@/lib/mastery/readMasteryGate', () => ({
  readMasteryGate: vi.fn(async () => ({ verdict: 'skip' })),
}));

import { useGradedTaskProgression } from '@/hooks/useGradedTaskProgression';
import {
  defaultProgressionState, loadProgressionStateChecked, saveProgressionState,
} from '@/lib/progression/clinicalProgression';

const ids = { userId: 'synthetic-user', profileId: 'synthetic-patient', slug: 'describe-guess' as const };

describe('Three graded games — real clinical progression hook', () => {
  beforeEach(() => {
    vi.mocked(loadProgressionStateChecked).mockReset().mockImplementation(async args => ({
      state: defaultProgressionState(args), verified: true, source: 'new',
    }));
    vi.mocked(saveProgressionState).mockReset().mockResolvedValue({ ok: true });
  });

  it('loads a verified per-profile state and only saves one outcome per stimulus', async () => {
    const { result } = renderHook(() => useGradedTaskProgression(ids));
    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.verified).toBe(true));
    expect(result.current.startingLevel).toBe(1);
    act(() => {
      result.current.recordTrialOutcome({ correct: true, support: 'semantic_cue', stimulusId: 'picture-1' });
      result.current.recordTrialOutcome({ correct: true, support: 'independent', stimulusId: 'picture-1' });
      result.current.recordTrialOutcome({ correct: true, support: 'independent', stimulusId: 'picture-2' });
      result.current.recordTrialOutcome({ correct: true, support: 'independent', stimulusId: 'picture-3' });
    });
    expect(result.current.__bufferedTrialCount()).toBe(3);
    await act(async () => { await result.current.flushAtSessionEnd({ sessionId: 'synthetic-session' }); });
    expect(saveProgressionState).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(saveProgressionState).mock.calls[0][0];
    expect(saved.profileId).toBe(ids.profileId);
    expect(saved.exerciseSlug).toBe('describe-guess');
    expect(saved.progressPct).toBeGreaterThan(0);
    await act(async () => { await result.current.flushAtSessionEnd({ sessionId: 'synthetic-session' }); });
    expect(saveProgressionState).toHaveBeenCalledTimes(1);
  });

  it('never writes Level 1 if an existing patient saved-level lookup failed', async () => {
    vi.mocked(loadProgressionStateChecked).mockImplementation(async args => ({
      state: defaultProgressionState(args), verified: false, source: 'unverified',
      error: 'test-only RLS query error',
    }));
    const { result } = renderHook(() => useGradedTaskProgression({ ...ids, slug: 'abstract-compare' }));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.verified).toBe(false);
    expect(result.current.startingLevel).toBe(1); // safe PRACTICE fallback only
    act(() => result.current.recordTrialOutcome({ correct: true, support: 'independent' }));
    expect(result.current.__bufferedTrialCount()).toBe(0);
    let outcome: { ok: boolean } | undefined;
    await act(async () => { outcome = await result.current.flushAtSessionEnd({ sessionId: 'synthetic-session' }); });
    expect(outcome).toMatchObject({ ok: false, skipped: true });
    expect(saveProgressionState).not.toHaveBeenCalled();
  });

  it('isolates the response buffer and rejects old callbacks on patient switch', async () => {
    const { result, rerender } = renderHook(
      ({ profileId }: { profileId: string }) =>
        useGradedTaskProgression({ userId: ids.userId, profileId, slug: 'thought-continuation' }),
      { initialProps: { profileId: 'synthetic-patient-a' } },
    );
    await waitFor(() => expect(result.current.verified).toBe(true));
    const previousCallback = result.current.recordTrialOutcome;
    rerender({ profileId: 'synthetic-patient-b' });
    expect(result.current.startingLevel).toBeNull();
    previousCallback({ correct: true, support: 'independent', stimulusId: 'late-patient-a' });
    await waitFor(() => expect(result.current.verified).toBe(true));
    act(() => result.current.recordTrialOutcome({ correct: true, support: 'independent', stimulusId: 'patient-b' }));
    expect(result.current.__bufferedTrialCount()).toBe(1);
    await act(async () => { await result.current.flushAtSessionEnd({ sessionId: 'session-b' }); });
    expect(vi.mocked(saveProgressionState).mock.calls[0][0].profileId).toBe('synthetic-patient-b');
  });
});
