import { describe, expect, it } from 'vitest';
import { alignWords, scoreAudioCase, summarizeAudioBenchmark } from '@/lib/clinicalSimulation/audioBenchmark';

const base = {
  caseId: 'synthetic-001', sourceId: 'synthetic', referenceTranscript: 'red rabbit runs',
  recognizedTranscript: 'red rabbit runs', condition: 'clean' as const,
  eligibleForAccuracy: true, expectedSpeaker: 'patient' as const,
};
describe('Clinical Simulation Lab: reference-scored ASR benchmark', () => {
  it('reports zero word error for an exact match', () => {
    expect(scoreAudioCase(base).wer).toBe(0);
  });
  it('separates substitutions, deletions and insertions', () => {
    expect(alignWords(['red','rabbit','runs'], ['red','rabbit','walks'])).toEqual({
      substitutions: 1, deletions: 0, insertions: 0,
    });
    expect(alignWords(['red','rabbit','runs'], ['red','runs']).deletions).toBe(1);
    expect(alignWords(['red','runs'], ['red','rabbit','runs']).insertions).toBe(1);
  });
  it('does not treat missing ASR output as a correct transcript', () => {
    const result = scoreAudioCase({ ...base, recognizedTranscript: null });
    expect(result.status).toBe('missing_output');
    expect(result.wer).toBeNull();
  });
  it('excludes silence from WER denominator', () => {
    const report = summarizeAudioBenchmark([
      base,
      { ...base, caseId: 'silence', referenceTranscript: '', recognizedTranscript: '', condition: 'silence' },
    ]);
    expect(report.scored).toBe(1);
    expect(report.excluded).toBe(1);
    expect(report.microWER).toBe(0);
  });
  it('separately flags caregiver speech contamination', () => {
    const result = scoreAudioCase({
      ...base, expectedSpeaker: 'patient', detectedSpeaker: 'caregiver',
    });
    expect(result.speakerMismatch).toBe(true);
  });
  it('does not claim a zero error rate for an empty corpus', () => {
    expect(summarizeAudioBenchmark([]).microWER).toBeNull();
  });
});
