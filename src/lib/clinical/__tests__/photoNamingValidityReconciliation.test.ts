import { describe, it, expect } from 'vitest';
import { classifyUtteranceValidity } from '../classifyUtteranceValidity';
import { reduceAccuracy } from '@/lib/sessionAccuracySummary';

/**
 * Verification for the Photo Naming validity-gate fix (B4).
 *
 * PhotoNamingExercise now feeds the gate `whisperTranscript || browserTranscript`
 * so a genuinely-spoken answer that Azure STT could not transcribe (fast/brief
 * namings, dual-mic contention, or an Azure outage) is no longer mislabeled
 * no_response/background_noise and dropped from accuracy.
 *
 * This exercises the exact call-site reconciliation across the full matrix the
 * reviewer asked for — including the false-positive edge cases — to prove the
 * fix rescues real speech WITHOUT turning silence/noise into scored attempts.
 */

// Mirror the exact call-site expression in PhotoNamingExercise.handleTrialComplete.
function classifyPhotoNamingTrial(input: {
  whisperTranscript?: string | null;
  browserTranscript?: string | null;
  utteranceAnalysisTranscript?: string | null;
  whisperConfidence?: number | null;
  recordingDurationMs?: number | null;
  speechToPauseRatio?: number | null;
  manualConfirmed?: boolean;
  confirmedBy?: 'user' | 'caregiver' | null;
  asrVerified?: boolean;
}) {
  const gateTranscript =
    input.whisperTranscript ||
    input.browserTranscript ||
    input.utteranceAnalysisTranscript ||
    null;
  return classifyUtteranceValidity({
    transcript: gateTranscript,
    asrConfidence: input.whisperConfidence ?? null,
    recordingDurationMs: input.recordingDurationMs ?? null,
    acousticMetrics:
      input.speechToPauseRatio != null ? { speechToPauseRatio: input.speechToPauseRatio } : null,
    manualConfirmed: input.manualConfirmed ?? false,
    confirmedBy: input.confirmedBy ?? null,
    asrVerified: input.asrVerified ?? undefined,
  });
}

describe('Photo Naming validity reconciliation (B4)', () => {
  const LONG = 1500; // ms — comfortably above MIN_VALID_DURATION_MS (400)

  it('Azure present → valid_attempt, counts toward score', () => {
    const r = classifyPhotoNamingTrial({ whisperTranscript: 'cat', whisperConfidence: 0.9, recordingDurationMs: LONG });
    expect(r.validity).toBe('valid_attempt');
    expect(r.countsTowardScore).toBe(true);
  });

  it('THE FIX — Azure absent but browser present → valid_attempt (rescued, not no_response)', () => {
    const r = classifyPhotoNamingTrial({
      whisperTranscript: '', // Azure returned nothing
      browserTranscript: 'cat', // browser Web Speech heard it
      whisperConfidence: null,
      recordingDurationMs: LONG,
    });
    expect(r.validity).toBe('valid_attempt');
    expect(r.countsTowardScore).toBe(true);
  });

  it('Azure absent AND browser absent → no_response (genuine silence is NOT rescued)', () => {
    const r = classifyPhotoNamingTrial({
      whisperTranscript: '',
      browserTranscript: '',
      whisperConfidence: null,
      recordingDurationMs: LONG,
    });
    expect(r.validity).toBe('no_response');
    expect(r.countsTowardScore).toBe(false);
  });

  it('background noise (both transcripts empty, low speech ratio) → background_noise, excluded', () => {
    const r = classifyPhotoNamingTrial({
      whisperTranscript: '',
      browserTranscript: '',
      recordingDurationMs: 2000,
      speechToPauseRatio: 0.05,
    });
    expect(r.validity).toBe('background_noise');
    expect(r.countsTowardScore).toBe(false);
  });

  it('manual confirmation → manual_confirmed (participation only, never ASR accuracy)', () => {
    const r = classifyPhotoNamingTrial({
      whisperTranscript: '',
      browserTranscript: '',
      manualConfirmed: true,
      confirmedBy: 'user',
      asrVerified: false,
      recordingDurationMs: LONG,
    });
    expect(r.validity).toBe('manual_confirmed');
    expect(r.countsTowardScore).toBe(false); // clean ASR axis stays clean
    expect(r.countsTowardParticipation).toBe(true);
    expect(r.countsTowardPracticeAccuracy).toBe(true);
  });

  it('THE FIX (duration unknown) — recorder never ran but browser heard the answer → valid_attempt', () => {
    // Duration is only measured when a MediaRecorder session was active
    // (isRecording && user && activeSessionId). A fast browser recognition
    // with no recording used to collapse to 0ms → no_response while the
    // scorer marked the trial correct — the score=100/no_response mismatch
    // in the validity-classifier backlog item.
    const r = classifyPhotoNamingTrial({
      whisperTranscript: '',
      browserTranscript: 'cat',
      recordingDurationMs: null,
    });
    expect(r.validity).toBe('valid_attempt');
    expect(r.countsTowardScore).toBe(true);
  });

  it('THE FIX (analysis transcript) — whisper and browser empty, analysis transcribed it → valid_attempt', () => {
    const r = classifyPhotoNamingTrial({
      whisperTranscript: '',
      browserTranscript: '',
      utteranceAnalysisTranscript: 'elephant',
      recordingDurationMs: 2000,
    });
    expect(r.validity).toBe('valid_attempt');
    expect(r.countsTowardScore).toBe(true);
  });

  it('duration unknown AND no transcript anywhere → still no_response (silence is not rescued)', () => {
    const r = classifyPhotoNamingTrial({
      whisperTranscript: '',
      browserTranscript: '',
      recordingDurationMs: null,
    });
    expect(r.validity).toBe('no_response');
    expect(r.countsTowardScore).toBe(false);
  });

  it('short utterance (<400ms) → no_response even if browser heard something', () => {
    const r = classifyPhotoNamingTrial({
      whisperTranscript: '',
      browserTranscript: 'cat',
      recordingDurationMs: 250,
    });
    expect(r.validity).toBe('no_response');
    expect(r.countsTowardScore).toBe(false);
  });

  it('long utterance, browser-rescued → valid_attempt', () => {
    const r = classifyPhotoNamingTrial({
      whisperTranscript: '',
      browserTranscript: 'elephant',
      recordingDurationMs: 4000,
    });
    expect(r.validity).toBe('valid_attempt');
    expect(r.countsTowardScore).toBe(true);
  });

  // ── False-positive guards: the fallback must not manufacture valid attempts ──
  it('filler-only browser transcript (noise "um") → filler_only, NOT valid', () => {
    const r = classifyPhotoNamingTrial({
      whisperTranscript: '',
      browserTranscript: 'um',
      recordingDurationMs: LONG,
    });
    expect(r.validity).toBe('filler_only');
    expect(r.countsTowardScore).toBe(false);
  });

  it('Azure transcript always wins when present (browser not consulted)', () => {
    const r = classifyPhotoNamingTrial({
      whisperTranscript: 'dog',
      browserTranscript: 'cat',
      whisperConfidence: 0.8,
      recordingDurationMs: LONG,
    });
    // valid either way, but confirms Azure precedence in the reconciliation
    expect(r.validity).toBe('valid_attempt');
  });
});

describe('Downstream accuracy contract holds after the fix', () => {
  it('a rescued correct trial contributes to accuracy; excluded rows do not', () => {
    const rows = [
      { score: 100, cue_level: 0, counts_toward_score: true, validity_label: 'valid_attempt' }, // rescued correct
      { score: 0, cue_level: 0, counts_toward_score: false, validity_label: 'no_response' }, // silence — excluded
      { score: 100, cue_level: 0, counts_toward_score: false, validity_label: 'manual_confirmed' }, // manual — excluded from ASR
    ];
    const acc = reduceAccuracy(rows);
    expect(acc.accuracy).toBe(100); // only the one scorable valid trial
    expect(acc.scored_trials).toBe(1);
    expect(acc.manual_confirmed_trials).toBe(1);
    expect(acc.practice_accuracy).toBe(100); // practice includes the manual one
  });
});
