import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => ({
  result: vi.fn(),
  selected: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'exercise_events') throw new Error('Unexpected audit table');
      return {
        select: (columns: string) => {
          query.selected(columns);
          return { eq: () => query.result() };
        },
      };
    },
  },
}));

import { computeSessionAccuracySummary } from '@/lib/sessionAccuracySummary';

describe('Clinical session summary source read integrity', () => {
  beforeEach(() => {
    query.result.mockReset();
    query.selected.mockReset();
  });

  it('rejects a failed exercise-event read instead of reporting zero attempts', async () => {
    query.result.mockResolvedValue({ data: null, error: { message: 'synthetic network outage' } });
    await expect(computeSessionAccuracySummary('session-1')).rejects.toThrow(/session accuracy.*unavailable/i);
    expect(query.selected).toHaveBeenCalledTimes(1);
  });

  it('rejects a null response without a server error instead of fabricating an empty session', async () => {
    query.result.mockResolvedValue({ data: null, error: null });
    await expect(computeSessionAccuracySummary('session-1')).rejects.toThrow(/session accuracy.*unavailable/i);
  });

  it('rejects a thrown connection error rather than returning misleading zero-denominator metrics', async () => {
    query.result.mockRejectedValue(new Error('synthetic fetch failed'));
    await expect(computeSessionAccuracySummary('session-1')).rejects.toThrow(/session accuracy.*unavailable/i);
  });

  it('treats an explicitly successful empty database result as real insufficient data', async () => {
    query.result.mockResolvedValue({ data: [], error: null });
    const result = await computeSessionAccuracySummary('session-1');
    expect(result).toMatchObject({
      accuracy: null,
      asr_accuracy: null,
      practice_accuracy: null,
      scored_trials: 0,
      asr_scored_trials: 0,
    });
  });

  it('preserves the true selected answer/quiz accuracy but does not fabricate ASR', async () => {
    query.result.mockResolvedValue({
      data: [{
        score: 100,
        cue_level: 0,
        counts_toward_score: true,
        validity_label: null,
        exercise_slug: 'meaning_match',
        task_parameters: { trial_mode: 'recognition' },
        browser_transcript: null,
        whisper_transcript: null,
      }],
      error: null,
    });
    const result = await computeSessionAccuracySummary('session-1');
    expect(result.accuracy).toBe(100);
    expect(result.asr_accuracy).toBeNull();
    expect(result.asr_scored_trials).toBe(0);
  });
});
