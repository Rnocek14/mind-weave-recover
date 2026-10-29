import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  accuracyRead: vi.fn(),
  summaryFields: vi.fn(),
  updateResult: vi.fn(),
  updates: vi.fn(),
  completedEvent: vi.fn(),
  clearMutex: vi.fn(),
  profileRefresh: vi.fn(),
  masteryFlush: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'sessions') throw new Error('Unexpected non-session write in zero-duration regression');
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { summary: { mode: 'standalone' } }, error: null }) }) }),
        update: (...args: unknown[]) => {
          mocks.updates(...args);
          return {
            eq: () => ({
              is: () => {
                // The current code awaits .is() directly; a confirmed-write
                // implementation may append .select('id'). This works for both
                // revisions without simulating a successful write.
                const response = Promise.resolve().then(() => mocks.updateResult());
                return Object.assign(response, { select: () => response });
              },
            }),
          };
        },
      };
    },
  },
}));
vi.mock('@/lib/sessionAccuracySummary', () => ({
  computeSessionAccuracySummary: mocks.accuracyRead,
  accuracySummaryToSummaryFields: mocks.summaryFields,
}));
vi.mock('@/lib/postSessionProfileRefresh', () => ({
  triggerPostSessionProfileRefresh: mocks.profileRefresh,
}));
vi.mock('@/lib/mastery/flushMasteryShadow', () => ({ flushMasteryShadow: mocks.masteryFlush }));
vi.mock('@/hooks/useStandaloneSession', () => ({ clearStandaloneSessionMutex: mocks.clearMutex }));
vi.mock('@/lib/appEvents', () => ({
  trackEvent: mocks.completedEvent,
  FUNNEL_EVENTS: { SESSION_COMPLETED: 'session_completed' },
}));

import { useSessionLifecycle } from './useSessionLifecycle';

function useSubject() {
  return renderHook(() => useSessionLifecycle({
    sessionId: 'test-session',
    userId: 'synthetic-user',
    profileId: 'synthetic-profile',
    exerciseSlug: 'meaning_match',
    ownedByParentFlow: false,
    getSessionStats: () => ({ score: 100, totalTrials: 2, startTime: Date.now() }),
  }));
}
async function complete(result: ReturnType<typeof useSubject>) {
  let saved: unknown;
  await act(async () => { saved = await result.result.current.completeSession(); });
  return saved;
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.accuracyRead.mockResolvedValue({ accuracy: 50, scored_trials: 2 });
  mocks.summaryFields.mockReturnValue({ accuracy: 50, scored_trials: 2 });
  mocks.updateResult.mockResolvedValue({ data: [{ id: 'test-session' }], error: null });
  mocks.profileRefresh.mockResolvedValue(undefined);
  mocks.masteryFlush.mockResolvedValue(undefined);
});

describe('Session completion verification — no fabricated patient success', () => {
  it('does not emit SESSION_COMPLETED when scored-event read failed', async () => {
    mocks.accuracyRead.mockRejectedValue(new Error('Session accuracy evidence unavailable'));
    const subject = useSubject();
    const outcome = await complete(subject);
    expect(outcome).toBe(false);
    expect(mocks.updates).not.toHaveBeenCalled();
    expect(mocks.completedEvent).not.toHaveBeenCalled();
    expect(mocks.clearMutex).not.toHaveBeenCalled();
    expect(subject.result.current.isEnded()).toBe(false);
  });

  it('does not emit SESSION_COMPLETED or clear the mutex on a failed database update', async () => {
    mocks.updateResult.mockResolvedValue({ data: null, error: { message: 'synthetic update failed' } });
    const subject = useSubject();
    const outcome = await complete(subject);
    expect(outcome).toBe(false);
    expect(mocks.completedEvent).not.toHaveBeenCalled();
    expect(mocks.clearMutex).not.toHaveBeenCalled();
    expect(subject.result.current.isEnded()).toBe(false);
  });

  it('does not report success on an unconfirmed zero-row UPDATE (already ended or RLS denied)', async () => {
    mocks.updateResult.mockResolvedValue({ data: [], error: null });
    const subject = useSubject();
    const outcome = await complete(subject);
    expect(outcome).toBe(false);
    expect(mocks.completedEvent).not.toHaveBeenCalled();
    expect(mocks.clearMutex).not.toHaveBeenCalled();
  });

  it('tracks completion exactly once only after a confirmed update', async () => {
    const subject = useSubject();
    const saved = await complete(subject);
    expect(saved).toBe(true);
    expect(mocks.updates).toHaveBeenCalledTimes(1);
    expect(mocks.completedEvent).toHaveBeenCalledTimes(1);
    expect(mocks.completedEvent).toHaveBeenCalledWith('session_completed', expect.objectContaining({ session_id: 'test-session' }));
    expect(mocks.clearMutex).toHaveBeenCalledWith('test-session');
    await complete(subject);
    expect(mocks.completedEvent).toHaveBeenCalledTimes(1);
    expect(mocks.updates).toHaveBeenCalledTimes(1);
  });
});
