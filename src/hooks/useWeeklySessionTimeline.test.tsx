import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localYYYYMMDD } from '@/lib/localDate';

const fixture = vi.hoisted(() => ({
  profileId: 'patient-a' as string | undefined,
  rows: {} as Record<string, Record<string, unknown>[]>,
  errors: {} as Record<string, { message: string } | null>,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        not: () => q,
        gte: () => q,
        order: () => q,
        in: () => q,
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
          return Promise.resolve({
            data: fixture.rows[table] ?? [],
            error: fixture.errors[table] ?? null,
          }).then(resolve, reject);
        },
      };
      return q;
    },
  },
}));

import { useWeeklySessionTimeline } from './useWeeklySessionTimeline';

function scoredEvent(
  id: string,
  score: number | null,
  extra: Record<string, unknown> = {},
) {
  return {
    session_id: 'session-1',
    attempt_id: id,
    exercise_slug: 'fix_sentence',
    score,
    counts_toward_score: true,
    validity_label: 'valid_attempt',
    clinician_validity_override: null,
    task_parameters: {},
    engagement_flags: {},
    outputs: null,
    error_type: null,
    audio_storage_path: null,
    browser_transcript: null,
    whisper_transcript: null,
    created_at: new Date().toISOString(),
    ...extra,
  };
}

beforeEach(() => {
  fixture.profileId = 'patient-a';
  fixture.errors = {};
  fixture.rows = {
    sessions: [{
      id: 'session-1',
      profile_id: fixture.profileId,
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      duration_sec: 12,
    }],
    exercise_events: [
      scoredEvent('one', 100),
      scoredEvent('two', 50),
      scoredEvent('three', 0),
      scoredEvent('noise', 0, { counts_toward_score: false, validity_label: 'background_noise' }),
      scoredEvent('manual', 100, { validity_label: 'manual_confirmed' }),
    ],
    utterance_analyses: [],
  };
});
afterEach(() => cleanup());

describe('PatientHub weekly session timeline uses eligible clinical task evidence', () => {
  it('reports short completed sessions and partial-credit mean without invalid trial inflation', async () => {
    const { result } = renderHook(() => useWeeklySessionTimeline(fixture.profileId));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.summary).toMatchObject({
      totalSessions: 1,
      activeDays: 1,
      totalTrials: 3,
      avgAccuracy: 50,
    });
    const today = result.current.dayGroups.find(day => day.date === localYYYYMMDD());
    expect(today).toMatchObject({
      totalTrials: 3,
      avgAccuracy: 50,
      sessions: [{
        id: 'session-1',
        totalTrials: 3,
        avgAccuracy: 50,
        exercises: [{
          slug: 'fix_sentence',
          trials: 3,
          accuracy: 50,
        }],
      }],
    });
  });

  it('does not turn no scorable attempts into fabricated measured accuracy', async () => {
    fixture.rows.exercise_events = [
      scoredEvent('noise', 0, { counts_toward_score: false }),
      scoredEvent('manual', 100, { validity_label: 'manual_confirmed' }),
    ];
    const { result } = renderHook(() => useWeeklySessionTimeline(fixture.profileId));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.summary).toMatchObject({
      totalSessions: 1,
      totalTrials: 0,
      avgAccuracy: null,
    });
    expect(result.current.dayGroups.find(day => day.date === localYYYYMMDD())?.avgAccuracy).toBeNull();
  });

  it.each(['sessions', 'exercise_events', 'utterance_analyses'])(
    'blocks publication of a normal clinical history when %s read fails',
    async table => {
      fixture.errors[table] = { message: 'Synthetic denied read' };
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        const { result } = renderHook(() => useWeeklySessionTimeline(fixture.profileId));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.error).toMatch(/unavailable/);
        expect(result.current.dayGroups).toEqual([]);
        expect(result.current.recordings).toEqual([]);
      } finally {
        errorSpy.mockRestore();
      }
    },
  );
});
