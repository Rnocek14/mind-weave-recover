import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';

const deps = vi.hoisted(() => ({ start: vi.fn(), open: vi.fn(), profileId: 'patient-a' }));
vi.mock('@/hooks/useProfile', () => ({ useProfile: () => ({ activeProfile: { id: deps.profileId } }) }));
vi.mock('@/lib/sessionTracking', () => ({ startSession: deps.start }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => {
  const query = { select: () => query, eq: () => query, is: () => query,
    update: () => query, maybeSingle: deps.open };
  return query;
} } }));
const mount = () => renderHook(() => useStandaloneSession('owner', null, 'photo-naming'));
const cached = () => sessionStorage.setItem('standaloneSessionMutex', JSON.stringify({
  createdAt: Date.now(), exerciseSlug: 'photo_naming', sessionId: 'first',
}));
beforeEach(() => {
  sessionStorage.clear(); vi.clearAllMocks(); deps.profileId = 'patient-a';
  deps.start.mockResolvedValue({ id: 'second' }); deps.open.mockResolvedValue({ data: null, error: null });
});

describe('standalone session identity', () => {
  it('opens a new session when a completed session remains in device storage', async () => {
    cached(); const h = mount();
    await waitFor(() => expect(h.result.current.activeSessionId).toBe('second'));
    expect(deps.start).toHaveBeenCalledTimes(1);
  });
  it('recovers a still-open owned session from the previous build without creating another', async () => {
    cached(); deps.open.mockResolvedValue({ data: { id: 'first' }, error: null });
    const h = mount(); await waitFor(() => expect(h.result.current.activeSessionId).toBe('first'));
    expect(deps.start).not.toHaveBeenCalled();
  });
  it('shares a slow acquisition across an unmount and immediate remount', async () => {
    let resolve!: (result: {id: string}) => void;
    deps.start.mockReturnValue(new Promise(r => { resolve = r; }));
    const first = mount(); await waitFor(() => expect(deps.start).toHaveBeenCalled()); first.unmount();
    const remount = mount(); await act(async () => resolve({id: 'one-session'}));
    await waitFor(() => expect(remount.result.current.activeSessionId).toBe('one-session'));
    expect(deps.start).toHaveBeenCalledTimes(1);
  });
});
