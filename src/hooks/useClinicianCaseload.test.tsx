import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  errors: {} as Record<string, { message: string } | null>,
  pageRanges: [] as Array<[string, number, number]>,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'synthetic-clinician' } }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      let page: [number, number] | null = null;
      const q = {
        select: () => q,
        eq: () => q,
        in: () => q,
        order: () => q,
        not: () => q,
        is: () => q,
        gte: () => q,
        range: (start: number, end: number) => {
          page = [start, end];
          fixture.pageRanges.push([table, start, end]);
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

import { useClinicianCaseload } from './useClinicianCaseload';

function event(index: number, score: number, overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-' + index,
    session_id: 'synthetic-session',
    score,
    cue_level: 0,
    counts_toward_score: true,
    validity_label: null,
    exercise_slug: 'meaning_match',
    task_parameters: { trial_mode: 'recognition' },
    engagement_flags: null,
    whisper_transcript: null,
    browser_transcript: null,
    ...overrides,
  };
}

beforeEach(() => {
  fixture.rows = {
    profiles: [{
      id: 'synthetic-profile', user_id: 'synthetic-user',
      profile_name: 'Synthetic patient', stroke_date: null,
      clinical_profile: null, is_active: true, aphasia_type: null,
      laterality: null, chronicity_tag: null, stroke_mechanism_tag: null,
    }],
    sessions: [{
      id: 'synthetic-session', profile_id: 'synthetic-profile',
      ended_at: new Date().toISOString(), duration_sec: 12,
    }],
    exercise_events: [event(1, 100), event(2, 0)],
    recovery_alerts: [],
    dose_logs: [],
  };
  fixture.errors = {};
  fixture.pageRanges = [];
});
afterEach(() => cleanup());

describe('clinician caseload safe clinical evidence aggregation', () => {
  it('counts short-but-saved sessions and excludes explicitly invalid trials', async () => {
    fixture.rows.exercise_events = [
      event(1, 0),
      event(2, 100, { counts_toward_score: false, validity_label: 'background_noise' }),
      event(3, 100, { validity_label: 'manual_confirmed' }),
    ];

    const { result } = renderHook(() => useClinicianCaseload());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.patients).toHaveLength(1);
    expect(result.current.patients[0]).toMatchObject({
      trials7d: 1,
      avgAccuracy7d: 0,
      accuracyDelta7d: null,
      trend: 'unknown',
    });
  });

  it.each([
    'sessions',
    'exercise_events',
    'recovery_alerts',
    'dose_logs',
  ])('does not publish a misleading zero metric when %s fetching fails', async (table) => {
    fixture.errors[table] = { message: 'Simulated denied/failed read' };
    const { result } = renderHook(() => useClinicianCaseload());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toMatch(/Clinical metrics unavailable/);
    expect(result.current.patients).toEqual([]);
    expect(result.current.lastUpdatedAt).toBeNull();
  });

  it('fetches event pages beyond 500 rows before calculating clinician totals', async () => {
    fixture.rows.exercise_events = Array.from({ length: 501 }, (_, i) => event(i, i % 2 ? 0 : 100));
    const { result } = renderHook(() => useClinicianCaseload());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.patients[0].trials7d).toBe(501);
    expect(result.current.patients[0].avgAccuracy7d).toBe(50);
    expect(fixture.pageRanges).toContainEqual(['exercise_events', 0, 499]);
    expect(fixture.pageRanges).toContainEqual(['exercise_events', 500, 999]);
  });
});
