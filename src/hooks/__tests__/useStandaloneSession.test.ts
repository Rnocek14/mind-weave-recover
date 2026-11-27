import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStandaloneSession } from '../useStandaloneSession';
import { startSession } from '@/lib/sessionTracking';

let profile = { id: 'first-patient', user_id: 'family' };
vi.mock('@/hooks/useProfile', () => ({ useProfile: () => ({ activeProfile: profile }) }));
vi.mock('@/lib/sessionTracking', () => ({ startSession: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ update: () => ({ eq: () => ({ is: vi.fn().mockResolvedValue({ error: null }) }) }) }) },
}));

describe('standalone practice session ownership', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
    profile = { id: 'first-patient', user_id: 'family' };
  });

  it('resumes the same patient on remount and opens a new session when the family switches patients', async () => {
    vi.mocked(startSession).mockImplementation(async (_user, _plan, options) => ({
      id: typeof options === 'object' ? options.profileId : undefined,
    }));
    const run = () => useStandaloneSession('family', null, 'photo_naming');
    const first = renderHook(run);
    await waitFor(() => expect(first.result.current.activeSessionId).toBe('first-patient'));
    first.unmount();
    const second = renderHook(run);
    await waitFor(() => expect(second.result.current.activeSessionId).toBe('first-patient'));
    expect(startSession).toHaveBeenCalledTimes(1);
    profile = { id: 'second-patient', user_id: 'family' };
    second.rerender();
    expect(second.result.current.activeSessionId).not.toBe('first-patient');
    await waitFor(() => expect(second.result.current.activeSessionId).toBe('second-patient'));
    second.unmount();
    profile = { id: 'first-patient', user_id: 'family' };
    const third = renderHook(run);
    await waitFor(() => expect(third.result.current.activeSessionId).toBe('first-patient'));
  });

  it('shares pending creation on remount and ignores a late result for another patient', async () => {
    let finishFirst!: (session: { id: string }) => void;
    vi.mocked(startSession)
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
      .mockResolvedValueOnce({ id: 'second-session' });
    const run = () => useStandaloneSession('family', null, 'photo_naming');
    const first = renderHook(run);
    first.unmount();
    const current = renderHook(run);
    expect(startSession).toHaveBeenCalledTimes(1);
    profile = { id: 'second-patient', user_id: 'family' };
    current.rerender();
    await waitFor(() => expect(current.result.current.activeSessionId).toBe('second-session'));
    await act(async () => { finishFirst({ id: 'late-first-session' }); });
    expect(current.result.current.activeSessionId).toBe('second-session');
    current.unmount();
    const reopened = renderHook(run);
    await waitFor(() => expect(reopened.result.current.activeSessionId).toBe('second-session'));
    expect(startSession).toHaveBeenCalledTimes(2);
  });

  it('ignores an older cache without an owner and waits for the new account’s profile', async () => {
    sessionStorage.setItem('standaloneSessionMutex', JSON.stringify({
      exerciseSlug: 'photo_naming', createdAt: Date.now(), sessionId: 'unknown-owner',
    }));
    vi.mocked(startSession).mockResolvedValue({ id: 'new-session' });
    const current = renderHook(() => useStandaloneSession('new-account', null, 'photo_naming'));
    expect(current.result.current.activeSessionId).toBeNull();
    expect(startSession).not.toHaveBeenCalled();
    profile = { id: 'new-patient', user_id: 'new-account' };
    current.rerender();
    await waitFor(() => expect(current.result.current.activeSessionId).toBe('new-session'));
    expect(startSession).toHaveBeenCalledTimes(1);
  });
});
