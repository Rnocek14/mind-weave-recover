import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { reduceAccuracy, accuracySummaryToSummaryFields } from '@/lib/sessionAccuracySummary';
import { reduceAccuracy as reduceTimeoutAccuracy, accuracySummaryToSummaryFields as timeoutSummaryFields } from '../../../supabase/functions/_shared/sessionAccuracySummary';

const tap = (score: number, cue = 0) => ({
  score, cue_level: cue, counts_toward_score: true,
  validity_label: null, exercise_slug: 'meaning_match',
  task_parameters: { trial_mode: 'recognition' },
});
const verifiedSpeech = (score: number) => ({
  score, cue_level: 0, counts_toward_score: true,
  validity_label: 'valid_attempt', exercise_slug: 'photo_naming',
  browser_transcript: score > 0 ? 'apple' : 'orange',
  engagement_flags: { counts_toward_asr_accuracy: true },
  task_parameters: { trial_mode: 'spoken' },
});

describe('Session ASR provenance and stale-session parity', () => {
  it('does not claim ASR accuracy for a comprehension-only game', () => {
    const r = reduceAccuracy([tap(100), tap(0, 1)]);
    expect(r.accuracy).toBe(50);  // legitimate task accuracy survives
    expect(r.practice_accuracy).toBe(50);
    expect(r.asr_accuracy).toBeNull();
    expect(r.asr_scored_trials).toBe(0);
    expect(r.independent_accuracy).toBe(100);
    expect(r.cue_assisted_accuracy).toBe(0);
  });

  it('keeps the speech-only denominator separate from all scored tasks', () => {
    const r = reduceAccuracy([tap(100), verifiedSpeech(100), verifiedSpeech(0)]);
    expect(r.accuracy).toBe(66.7);
    expect(r.scored_trials).toBe(3);
    expect(r.asr_accuracy).toBe(50);
    expect(r.asr_scored_trials).toBe(2);
  });

  it('rejects a validity flag without a transcript as unverified speech evidence', () => {
    const r = reduceAccuracy([{
      score: 100, cue_level: 0, counts_toward_score: true,
      validity_label: 'valid_attempt', exercise_slug: 'photo_naming',
      engagement_flags: { counts_toward_asr_accuracy: true },
      task_parameters: { trial_mode: 'spoken' },
    }]);
    expect(r.accuracy).toBe(100);
    expect(r.asr_accuracy).toBeNull();
    expect(r.asr_scored_trials).toBe(0);
  });

  it('preserves the voice-practice quarantine even when a legacy row has a score', () => {
    const r = reduceAccuracy([{ ...verifiedSpeech(100), exercise_slug: 'voice_practice' }]);
    expect(r.accuracy).toBeNull();
    expect(r.asr_accuracy).toBeNull();
    expect(r.practice_accuracy).toBeNull();
  });

  it('shares one pure reducer between foreground and stale-session writers', () => {
    const foreground = readFileSync(resolve('src/lib/sessionAccuracySummary.ts'), 'utf8');
    const sweeper = readFileSync(resolve('supabase/functions/sweep-stale-sessions/index.ts'), 'utf8');
    expect(foreground).toContain("supabase/functions/_shared/sessionAccuracySummary");
    expect(sweeper).toContain("../_shared/sessionAccuracySummary.ts");
  });
  it('requires explicit validity evidence rather than inferring ASR from a transcript alone', () => {
    const r = reduceAccuracy([{
      ...verifiedSpeech(100),
      engagement_flags: {},
      task_parameters: { trial_mode: 'production' },
    }]);
    expect(r.accuracy).toBe(100);
    expect(r.asr_accuracy).toBeNull();
    expect(r.asr_scored_trials).toBe(0);
  });

  it('accepts the explicitly recorded speech-validity gate on the real task_parameters axis', () => {
    const speech = {
      ...verifiedSpeech(100),
      engagement_flags: {},
      task_parameters: { trial_mode: 'production', speech_validity: { counts_toward_asr_accuracy: true } },
    };
    expect(reduceAccuracy([speech]).asr_accuracy).toBe(100);
    expect(reduceAccuracy([speech]).asr_scored_trials).toBe(1);
  });

  it('never lets a manually-confirmed recognition trial fabricate ASR evidence', () => {
    const manual = {
      ...verifiedSpeech(100),
      exercise_slug: 'meaning_match',
      validity_label: 'manual_confirmed',
      task_parameters: { trial_mode: 'recognition' },
    };
    const r = reduceAccuracy([manual]);
    expect(r.asr_accuracy).toBeNull();
    expect(r.practice_accuracy).toBe(100);
  });

  it('shares identical real return values between foreground and timeout writer', () => {
    const rows = [tap(100), tap(0, 1), verifiedSpeech(100), verifiedSpeech(0)];
    expect(reduceAccuracy(rows)).toEqual(reduceTimeoutAccuracy(rows));
    expect(accuracySummaryToSummaryFields(reduceAccuracy(rows)))
      .toEqual(timeoutSummaryFields(reduceTimeoutAccuracy(rows)));
  });

  it('clears previous accuracy fields instead of leaving stale data on an empty genuine session', () => {
    const fields = accuracySummaryToSummaryFields(reduceAccuracy([]));
    expect(fields.accuracy).toBeNull();
    expect(fields.asr_accuracy).toBeNull();
    expect(fields.asr_scored_trials).toBe(0);
    expect(fields.scored_trials).toBe(0);
  });

});
