import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/progression/clinicalProgression', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/progression/clinicalProgression')>();
  return {
    ...actual,
    loadProgressionStateChecked: vi.fn(async (ids: {
      userId: string; profileId: string; exerciseSlug: string,
    }) => ({ state: actual.defaultProgressionState(ids), verified: true, source: 'new' })),
    saveProgressionState: vi.fn(async () => ({ ok: true })),
  };
});
vi.mock('@/lib/mastery/readMasteryGate', () => ({
  readMasteryGate: vi.fn(async () => ({ verdict: 'skip' })),
}));

import {
  defaultProgressionState, loadProgressionStateChecked, saveProgressionState,
} from '@/lib/progression/clinicalProgression';
import { useConversationPartnerProgression } from '@/hooks/useConversationPartnerProgression';

const userId = 'synthetic-user';
const profileId = 'synthetic-profile';

beforeEach(() => {
  vi.mocked(loadProgressionStateChecked).mockReset().mockImplementation(async ids => ({
    state: defaultProgressionState(ids), verified: true, source: 'new',
  }));
  vi.mocked(saveProgressionState).mockReset().mockResolvedValue({ ok: true });
});

describe('Conversation Partner clinical hook — verified saved turns', () => {
  it('loads L1 for a genuinely new patient and credits exactly ONE turn per response', async () => {
    const { result } = renderHook(() => useConversationPartnerProgression({ userId, profileId }));
    await waitFor(() => expect(result.current.verified).toBe(true));
    expect(result.current.level).toBe(1);
    act(() => {
      result.current.recordVerifiedTurn({ turnNumber: 1, correct: true, support: 'independent' });
      result.current.recordVerifiedTurn({ turnNumber: 1, correct: true, support: 'independent' });
      result.current.recordVerifiedTurn({ turnNumber: 2, correct: true, support: 'independent' });
    });
    expect(result.current.__verifiedTurnCount()).toBe(1);
    await act(async () => { await result.current.flushAtSessionEnd('synthetic-session'); });
    expect(saveProgressionState).toHaveBeenCalledTimes(1);
    const persisted = vi.mocked(saveProgressionState).mock.calls[0][0];
    expect(persisted.profileId).toBe(profileId);
    expect(persisted.exerciseSlug).toBe('conversation-partner');
    expect(persisted.progressPct).toBe(25);
    expect(persisted.currentLevel).toBe(1);
    await act(async () => { await result.current.flushAtSessionEnd('synthetic-session'); });
    expect(saveProgressionState).toHaveBeenCalledTimes(1);
  });

  it('does not save when only one of the two required L2 exchanges was verified', async () => {
    vi.mocked(loadProgressionStateChecked).mockImplementation(async ids => ({
      state: { ...defaultProgressionState(ids), currentLevel: 2 },
      verified: true, source: 'stored',
    }));
    const { result } = renderHook(() => useConversationPartnerProgression({ userId, profileId }));
    await waitFor(() => expect(result.current.verified).toBe(true));
    act(() => result.current.recordVerifiedTurn({
      turnNumber: 1, correct: true, support: 'semantic_cue',
    }));
    let outcome: { ok: boolean } | undefined;
    await act(async () => { outcome = await result.current.flushAtSessionEnd('synthetic-session'); });
    expect(outcome).toMatchObject({ ok: false, skipped: true });
    expect(saveProgressionState).not.toHaveBeenCalled();
  });

  it('cannot advance a L3 learner into unimplemented L4 even at 100 percent', async () => {
    vi.mocked(loadProgressionStateChecked).mockImplementation(async ids => ({
      state: { ...defaultProgressionState(ids), currentLevel: 3, stableLevel: 3, progressPct: 95 },
      verified: true, source: 'stored',
    }));
    const { result } = renderHook(() => useConversationPartnerProgression({ userId, profileId }));
    await waitFor(() => expect(result.current.verified).toBe(true));
    act(() => {
      for (let n = 1; n <= 3; n++)
        result.current.recordVerifiedTurn({ turnNumber: n, correct: true, support: 'independent' });
    });
    await act(async () => { await result.current.flushAtSessionEnd('synthetic-session'); });
    const persisted = vi.mocked(saveProgressionState).mock.calls[0][0];
    expect(persisted.currentLevel).toBe(3);
    expect(persisted.progressPct).toBe(100);
  });

  it('unverified reads can practice L1 but NEVER replace a previous saved rung', async () => {
    vi.mocked(loadProgressionStateChecked).mockImplementation(async ids => ({
      state: defaultProgressionState(ids), verified: false,
      source: 'unverified', error: 'simulated RLS failure',
    }));
    const { result } = renderHook(() => useConversationPartnerProgression({ userId, profileId }));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.level).toBe(1);
    expect(result.current.verified).toBe(false);
    act(() => result.current.recordVerifiedTurn({ turnNumber: 1, correct: true, support: 'independent' }));
    expect(result.current.__verifiedTurnCount()).toBe(0);
    await act(async () => { await result.current.flushAtSessionEnd('synthetic-session'); });
    expect(saveProgressionState).not.toHaveBeenCalled();
  });

  it('never overwrites a legacy L4–L8 row with L3 practice', async () => {
    vi.mocked(loadProgressionStateChecked).mockImplementation(async ids => ({
      state: { ...defaultProgressionState(ids), currentLevel: 5 }, verified: true, source: 'stored',
    }));
    const { result } = renderHook(() => useConversationPartnerProgression({ userId, profileId }));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.level).toBe(3);
    expect(result.current.verified).toBe(false);
    await act(async () => { await result.current.flushAtSessionEnd('synthetic-session'); });
    expect(saveProgressionState).not.toHaveBeenCalled();
  });

  it('discards stale callbacks and trials on a patient profile switch', async () => {
    const { result, rerender } = renderHook(
      ({ pid }) => useConversationPartnerProgression({ userId, profileId: pid }),
      { initialProps: { pid: 'patient-a' } },
    );
    await waitFor(() => expect(result.current.verified).toBe(true));
    const oldCallback = result.current.recordVerifiedTurn;
    rerender({ pid: 'patient-b' });
    oldCallback({ turnNumber: 1, correct: true, support: 'independent' });
    await waitFor(() => expect(result.current.verified).toBe(true));
    expect(result.current.__verifiedTurnCount()).toBe(0);
    act(() => result.current.recordVerifiedTurn({ turnNumber: 1, correct: true, support: 'independent' }));
    await act(async () => { await result.current.flushAtSessionEnd('session-b'); });
    expect(vi.mocked(saveProgressionState).mock.calls[0][0].profileId).toBe('patient-b');
  });
});
