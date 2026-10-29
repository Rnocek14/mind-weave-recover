import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  failedTable: '' as string,
  profile: 'synthetic-patient' as string | undefined,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      let priorPeriod = false;
      let requestedIds: string[] | null = null;
      const q = {
        select: () => q,
        eq: () => q,
        not: () => q,
        gte: () => q,
        lt: () => { priorPeriod = true; return q; },
        in: (_field: string, value: string[]) => {
          requestedIds = value;
          return q;
        },
        order: () => q,
        limit: () => q,
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
          const errored = fixture.failedTable === table || (
            fixture.failedTable === 'prior_sessions' && table === 'sessions' && priorPeriod
          );
          const data = table === 'sessions'
            ? priorPeriod ? [{ id: 'session-prior' }] : [{
                id: 'session-recent', ended_at: new Date().toISOString(), duration_sec: 15,
              }]
            : table === 'exercise_events'
              ? requestedIds?.includes('session-prior')
                ? [
                  { score: 80, counts_toward_score: true, validity_label: 'valid_attempt' },
                ]
                : [
                  { score: 100, counts_toward_score: true, validity_label: 'valid_attempt' },
                  { score: 0, counts_toward_score: true, validity_label: 'valid_attempt' },
                  { score: 0, counts_toward_score: false, validity_label: 'background_noise' },
                ]
              : table === 'learning_rates' ? [{ accuracy_slope: 0.02 }] : [];
          return Promise.resolve({
            data: errored ? null : data,
            error: errored ? { message: 'Synthetic denied query' } : null,
          }).then(resolve, reject);
        },
      };
      return q;
    },
  },
}));

import { useWeeklySessionStats } from './useWeeklySessionStats';

beforeEach(() => {
  fixture.failedTable = '';
  fixture.profile = 'synthetic-patient';
});
afterEach(() => cleanup());

describe('PatientHub weekly session stats evidence boundaries', () => {
  it('includes a valid short session and uses actual distinct prior-week denominator', async () => {
    const { result } = renderHook(() => useWeeklySessionStats(fixture.profile));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({
      trialCount: 2,
      priorTrialCount: 1,
      sessionCount: 1,
      avgAccuracy: 50,
      priorAvgAccuracy: 80,
      accuracySlope: 0.02,
      error: null,
    });
  });

  it.each(['sessions', 'exercise_events', 'learning_rates', 'prior_sessions'])(
    'does not report normal zero statistics when %s verification fails', async table => {
      fixture.failedTable = table;
      const warn = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        const { result } = renderHook(() => useWeeklySessionStats(fixture.profile));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.error).toMatch(/unavailable/i);
        expect(result.current.avgAccuracy).toBeNull();
        expect(result.current.priorAvgAccuracy).toBeNull();
        expect(result.current.trialCount).toBe(0);
      } finally { warn.mockRestore(); }
    },
  );
});
