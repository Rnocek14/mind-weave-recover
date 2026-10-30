import { describe, expect, it } from 'vitest';
import { classifySpeakerIdentification } from './speakerIntegrity';

// All fixtures are fabricated provider JSON, not recordings or actual
// speaker-identification performance evidence. These tests exercise the
// production classifier used by the Edge function.
const patient = (seconds = 3, confidence: unknown = 86) => ({
  diarization: [{ speaker: 'SPEAKER_00', start: 0, end: seconds }],
  identification: [{
    speaker: 'patient', start: 0, end: seconds,
    diarizationSpeaker: 'SPEAKER_00', match: 'patient',
  }],
  voiceprints: [{
    speaker: 'SPEAKER_00', match: 'patient',
    confidence: { patient: confidence },
  }],
});

describe('speaker integrity SHADOW classification', () => {
  it('only produces an advisory patient candidate with duration and provider confidence', () => {
    expect(classifySpeakerIdentification(patient())).toEqual({
      schemaVersion: 1, label: 'patient_candidate', reason: 'patient_only_candidate',
      matchConfidence: 86, observedSpeakerCount: 1, patientSpeechMs: 3000,
      otherOrUnknownSpeechMs: 0, requiresReview: false,
      clinicalScoringAllowed: false, mode: 'shadow_only',
    });
  });

  it('retains patient audio but flags an unidentified caregiver for review', () => {
    const raw = patient();
    raw.identification.push({
      speaker: 'SPEAKER_01', start: 3, end: 5,
      diarizationSpeaker: 'SPEAKER_01', match: null,
    } as never);
    expect(classifySpeakerIdentification(raw)).toMatchObject({
      label: 'mixed_speakers', reason: 'multiple_speakers_detected',
      patientSpeechMs: 3000, otherOrUnknownSpeechMs: 2000, observedSpeakerCount: 2,
      clinicalScoringAllowed: false,
    });
  });

  it('also flags multiple voices with matching voice labels as mixed', () => {
    const raw = patient();
    raw.identification.push({
      speaker: 'patient', start: 3, end: 5,
      diarizationSpeaker: 'SPEAKER_01', match: 'patient',
    } as never);
    expect(classifySpeakerIdentification(raw).label).toBe('mixed_speakers');
  });

  it('distinguishes unmatched speech from a patient failure', () => {
    const output = {
      identification: [{ speaker: 'SPEAKER_01', start: 1, end: 3, diarizationSpeaker: 'SPEAKER_01', match: null }],
      voiceprints: [{ speaker: 'SPEAKER_01', match: null, confidence: { patient: 10 } }],
    };
    expect(classifySpeakerIdentification(output)).toMatchObject({
      label: 'unmatched_speaker', reason: 'no_patient_match',
      patientSpeechMs: 0, otherOrUnknownSpeechMs: 2000,
      clinicalScoringAllowed: false,
    });
  });

  it('abstains from interpreting a short spoken approximation as the wrong person', () => {
    expect(classifySpeakerIdentification(patient(1.5), 12_000)).toMatchObject({
      label: 'uncertain', reason: 'audio_too_short', patientSpeechMs: 1500,
    });
    expect(classifySpeakerIdentification(patient(3), 1500)).toMatchObject({
      label: 'uncertain', reason: 'audio_too_short',
    });
  });

  it('abstains on missing, malformed, or unbounded provider evidence', () => {
    for (const raw of [
      null, undefined, {}, { identification: 'patient' },
      { identification: [] }, { identification: [null] },
      { identification: [{ speaker: 'patient', start: 4, end: 3, match: 'patient' }] },
      { identification: [{ speaker: 'patient', start: 0, end: Infinity, match: 'patient' }] },
      { identification: [{ speaker: 'patient', start: 0, end: 99999, match: 'patient' }] },
      { identification: Array(201).fill({ speaker: 'patient', start: 0, end: 3, match: 'patient' }) },
      { ...patient(), voiceprints: undefined },
      { ...patient(), voiceprints: [{ speaker: 'SPEAKER_00', match: 'patient', confidence: { patient: -1 } }] },
      { ...patient(), voiceprints: [{ speaker: 'SPEAKER_00', match: 'patient', confidence: { patient: 101 } }] },
      { ...patient(), voiceprints: [{ speaker: 'SPEAKER_00', match: 'patient', confidence: { patient: '95' } }] },
      { ...patient(), voiceprints: [{ speaker: 'SPEAKER_00', match: 'patient', confidence: { patient: NaN } }] },
    ]) {
      const result = classifySpeakerIdentification(raw);
      expect(result.clinicalScoringAllowed).toBe(false);
      expect(result.label).toBe('uncertain');
    }
  });

  it('retains a low-confidence possible patient as uncertain, never a clinical miss', () => {
    expect(classifySpeakerIdentification(patient(3, 59))).toMatchObject({
      label: 'uncertain', reason: 'low_match_confidence', matchConfidence: 59,
      clinicalScoringAllowed: false,
    });
    expect(classifySpeakerIdentification(patient(3, 60))).toMatchObject({
      label: 'patient_candidate', matchConfidence: 60,
      clinicalScoringAllowed: false,
    });
  });
});
