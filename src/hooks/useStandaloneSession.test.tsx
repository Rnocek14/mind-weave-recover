import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ profileId: 'profile-1', startSession: vi.fn(), update: vi.fn(), lookup: vi.fn() }));
vi.mock('@/lib/sessionTracking', () => ({ startSession: mocks.startSession }));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ activeProfile: mocks.profileId ? { id: mocks.profileId } : null }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({
    update: (...args: unknown[]) => {
      mocks.update(...args);
      return { eq: () => ({ eq: () => ({ eq: () => ({ is: async () => ({ error: null }) }) }) }) };
    },
    select: () => ({ eq: (_field: string, id: string) => ({ maybeSingle: () => mocks.lookup(id) }) }),
  }) },
}));

import { clearStandaloneSessionMutex, useStandaloneSession } from './useStandaloneSession';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => { resolve = res; });
  return { promise, resolve };
}
async function flush() {
  await act(async () => {
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  });
}
beforeEach(() => {
  mocks.profileId = 'profile-1';
  mocks.startSession.mockReset();
  mocks.update.mockReset();
  mocks.lookup.mockReset();
  mocks.lookup.mockImplementation(async (id: string) => ({
    data: { id, user_id: 'user-2', profile_id: 'profile-2', ended_at: null }, error: null,
  }));
  sessionStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
});
afterEach(() => {
  cleanup();
  clearStandaloneSessionMutex();
  vi.useRealTimers();
});

describe('useStandaloneSession identity and concurrency regression', () => {
  it('waits past 250ms for one shared creation rather than stranding the second game', async () => {
    const pending = deferred<{ id: string }>();
    mocks.startSession.mockReturnValue(pending.promise);
    const first = renderHook(() => useStandaloneSession('user-1', null, 'two_clues'));
    const second = renderHook(() => useStandaloneSession('user-1', null, 'two_clues'));
    expect(mocks.startSession).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(750); });
    await act(async () => { pending.resolve({ id: 'session-owned-1' }); });
    await flush();
    expect(first.result.current.activeSessionId).toBe('session-owned-1');
    expect(second.result.current.activeSessionId).toBe('session-owned-1');
    expect(mocks.startSession).toHaveBeenCalledTimes(1);
  });

  it('never reuses the previous account session on a fresh hook', async () => {
    mocks.startSession.mockResolvedValueOnce({ id: 'session-for-user-1' })
      .mockResolvedValueOnce({ id: 'session-for-user-2' });
    const first = renderHook(() => useStandaloneSession('user-1', null, 'two_clues'));
    await flush();
    expect(first.result.current.activeSessionId).toBe('session-for-user-1');
    first.unmount();
    const second = renderHook(() => useStandaloneSession('user-2', null, 'two_clues'));
    expect(second.result.current.activeSessionId).not.toBe('session-for-user-1');
    await flush();
    expect(second.result.current.activeSessionId).toBe('session-for-user-2');
    expect(mocks.startSession).toHaveBeenCalledTimes(2);
  });

  it('never reuses the previous profile session under the same account', async () => {
    mocks.startSession.mockResolvedValueOnce({ id: 'patient-one-session' })
      .mockResolvedValueOnce({ id: 'patient-two-session' });
    const first = renderHook(() => useStandaloneSession('user-1', null, 'two_clues'));
    await flush();
    expect(first.result.current.activeSessionId).toBe('patient-one-session');
    first.unmount();
    mocks.profileId = 'profile-2';
    const second = renderHook(() => useStandaloneSession('user-1', null, 'two_clues'));
    await flush();
    expect(second.result.current.activeSessionId).toBe('patient-two-session');
    expect(mocks.startSession).toHaveBeenCalledTimes(2);
  });

  it('ignores late old-account resolution after identity changes mid-write', async () => {
    const old = deferred<{ id: string }>();
    const next = deferred<{ id: string }>();
    mocks.startSession.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const { result, rerender } = renderHook(
      ({ userId }) => useStandaloneSession(userId, null, 'two_clues'),
      { initialProps: { userId: 'user-1' } },
    );
    mocks.profileId = 'profile-2';
    rerender({ userId: 'user-2' });
    expect(result.current.activeSessionId).toBeNull();
    await act(async () => { old.resolve({ id: 'old-session' }); });
    await flush();
    expect(result.current.activeSessionId).not.toBe('old-session');
    await act(async () => { next.resolve({ id: 'new-session' }); });
    await flush();
    expect(result.current.activeSessionId).toBe('new-session');
    expect(mocks.startSession).toHaveBeenCalledTimes(2);
  });

  it('does not clear a newer patient session when an earlier session completes late', async () => {
    mocks.startSession.mockResolvedValueOnce({ id: 'first-session' })
      .mockResolvedValueOnce({ id: 'second-session' });
    const first = renderHook(() => useStandaloneSession('user-1', null, 'two_clues'));
    await flush();
    first.unmount();
    mocks.profileId = 'profile-2';
    const second = renderHook(() => useStandaloneSession('user-2', null, 'two_clues'));
    await flush();
    clearStandaloneSessionMutex('first-session');
    second.unmount();
    const again = renderHook(() => useStandaloneSession('user-2', null, 'two_clues'));
    await flush();
    expect(again.result.current.activeSessionId).toBe('second-session');
    expect(mocks.startSession).toHaveBeenCalledTimes(2);
  });
  it('reports failure and permits a patient to retry after network recovery', async () => {
    mocks.startSession.mockRejectedValueOnce(new Error('synthetic network error'))
      .mockResolvedValueOnce({ id: 'recovered-session' });
    const { result } = renderHook(() => useStandaloneSession('user-1', null, 'two_clues'));
    await flush();
    expect(result.current.activeSessionId).toBeNull();
    expect(result.current.isCreatingSession).toBe(false);
    expect(result.current.sessionError).toMatch(/Could not start this exercise/);
    await act(async () => { result.current.retrySession(); });
    await flush();
    expect(result.current.activeSessionId).toBe('recovered-session');
    expect(result.current.sessionError).toBeNull();
    expect(mocks.startSession).toHaveBeenCalledTimes(2);
  });

  it('verifies that a cached session is still open before reusing it', async () => {
    mocks.startSession.mockResolvedValueOnce({ id: 'already-ended' })
      .mockResolvedValueOnce({ id: 'new-session' });
    const first = renderHook(() => useStandaloneSession('user-1', null, 'two_clues'));
    await flush();
    first.unmount();
    mocks.lookup.mockResolvedValueOnce({
      data: { id: 'already-ended', user_id: 'user-1', profile_id: 'profile-1', ended_at: '2026-10-28T00:00:00Z' },
      error: null,
    });
    const second = renderHook(() => useStandaloneSession('user-1', null, 'two_clues'));
    await flush();
    expect(mocks.lookup).toHaveBeenCalledWith('already-ended');
    expect(second.result.current.activeSessionId).toBe('new-session');
    expect(mocks.startSession).toHaveBeenCalledTimes(2);
  });

  it('fails closed on an unverifiable cached session instead of creating a duplicate', async () => {
    mocks.startSession.mockResolvedValueOnce({ id: 'unverified-session' });
    const first = renderHook(() => useStandaloneSession('user-1', null, 'two_clues'));
    await flush();
    first.unmount();
    mocks.lookup.mockResolvedValueOnce({ data: null, error: { message: 'synthetic API outage' } });
    const second = renderHook(() => useStandaloneSession('user-1', null, 'two_clues'));
    await flush();
    expect(second.result.current.activeSessionId).toBeNull();
    expect(second.result.current.sessionError).toMatch(/Could not start this exercise/);
    expect(mocks.startSession).toHaveBeenCalledTimes(1);
  });

  it('respects externally owned lesson sessions and disabled callers', async () => {
    const lesson = renderHook(() => useStandaloneSession('user-1', 'lesson-session-1', 'two_clues'));
    const blocked = renderHook(() => useStandaloneSession('user-1', null, 'two_clues', { disabled: true }));
    await flush();
    expect(lesson.result.current.activeSessionId).toBe('lesson-session-1');
    expect(blocked.result.current.activeSessionId).toBeNull();
    expect(mocks.startSession).not.toHaveBeenCalled();
  });

});
