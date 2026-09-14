/**
 * A tapped choice is a recognition response, not a silent speech attempt.
 *
 * Photo Naming ran the speech validity gate on every answer, including taps.
 * A tap has no recording, so the gate returned `no_response` ("recording too
 * short") with counts_toward_score false — and a patient who tapped ten
 * pictures correctly reduced to scored_trials 0, participation_trials 0, no
 * session accuracy at all. Meanwhile the same tap was compared with the target
 * by the speech-error classifier, so choosing the foil "tree" for "three" was
 * recorded as a phonemic paraphasia.
 *
 * The contract now: a tap is labelled recognition_response — scored on the
 * choice, counted for participation and practice, kept out of every speech
 * accuracy series and (per the progression spec) out of expressive levels.
 */
import { describe, it, expect } from 'vitest';
import { classifyUtteranceValidity } from '../classifyUtteranceValidity';
import { applyValidityGate } from '../applyValidityGate';
import { reduceAccuracy } from '@/lib/sessionAccuracySummary';
import { categoryOfTrial, isTapResponse } from '@/components/patient-hub/review/ErrorPatternBreakdown';
import type { TrialData } from '@/hooks/useSessionDetail';

describe('recognition (tap) responses', () => {
  it('a tap is a recognition_response, never no_response', () => {
    // Exactly what a chip tap hands the gate: no transcript, no recording.
    const asSpeech = classifyUtteranceValidity({ transcript: '', recordingDurationMs: 0 });
    expect(asSpeech.validity).toBe('no_response');

    const asTap = classifyUtteranceValidity({
      responseMode: 'tap',
      transcript: '',
      recordingDurationMs: 0,
    });
    expect(asTap.validity).toBe('recognition_response');
    expect(asTap.countsTowardScore, 'must not enter speech/ASR accuracy').toBe(false);
    expect(asTap.countsTowardParticipation).toBe(true);
    expect(asTap.countsTowardPracticeAccuracy).toBe(true);
    expect(asTap.confidence).toBe(1);
  });

  it('the gate treats it as a real response, not a clip to exclude', () => {
    const gated = applyValidityGate(
      classifyUtteranceValidity({ responseMode: 'tap', transcript: '', recordingDurationMs: 0 }),
    );
    expect(gated.shouldFeedAdaptation).toBe(true);
    expect(gated.shouldCountParticipation).toBe(true);
    expect(gated.shouldCountPracticeAccuracy).toBe(true);
    expect(gated.shouldCountAsrAccuracy).toBe(false);
    expect(gated.bucket).toBe('valid');
  });

  it('a chip-only session has recognition accuracy and participation, and clean speech accuracy stays empty', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      score: i < 9 ? 100 : 0,
      cue_level: 0,
      counts_toward_score: false,
      validity_label: 'recognition_response',
      exercise_slug: 'photo_naming',
    }));
    const acc = reduceAccuracy(rows);
    expect(acc.recognition_trials).toBe(10);
    expect(acc.recognition_accuracy).toBe(90);
    expect(acc.participation_trials).toBe(10);
    expect(acc.practice_accuracy).toBe(90);
    // The ASR series must not be contaminated by taps.
    expect(acc.accuracy).toBeNull();
    expect(acc.asr_accuracy).toBeNull();
    expect(acc.scored_trials).toBe(0);
    expect(acc.independent_trials).toBe(0);
  });

  it('a mixed session keeps spoken and tapped answers in separate series', () => {
    const acc = reduceAccuracy([
      { score: 100, cue_level: 0, counts_toward_score: true, validity_label: 'valid_attempt', exercise_slug: 'photo_naming' },
      { score: 0, cue_level: 0, counts_toward_score: true, validity_label: 'valid_attempt', exercise_slug: 'photo_naming' },
      { score: 100, cue_level: 0, counts_toward_score: false, validity_label: 'recognition_response', exercise_slug: 'photo_naming' },
      { score: 100, cue_level: 0, counts_toward_score: false, validity_label: 'recognition_response', exercise_slug: 'photo_naming' },
    ]);
    expect(acc.accuracy).toBe(50);
    expect(acc.scored_trials).toBe(2);
    expect(acc.recognition_trials).toBe(2);
    expect(acc.recognition_accuracy).toBe(100);
    expect(acc.practice_accuracy).toBe(75);
    expect(acc.participation_trials).toBe(4);
  });

  it('a wrong tap is a wrong choice, not a paraphasia', () => {
    const base: TrialData = {
      attempt_id: 'a1',
      target_word: 'three',
      transcript: null,
      is_correct: false,
      exercise_slug: 'photo_naming',
      latency_ms: 700,
      // Exactly what the speech classifier emits when it compares the chosen
      // foil with the target.
      error_type: 'phonemic_paraphasia',
      cue_type_given: null,
      cue_was_effective: null,
      audio_storage_path: null,
      recording_duration_ms: null,
      pronunciation_status: null,
      semantic_similarity: 0.1,
      phonological_similarity: 0.8,
      stuck_type: null,
      speech_rate_wpm: null,
      created_at: null,
    };
    expect(categoryOfTrial({ ...base, trial_mode: 'production' })).toEqual(['phonemic_paraphasia']);
    expect(categoryOfTrial({ ...base, trial_mode: 'recognition' })).toEqual(['wrong_choice']);
    expect(categoryOfTrial({ ...base, validity_label: 'recognition_response' })).toEqual(['wrong_choice']);
    expect(isTapResponse({ ...base, trial_mode: 'recognition' })).toBe(true);
    expect(isTapResponse(base)).toBe(false);
  });
});
