import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { format } from 'date-fns';

const fixture = vi.hoisted(() => ({
  profileId: 'synthetic-patient' as string | null,
  rows: {} as Record<string, Record<string, unknown>[]>,
  errors: {} as Record<string, { message: string } | null>,
  ranges: [] as Array<[string, number, number]>,
}));

vi.mock('./useProfile', () => ({
  useProfile: () => ({
    activeProfile: fixture.profileId ? { id: fixture.profileId } : null,
  }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      let page: [number, number] | null = null;
      const q = {
        select: () => q,
        eq: () => q,
        gte: () => q,
        not: () => q,
        order: () => q,
        in: () => q,
        range: (start: number, end: number) => {
          page = [start, end];
          fixture.ranges.push([table, start, end]);
          return q;
        },
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
          const all = fixture.rows[table] ?? [];
          const data = page ? all.slice(page[0], page[1] + 1) : all;
          return Promise.resolve({ data, error: fixture.errors[table] ?? null }).then(resolve, reject);
        },
      };
      return q;
    },
  },
}));

import { useWeeklyTrends } from './useWeeklyTrends';

function event(i: number, score: number, extra: Record<string, unknown> = {}) {
  return {
    id: 'attempt-' + i,
    session_id: 'synthetic-session',
    score,
    cue_level: 0,
    counts_toward_score: true,
    validity_label: null,
    exercise_slug: 'meaning_match',
    created_at: new Date().toISOString(),
    ...extra,
  };
}

beforeEach(() => {
  fixture.profileId = 'synthetic-patient';
  fixture.errors = {};
  fixture.ranges = [];
  fixture.rows = {
    sessions: [{
      id: 'synthetic-session',
      started_at: new Date().toISOString(),
      duration_sec: 67,
    }],
    exercise_events: [event(1, 100), event(2, 0)],
  };
});
afterEach(() => cleanup());

describe('seven-day clinician trends follow verified clinical evidence', () => {
  it('excludes invalid, manual and unscorable rows without inventing 0% failures', async () => {
    fixture.rows.exercise_events = [
      event(1, 100),
      event(2, 0),
      event(3, 0, { counts_toward_score: false, validity_label: 'no_response' }),
      event(4, 0, { validity_label: 'manual_confirmed' }),
      event(5, 100, { exercise_slug: 'conversation_coach' }),
    ];
    const { result } = renderHook(() => useWeeklyTrends());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    const today = format(new Date(), 'yyyy-MM-dd');
    const day = result.current.trends.find(d => d.date === today);
    expect(day).toMatchObject({
      totalTrials: 2,
      correctTrials: 1,
      accuracy: 50,
    });
  });

  it.each(['sessions', 'exercise_events'])(
    'does not display a normal trend if the %s evidence query fails', async table => {
      fixture.errors[table] = { message: 'Simulated read failure' };
      const originalError = console.error;
      console.error = vi.fn();
      try {
        const { result } = renderHook(() => useWeeklyTrends());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.trends).toEqual([]);
        expect(result.current.error).toMatch(/unavailable/i);
      } finally {
        console.error = originalError;
      }
    },
  );

  it('does not leave the report loading indefinitely with no patient selected', async () => {
    fixture.profileId = null;
    const { result } = renderHook(() => useWeeklyTrends());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.trends).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('retrieves every page for long clinical histories rather than truncating', async () => {
    fixture.rows.exercise_events = Array.from({ length: 501 }, (_, i) => event(i, i % 2 === 0 ? 100 : 0));
    const { result } = renderHook(() => useWeeklyTrends());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const day = result.current.trends.find(d => d.date === format(new Date(), 'yyyy-MM-dd'));
    expect(day).toMatchObject({
      totalTrials: 501,
      correctTrials: 251,
      accuracy: 50.1,
    });
    expect(fixture.ranges).toContainEqual(['exercise_events', 0, 499]);
    expect(fixture.ranges).toContainEqual(['exercise_events', 500, 999]);
  });
});
