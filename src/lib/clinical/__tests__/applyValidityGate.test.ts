import { describe, it, expect } from 'vitest';
import { classifyUtteranceValidity } from '../classifyUtteranceValidity';
import { applyValidityGate } from '../applyValidityGate';

describe('applyValidityGate — Phase 1B scoring axes', () => {
  it('valid_attempt → all axes true, confirmedBy asr', () => {
    const v = classifyUtteranceValidity({
      transcript: 'spoon',
      recordingDurationMs: 900,
      asrConfidence: 0.95,
    });
    const g = applyValidityGate(v);
    expect(g.label).toBe('valid_attempt');
    expect(g.shouldScore).toBe(true);
    expect(g.shouldCountAsrAccuracy).toBe(true);
    expect(g.shouldCountParticipation).toBe(true);
    expect(g.shouldCountPracticeAccuracy).toBe(true);
    expect(g.confirmedBy).toBe('asr');
  });

  it('caregiver manual confirmation → participation + practice, NOT asr', () => {
    const v = classifyUtteranceValidity({
      transcript: '',
      recordingDurationMs: 1500,
      manualConfirmed: true,
      confirmedBy: 'caregiver',
      asrVerified: false,
    });
    const g = applyValidityGate(v);
    expect(g.label).toBe('manual_confirmed');
    expect(g.bucket).toBe('manual');
    expect(g.shouldScore).toBe(false); // ASR/independent accuracy stays clean
    expect(g.shouldCountAsrAccuracy).toBe(false);
    expect(g.shouldFeedAdaptation).toBe(false); // does not move adaptation
    expect(g.shouldCountParticipation).toBe(true);
    expect(g.shouldCountPracticeAccuracy).toBe(true);
    expect(g.confirmedBy).toBe('caregiver');
  });

  it('no_response → nothing counts', () => {
    const v = classifyUtteranceValidity({ transcript: '', recordingDurationMs: 1500 });
    const g = applyValidityGate(v);
    expect(g.label).toBe('no_response');
    expect(g.shouldScore).toBe(false);
    expect(g.shouldCountParticipation).toBe(false);
    expect(g.shouldCountPracticeAccuracy).toBe(false);
  });

  it('null validity (legacy) → treated as valid for all axes', () => {
    const g = applyValidityGate(null);
    expect(g.shouldScore).toBe(true);
    expect(g.shouldCountParticipation).toBe(true);
    expect(g.shouldCountPracticeAccuracy).toBe(true);
    expect(g.shouldCountAsrAccuracy).toBe(true);
  });
});
