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
});
