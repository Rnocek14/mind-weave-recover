import { describe, expect, it } from 'vitest';
import { photoNamingTrialProvenance } from './photoNamingTrialProvenance';
import { reduceAccuracy } from '../../../supabase/functions/_shared/sessionAccuracySummary';

describe('Photo Naming answer provenance and session accuracy', () => {
  it('treats a picture-choice tap as a scorable recognition task without inventing speech', () => {
    const evidence = photoNamingTrialProvenance({
      responseMode: 'recognition',
      transcript: null,
      recordingDurationMs: null,
      productionAttempted: false,
    });
    expect(evidence).toMatchObject({
      trialMode: 'recognition',
      productionAttempted: false,
      validity: undefined,
    });

    // The real session reducer counts this known-correct task while
    // preserving no measured speech accuracy (not a 0% ASR result).
    const result = reduceAccuracy([{
      score: 100,
      cue_level: 0,
      validity_label: null,
      counts_toward_score: true,
      task_parameters: { trial_mode: evidence.trialMode },
      engagement_flags: null,
      whisper_transcript: null,
      browser_transcript: null,
    }]);
    expect(result).toMatchObject({
      scored_trials: 1,
      accuracy: 100,
      independent_trials: 1,
      asr_scored_trials: 0,
      asr_accuracy: null,
      participation_trials: 1,
    });
  });

  it('keeps a tap as recognition even when the microphone was used earlier', () => {
    const evidence = photoNamingTrialProvenance({
      responseMode: 'recognition',
      productionAttempted: true,
      transcript: 'apple',
      recordingDurationMs: 1500,
      asrConfidence: 0.95,
    });
    expect(evidence.trialMode).toBe('recognition');
    expect(evidence.productionAttempted).toBe(true);
    expect(evidence.validity).toBeUndefined();

    const result = reduceAccuracy([{
      score: 0,
      cue_level: 1,
      validity_label: null,
      counts_toward_score: true,
      task_parameters: {
        trial_mode: evidence.trialMode,
        production_attempted: evidence.productionAttempted,
      },
      engagement_flags: null,
      browser_transcript: 'apple',
      whisper_transcript: null,
    }]);
    expect(result.scored_trials).toBe(1);
    expect(result.asr_scored_trials).toBe(0);
    expect(result.asr_accuracy).toBeNull();
  });

  it('excludes real spoken silence from score and adaptation', () => {
    const evidence = photoNamingTrialProvenance({
      responseMode: 'production',
      productionAttempted: true,
      transcript: '',
      recordingDurationMs: 1200,
    });
    expect(evidence.trialMode).toBe('production');
    expect(evidence.validity).toMatchObject({
      validity: 'no_response',
      countsTowardScore: false,
    });
  });

  it('keeps verified spoken production eligible without treating it as a tap', () => {
    const evidence = photoNamingTrialProvenance({
      responseMode: 'production',
      productionAttempted: true,
      transcript: 'apple',
      recordingDurationMs: 1600,
      asrConfidence: 0.93,
      asrVerified: true,
    });
    expect(evidence.trialMode).toBe('production');
    expect(evidence.validity).toMatchObject({
      validity: 'valid_attempt',
      countsTowardScore: true,
    });
  });

  it('keeps patient manual confirmations outside ASR/task accuracy', () => {
    const evidence = photoNamingTrialProvenance({
      responseMode: 'manual',
      manualConfirmed: true,
      confirmedBy: 'user',
      transcript: null,
      recordingDurationMs: 0,
    });
    expect(evidence.trialMode).toBe('manual');
    expect(evidence.validity).toMatchObject({
      validity: 'manual_confirmed',
      countsTowardScore: false,
      countsTowardPracticeAccuracy: true,
      countsTowardParticipation: true,
    });
  });

  it('does not silently classify an unknown legacy mode as recognition', () => {
    const evidence = photoNamingTrialProvenance({
      transcript: null,
      recordingDurationMs: 0,
    });
    expect(evidence.trialMode).toBe('production');
    expect(evidence.validity?.validity).toBe('no_response');
  });
});
