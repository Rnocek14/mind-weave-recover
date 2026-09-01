import { describe, it, expect } from 'vitest';
import { classifyUtteranceValidity } from '../classifyUtteranceValidity';

describe('classifyUtteranceValidity', () => {
  it('flags too-short recordings as no_response', () => {
    const r = classifyUtteranceValidity({
      transcript: 'cat',
      recordingDurationMs: 200,
      asrConfidence: 0.9,
    });
    expect(r.validity).toBe('no_response');
    expect(r.countsTowardScore).toBe(false);
  });

  it('does NOT reject a real transcript when duration is unknown (recorder never ran)', () => {
    // Photo Naming only reports recordingDurationMs when a MediaRecorder
    // session was active. A spoken answer transcribed by ASR must not be
    // stamped no_response just because duration was never measured.
    const r = classifyUtteranceValidity({
      transcript: 'cat',
      recordingDurationMs: null,
      asrConfidence: 0.9,
    });
    expect(r.validity).toBe('valid_attempt');
    expect(r.countsTowardScore).toBe(true);
  });

  it('still flags empty transcript as no_response when duration is unknown', () => {
    const r = classifyUtteranceValidity({
      transcript: '',
      recordingDurationMs: undefined,
      asrConfidence: null,
    });
    expect(r.validity).toBe('no_response');
    expect(r.reason).toContain('Empty transcript');
    expect(r.countsTowardScore).toBe(false);
  });

  it('flags empty transcript as no_response', () => {
    const r = classifyUtteranceValidity({
      transcript: '   ',
      recordingDurationMs: 1500,
      asrConfidence: 0.5,
    });
    expect(r.validity).toBe('no_response');
  });

  it('classifies long silent audio with low speech ratio as background_noise', () => {
    const r = classifyUtteranceValidity({
      transcript: '',
      recordingDurationMs: 2000,
      asrConfidence: 0.2,
      acousticMetrics: { speechToPauseRatio: 0.05 },
    });
    expect(r.validity).toBe('background_noise');
    expect(r.countsTowardScore).toBe(false);
  });

  it('classifies "um" as filler_only', () => {
    const r = classifyUtteranceValidity({
      transcript: 'um',
      recordingDurationMs: 700,
      asrConfidence: 0.95,
    });
    expect(r.validity).toBe('filler_only');
    expect(r.countsTowardScore).toBe(false);
  });

  it('classifies "uh, um." as filler_only', () => {
    const r = classifyUtteranceValidity({
      transcript: 'uh, um.',
      recordingDurationMs: 900,
      asrConfidence: 0.9,
    });
    expect(r.validity).toBe('filler_only');
  });

  it('does NOT classify "umbrella" as filler', () => {
    const r = classifyUtteranceValidity({
      transcript: 'umbrella',
      recordingDurationMs: 900,
      asrConfidence: 0.9,
    });
    expect(r.validity).toBe('valid_attempt');
  });

  it('does NOT classify "um cat" as filler (has real content)', () => {
    const r = classifyUtteranceValidity({
      transcript: 'um cat',
      recordingDurationMs: 1100,
      asrConfidence: 0.9,
    });
    expect(r.validity).toBe('valid_attempt');
  });

  it('flags very short low-confidence transcript as low_confidence', () => {
    const r = classifyUtteranceValidity({
      transcript: 'k',
      recordingDurationMs: 600,
      asrConfidence: 0.2,
    });
    expect(r.validity).toBe('low_confidence');
    expect(r.countsTowardScore).toBe(false);
  });

  it('does NOT flag a long transcript with low confidence as low_confidence', () => {
    const r = classifyUtteranceValidity({
      transcript: 'cat in the hat',
      recordingDurationMs: 1500,
      asrConfidence: 0.2,
    });
    expect(r.validity).toBe('valid_attempt');
  });

  it('classifies a normal patient response as valid_attempt', () => {
    const r = classifyUtteranceValidity({
      transcript: 'spoon',
      recordingDurationMs: 900,
      asrConfidence: 0.95,
    });
    expect(r.validity).toBe('valid_attempt');
    expect(r.countsTowardScore).toBe(true);
  });

  it('NEVER emits other_speaker_suspected in Phase 1', () => {
    // Even with a long, fluent, high-WPM transcript that might suggest a caregiver
    const r = classifyUtteranceValidity({
      transcript: 'oh that is a beautiful red apple sitting on the table',
      recordingDurationMs: 2000,
      asrConfidence: 0.99,
      acousticMetrics: { speechRateWpm: 240, speechToPauseRatio: 8 },
    });
    expect(r.validity).not.toBe('other_speaker_suspected');
    expect(r.validity).toBe('valid_attempt');
  });

  // ── Phase 1B: manual confirmation ──
  describe('manual_confirmed (Phase 1B)', () => {
    it('empty transcript + NO confirmation = no_response, excluded from score', () => {
      const r = classifyUtteranceValidity({
        transcript: '',
        recordingDurationMs: 1500,
      });
      expect(r.validity).toBe('no_response');
      expect(r.countsTowardScore).toBe(false);
      expect(r.countsTowardParticipation).toBe(false);
      expect(r.countsTowardPracticeAccuracy).toBe(false);
    });

    it('empty transcript + manual confirmation = manual_confirmed', () => {
      const r = classifyUtteranceValidity({
        transcript: '',
        recordingDurationMs: 1500,
        manualConfirmed: true,
        confirmedBy: 'user',
        asrVerified: false,
      });
      expect(r.validity).toBe('manual_confirmed');
      expect(r.confirmedBy).toBe('user');
    });

    it('manual_confirmed counts toward participation + practice accuracy', () => {
      const r = classifyUtteranceValidity({
        transcript: '',
        recordingDurationMs: 1500,
        manualConfirmed: true,
        confirmedBy: 'caregiver',
      });
      expect(r.countsTowardParticipation).toBe(true);
      expect(r.countsTowardPracticeAccuracy).toBe(true);
      expect(r.confirmedBy).toBe('caregiver');
    });

    it('manual_confirmed does NOT count toward ASR/independent accuracy', () => {
      const r = classifyUtteranceValidity({
        transcript: '',
        recordingDurationMs: 1500,
        manualConfirmed: true,
        confirmedBy: 'caregiver',
      });
      // countsTowardScore is the ASR/independent gate — must stay false.
      expect(r.countsTowardScore).toBe(false);
    });

    it('does NOT override a genuinely ASR-verified attempt', () => {
      // Even if manualConfirmed is flagged, an ASR-verified transcript stays valid_attempt.
      const r = classifyUtteranceValidity({
        transcript: 'spoon',
        recordingDurationMs: 900,
        asrConfidence: 0.95,
        manualConfirmed: true,
        asrVerified: true,
      });
      expect(r.validity).toBe('valid_attempt');
      expect(r.countsTowardScore).toBe(true);
    });
  });
});
