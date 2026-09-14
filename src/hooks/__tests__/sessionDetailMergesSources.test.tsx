/**
 * Session Review must show every game a session contained.
 *
 * Voice games write utterance_analyses; choice games write exercise_events
 * only. The detail hook used the events table ONLY when a session had zero
 * utterance rows, so a session of Photo Naming followed by Minimal Pairs
 * reviewed as Photo Naming alone — the Minimal Pairs trials, their errors and
 * their accuracy simply were not there for the clinician.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const UA = [
  { attempt_id: 'a1', target_word: 'cat', transcript: 'cat', is_correct: true, exercise_slug: 'photo_naming', latency_ms: 800, error_type: 'correct', cue_type_given: null, cue_was_effective: null, audio_storage_path: null, recording_duration_ms: 900, pronunciation_status: null, semantic_similarity: 1, phonological_similarity: 1, stuck_type: null, speech_rate_wpm: null, created_at: '2026-09-14T10:00:00Z', validity_label: 'valid_attempt', validity_reason: null, counts_toward_score: true, clinician_validity_override: null, gop_data: null, pause_count: null, effortful_speech: null },
];
const EE = [
  // The same Photo Naming attempt also has an events row — must not double up.
  { attempt_id: 'a1', exercise_slug: 'photo_naming', score: 100, reaction_time_ms: 800, error_type: 'correct', cue_type_given: null, cue_was_effective: null, cue_level: 0, audio_storage_path: null, recording_duration_ms: 900, semantic_similarity: 1, phonological_similarity: 1, browser_transcript: 'cat', whisper_transcript: null, task_parameters: { target_word: 'cat', trial_mode: 'production' }, outputs: null, created_at: '2026-09-14T10:00:00Z', validity_label: 'valid_attempt', validity_reason: null, counts_toward_score: true, clinician_validity_override: null, acoustic_metrics: null },
  // A Minimal Pairs trial from the same session: events only.
  { attempt_id: 'b1', exercise_slug: 'minimal_pairs', score: 0, reaction_time_ms: 1200, error_type: null, cue_type_given: null, cue_was_effective: null, cue_level: 0, audio_storage_path: null, recording_duration_ms: null, semantic_similarity: null, phonological_similarity: null, browser_transcript: null, whisper_transcript: null, task_parameters: { target_word: 'pat', trial_mode: 'recognition' }, outputs: null, created_at: '2026-09-14T10:05:00Z', validity_label: null, validity_reason: null, counts_toward_score: null, clinician_validity_override: null, acoustic_metrics: null },
];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: table === 'utterance_analyses' ? UA : EE, error: null }),
        }),
      }),
    }),
  },
}));

import { useSessionDetail } from '@/hooks/useSessionDetail';

describe('useSessionDetail merges voice and choice trials', () => {
  it('lists the Minimal Pairs trial alongside the Photo Naming one, without duplicating shared attempts', async () => {
    const { result } = renderHook(() => useSessionDetail());
    await act(async () => {
      await result.current.fetchTrials('s1');
    });
    await waitFor(() => expect(result.current.trials.length).toBeGreaterThan(0));
    const trials = result.current.trials;
    expect(trials.map((t) => t.attempt_id)).toEqual(['a1', 'b1']);
    expect(trials.find((t) => t.attempt_id === 'a1')?.source_table).toBe('utterance_analyses');
    const mp = trials.find((t) => t.attempt_id === 'b1');
    expect(mp?.source_table).toBe('exercise_events');
    expect(mp?.is_correct).toBe(false);
    expect(mp?.trial_mode).toBe('recognition');
  });
});
