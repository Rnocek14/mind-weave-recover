import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/progression/clinicalProgression', async importOriginal => {
  const real = await importOriginal<typeof import('@/lib/progression/clinicalProgression')>();
  return {
    ...real,
    loadProgressionStateChecked: vi.fn(async (ids: {
      userId: string; profileId: string; exerciseSlug: string;
    }) => ({ state: real.defaultProgressionState(ids), verified: true, source: 'new' })),
    saveProgressionState: vi.fn(async () => ({ ok: true })),
  };
});
vi.mock('@/lib/mastery/readMasteryGate', () => ({
  readMasteryGate: vi.fn(async () => ({ verdict: 'skip' })),
}));

import {
  defaultProgressionState, loadProgressionStateChecked, saveProgressionState,
} from '@/lib/progression/clinicalProgression';
import { useConversationCoachProgression } from '@/hooks/useConversationCoachProgression';

const ids = { userId: 'synthetic-user', profileId: 'synthetic-patient' };

beforeEach(() => {
  vi.mocked(loadProgressionStateChecked).mockReset().mockImplementation(async values => ({
    state: defaultProgressionState(values), verified: true, source: 'new',
  }));
  vi.mocked(saveProgressionState).mockReset().mockResolvedValue({ ok: true });
});

describe('Guided Coach: actual patient progression hook', () => {
  it('saves a single acknowledged L1 modeled attempt once per completed session', async () => {
    const { result } = renderHook(() => useConversationCoachProgression(ids));
    await waitFor(() => expect(result.current.verified).toBe(true));
    expect(result.current.level).toBe(1);
    act(() => {
      result.current.recordVerifiedTurn({ turnNumber: 1, correct: true, support: 'carrier_or_full_model' });
      result.current.recordVerifiedTurn({ turnNumber: 1, correct: true, support: 'carrier_or_full_model' });
    });
    expect(result.current.__verifiedTurnCount()).toBe(1);
    await act(async () => { await result.current.flushAtSessionEnd('synthetic-session'); });
    const saved = vi.mocked(saveProgressionState).mock.calls[0][0];
    expect(saved.profileId).toBe(ids.profileId);
    expect(saved.exerciseSlug).toBe('conversation-coach');
    expect(saved.progressPct).toBe(25);
    await act(async () => { await result.current.flushAtSessionEnd('synthetic-session'); });
    expect(saveProgressionState).toHaveBeenCalledTimes(1);
  });

  it('requires a real confirmed event; empty sessions cannot generate progress', async () => {
    const { result } = renderHook(() => useConversationCoachProgression(ids));
    await waitFor(() => expect(result.current.verified).toBe(true));
    let outcome: { ok: boolean } | undefined;
    await act(async () => { outcome = await result.current.flushAtSessionEnd('synthetic-session'); });
    expect(outcome).toMatchObject({ ok: false, skipped: true });
    expect(saveProgressionState).not.toHaveBeenCalled();
  });

  it('holds a fully progressed L3 patient at L3 and cannot unlock unbuilt L4', async () => {
    vi.mocked(loadProgressionStateChecked).mockImplementation(async values => ({
      state: { ...defaultProgressionState(values), currentLevel: 3, stableLevel: 3, progressPct: 95 },
      verified: true, source: 'stored',
    }));
    const { result } = renderHook(() => useConversationCoachProgression(ids));
    await waitFor(() => expect(result.current.verified).toBe(true));
    act(() => result.current.recordVerifiedTurn({ turnNumber: 1, correct: true, support: 'independent' }));
    await act(async () => { await result.current.flushAtSessionEnd('synthetic-session'); });
    expect(vi.mocked(saveProgressionState).mock.calls[0][0]).toMatchObject({
      currentLevel: 3, progressPct: 100,
    });
  });

  it('an unverified initial read allows practice, but NEVER writes L1 over existing level', async () => {
    vi.mocked(loadProgressionStateChecked).mockImplementation(async values => ({
      state: defaultProgressionState(values), verified: false, source: 'unverified',
      error: 'synthetic RLS error',
    }));
    const { result } = renderHook(() => useConversationCoachProgression(ids));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.verified).toBe(false);
    act(() => result.current.recordVerifiedTurn({ turnNumber: 1, correct: true, support: 'independent' }));
    expect(result.current.__verifiedTurnCount()).toBe(0);
    await act(async () => { await result.current.flushAtSessionEnd('synthetic-session'); });
    expect(saveProgressionState).not.toHaveBeenCalled();
  });

  it('never overwrites a legacy L4+ row by forcibly clamping it to L3', async () => {
    vi.mocked(loadProgressionStateChecked).mockImplementation(async values => ({
      state: { ...defaultProgressionState(values), currentLevel: 6 }, verified: true, source: 'stored',
    }));
    const { result } = renderHook(() => useConversationCoachProgression(ids));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.level).toBe(3);
    expect(result.current.verified).toBe(false);
    await act(async () => { await result.current.flushAtSessionEnd('synthetic-session'); });
    expect(saveProgressionState).not.toHaveBeenCalled();
  });

  it('rejects late callbacks from a different patient profile', async () => {
    const { result, rerender } = renderHook(
      ({ profileId }) => useConversationCoachProgression({ userId: ids.userId, profileId }),
      { initialProps: { profileId: 'patient-a' } },
    );
    await waitFor(() => expect(result.current.verified).toBe(true));
    const oldCallback = result.current.recordVerifiedTurn;
    rerender({ profileId: 'patient-b' });
    act(() => oldCallback({ turnNumber: 1, correct: true, support: 'independent' }));
    await waitFor(() => expect(result.current.verified).toBe(true));
    expect(result.current.__verifiedTurnCount()).toBe(0);
    act(() => result.current.recordVerifiedTurn({ turnNumber: 1, correct: true, support: 'carrier_or_full_model' }));
    await act(async () => { await result.current.flushAtSessionEnd('session-b'); });
    expect(vi.mocked(saveProgressionState).mock.calls[0][0].profileId).toBe('patient-b');
  });
});
