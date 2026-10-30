import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildEmbeddedPhotoNamingEvidence } from './embeddedPhotoNamingEvidence';
import { applyValidityGate } from './applyValidityGate';
import { reduceAccuracy, type ScoredRow } from '../../../supabase/functions/_shared/sessionAccuracySummary';
import { routeTrialMode } from '@/lib/mastery/masterySignalRouting';

/**
 * These are production-mapper/reducer contract tests. They do NOT claim
 * staging database durability, a physical microphone, or Azure accuracy.
 */
function reduceOne(
  score: number,
  evidence: ReturnType<typeof buildEmbeddedPhotoNamingEvidence>,
  transcript: string | null,
) {
  const gate = applyValidityGate(evidence.validity);
  const row: ScoredRow = {
    score,
    cue_level: 0,
    counts_toward_score: gate.shouldScore,
    validity_label: evidence.validity?.validity ?? null,
    exercise_slug: 'photo_naming',
    task_parameters: { ...evidence.taskParameters },
    engagement_flags: evidence.validity
      ? { counts_toward_asr_accuracy: gate.shouldCountAsrAccuracy }
      : null,
    browser_transcript: transcript,
    whisper_transcript: null,
  };
  return reduceAccuracy([row]);
}

describe('embedded Photo Naming evidence (lesson and targeted practice)', () => {
  it('records a correct tap as a valid recognition task, not failed silent speech', () => {
    const evidence = buildEmbeddedPhotoNamingEvidence({
      responseMode: 'recognition',
      productionAttempted: false,
      transcript: null,
      recordingDurationMs: null,
    });
    expect(evidence.validity).toBeUndefined();
    expect(evidence.taskParameters).toMatchObject({
      trial_mode: 'recognition',
      response_mode: 'recognition',
      confirmation_mode: 'selection',
      asr_verified: false,
      production_attempted: false,
    });
    expect(routeTrialMode('photo_naming', evidence.taskParameters.trial_mode)).toBe('excluded');
    expect(reduceOne(100, evidence, null)).toMatchObject({
      accuracy: 100,
      scored_trials: 1,
      asr_accuracy: null,
      asr_scored_trials: 0,
      participation_trials: 1,
    });
  });

  it('keeps prior microphone speech out of the ASR result after a later choice tap', () => {
    const evidence = buildEmbeddedPhotoNamingEvidence({
      responseMode: 'recognition',
      productionAttempted: true,
      transcript: 'earlier microphone hypothesis',
      asrVerified: true,
      recordingDurationMs: 1700,
      asrConfidence: 0.98,
    });
    expect(evidence.validity).toBeUndefined();
    expect(evidence.taskParameters).toMatchObject({
      trial_mode: 'recognition',
      production_attempted: true,
      confirmation_mode: 'selection',
      asr_verified: false,
    });
    expect(reduceOne(0, evidence, 'earlier microphone hypothesis')).toMatchObject({
      accuracy: 0,
      scored_trials: 1,
      asr_accuracy: null,
      asr_scored_trials: 0,
    });
  });

  it('separates caregiver manual confirmation from task and ASR accuracy', () => {
    const evidence = buildEmbeddedPhotoNamingEvidence({
      responseMode: 'manual',
      manualConfirmed: true,
      confirmedBy: 'caregiver',
      recordingDurationMs: 0,
      transcript: null,
    });
    expect(evidence.taskParameters).toMatchObject({
      trial_mode: 'scaffolded',
      response_mode: 'manual',
      confirmed_by: 'caregiver',
      manual_confirmed: true,
      asr_verified: false,
    });
    expect(evidence.validity?.validity).toBe('manual_confirmed');
    expect(routeTrialMode('photo_naming', evidence.taskParameters.trial_mode)).toBe('excluded');
    expect(reduceOne(100, evidence, null)).toMatchObject({
      accuracy: null,
      scored_trials: 0,
      asr_accuracy: null,
      asr_scored_trials: 0,
      practice_accuracy: 100,
      manual_confirmed_trials: 1,
      participation_trials: 1,
    });
  });

  it('accepts valid spoken production and quarantines silent attempts', () => {
    const spoken = buildEmbeddedPhotoNamingEvidence({
      responseMode: 'production',
      productionAttempted: true,
      transcript: 'apple',
      recordingDurationMs: 1600,
      asrVerified: true,
      asrConfidence: 0.94,
    });
    expect(spoken.validity?.validity).toBe('valid_attempt');
    expect(spoken.taskParameters.asr_verified).toBe(true);
    expect(routeTrialMode('photo_naming', spoken.taskParameters.trial_mode)).toBe('expressive');
    expect(reduceOne(100, spoken, 'apple')).toMatchObject({
      accuracy: 100,
      asr_accuracy: 100,
      asr_scored_trials: 1,
    });

    const silence = buildEmbeddedPhotoNamingEvidence({
      responseMode: 'production',
      productionAttempted: true,
      transcript: '',
      recordingDurationMs: 1600,
    });
    expect(silence.validity?.validity).toBe('no_response');
    expect(reduceOne(0, silence, null)).toMatchObject({
      accuracy: null,
      scored_trials: 0,
      asr_accuracy: null,
      participation_trials: 0,
    });
  });

  it('wires the real legacy lesson writer through this evidence rather than a speech-only classifier', () => {
    const page = readFileSync(resolve('src/pages/Exercise.tsx'), 'utf8');
    expect(page).toContain('buildEmbeddedPhotoNamingEvidence({');
    expect(page).toContain('responseMode: result.responseMode,');
    expect(page).toContain('productionAttempted: result.productionAttempted,');
    expect(page).toContain('validity: evidence.validity,');
    expect(page).toContain('...evidence.taskParameters,');
    expect(page).not.toContain('classifyUtteranceValidity({');
  });
});
