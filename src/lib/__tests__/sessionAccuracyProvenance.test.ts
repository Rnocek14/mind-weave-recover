import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { reduceAccuracy } from '@/lib/sessionAccuracySummary';

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
});
