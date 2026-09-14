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
  // A Photo Naming TAP: the background analysis still upserts an utterance row
  // — empty transcript, an error_type produced by classifying nothing, no
  // verdict, and counts_toward_score at its DB default (true).
  { attempt_id: 'a2', target_word: 'dog', transcript: '', is_correct: true, exercise_slug: 'photo_naming', latency_ms: 1500, error_type: 'phonemic_paraphasia', cue_type_given: null, cue_was_effective: null, audio_storage_path: 'clips/a2.webm', recording_duration_ms: 300, pronunciation_status: null, semantic_similarity: null, phonological_similarity: null, stuck_type: null, speech_rate_wpm: null, created_at: '2026-09-14T10:01:00Z', validity_label: null, validity_reason: null, counts_toward_score: true, clinician_validity_override: null, gop_data: null, pause_count: null, effortful_speech: null },
  // A spoken attempt whose utterance row carries no verdict; the events row does.
  { attempt_id: 'a3', target_word: 'sun', transcript: 'um', is_correct: false, exercise_slug: 'photo_naming', latency_ms: 2000, error_type: 'no_response', cue_type_given: null, cue_was_effective: null, audio_storage_path: 'clips/a3.webm', recording_duration_ms: 1200, pronunciation_status: null, semantic_similarity: 0, phonological_similarity: 0, stuck_type: null, speech_rate_wpm: null, created_at: '2026-09-14T10:02:00Z', validity_label: null, validity_reason: null, counts_toward_score: true, clinician_validity_override: null, gop_data: null, pause_count: null, effortful_speech: null },
];
const EE = [
  // The same Photo Naming attempt also has an events row — must not double up.
  { attempt_id: 'a1', exercise_slug: 'photo_naming', score: 100, reaction_time_ms: 800, error_type: 'correct', cue_type_given: null, cue_was_effective: null, cue_level: 0, audio_storage_path: null, recording_duration_ms: 900, semantic_similarity: 1, phonological_similarity: 1, browser_transcript: 'cat', whisper_transcript: null, task_parameters: { target_word: 'cat', trial_mode: 'production' }, outputs: null, created_at: '2026-09-14T10:00:00Z', validity_label: 'valid_attempt', validity_reason: null, counts_toward_score: true, clinician_validity_override: null, acoustic_metrics: null },
  // The tap's events row: the gate verdict, trial_mode and support live here.
  { attempt_id: 'a2', exercise_slug: 'photo_naming', score: 100, reaction_time_ms: 1500, error_type: 'correct', cue_type_given: null, cue_was_effective: null, cue_level: 0, audio_storage_path: null, recording_duration_ms: null, semantic_similarity: null, phonological_similarity: null, browser_transcript: null, whisper_transcript: null, task_parameters: { expected_response: 'dog', trial_mode: 'recognition', support_used: 'recognition_only' }, outputs: null, created_at: '2026-09-14T10:01:00Z', validity_label: 'recognition_response', validity_reason: 'Answered by tapping a choice', counts_toward_score: false, clinician_validity_override: null, acoustic_metrics: null },
  { attempt_id: 'a3', exercise_slug: 'photo_naming', score: 0, reaction_time_ms: 2000, error_type: 'no_response', cue_type_given: null, cue_was_effective: null, cue_level: 0, audio_storage_path: null, recording_duration_ms: 1200, semantic_similarity: 0, phonological_similarity: 0, browser_transcript: null, whisper_transcript: 'um', task_parameters: { expected_response: 'sun', trial_mode: 'production' }, outputs: null, created_at: '2026-09-14T10:02:00Z', validity_label: 'filler_only', validity_reason: 'Filler only', counts_toward_score: false, clinician_validity_override: null, acoustic_metrics: null },
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

import { useSessionDetail, mergeAttemptRows, type TrialData } from '@/hooks/useSessionDetail';

describe('useSessionDetail merges voice and choice trials', () => {
  it('lists the Minimal Pairs trial alongside the Photo Naming one, without duplicating shared attempts', async () => {
    const { result } = renderHook(() => useSessionDetail());
    await act(async () => {
      await result.current.fetchTrials('s1');
    });
    await waitFor(() => expect(result.current.trials.length).toBeGreaterThan(0));
    const trials = result.current.trials;
    expect(trials.map((t) => t.attempt_id)).toEqual(['a1', 'a2', 'a3', 'b1']);
    expect(trials.find((t) => t.attempt_id === 'a1')?.source_table).toBe('utterance_analyses');
    const mp = trials.find((t) => t.attempt_id === 'b1');
    expect(mp?.source_table).toBe('exercise_events');
    expect(mp?.is_correct).toBe(false);
    expect(mp?.trial_mode).toBe('recognition');
  });

  it('a Photo Naming tap with BOTH rows reviews as a tap: verdict, trial_mode and correctness from the events row', async () => {
    const { result } = renderHook(() => useSessionDetail());
    await act(async () => {
      await result.current.fetchTrials('s1');
    });
    await waitFor(() => expect(result.current.trials.length).toBe(4));
    const tap = result.current.trials.find((t) => t.attempt_id === 'a2')!;
    expect(tap.trial_mode).toBe('recognition');
    expect(tap.validity_label).toBe('recognition_response');
    expect(tap.counts_toward_score).toBe(false);
    expect(tap.is_correct).toBe(true);
    expect(tap.error_type).toBe('correct'); // not the paraphasia classified from an empty transcript
    expect(tap.target_word).toBe('dog');
    expect(tap.audio_storage_path).toBe('clips/a2.webm'); // clip evidence still reachable
  });

  it('a spoken attempt whose utterance row has no verdict takes the gate verdict from the events row', async () => {
    const { result } = renderHook(() => useSessionDetail());
    await act(async () => {
      await result.current.fetchTrials('s1');
    });
    await waitFor(() => expect(result.current.trials.length).toBe(4));
    const spoken = result.current.trials.find((t) => t.attempt_id === 'a3')!;
    expect(spoken.source_table).toBe('utterance_analyses');
    expect(spoken.transcript).toBe('um');
    expect(spoken.trial_mode).toBe('production');
    expect(spoken.validity_label).toBe('filler_only');
    expect(spoken.counts_toward_score).toBe(false);
  });

  it('mergeAttemptRows never lets an events row overwrite a verdict the utterance row already carries', () => {
    const ua = { attempt_id: 'x', target_word: 'cat', transcript: 'cat', is_correct: true, validity_label: 'valid_attempt', counts_toward_score: true, clinician_validity_override: 'patient', source_table: 'utterance_analyses' } as unknown as TrialData;
    const ev = { attempt_id: 'x', target_word: '', transcript: null, is_correct: true, validity_label: 'low_confidence', counts_toward_score: false, trial_mode: 'production', taskParameters: { difficulty: 3 }, source_table: 'exercise_events' } as unknown as TrialData;
    const merged = mergeAttemptRows(ua, ev);
    expect(merged.validity_label).toBe('valid_attempt');
    expect(merged.counts_toward_score).toBe(true);
    expect(merged.clinician_validity_override).toBe('patient');
    expect(merged.trial_mode).toBe('production');
    expect(merged.taskParameters).toEqual({ difficulty: 3 });
    expect(merged.source_table).toBe('utterance_analyses');
  });
});
