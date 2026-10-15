import { describe, expect, it } from 'vitest';
import { classifyResponse, type EvidenceEvent } from './cueAttributionResearch';

const baseline: EvidenceEvent[] = [
  { kind: 'prompt', atMs: 0 },
  { kind: 'speech_start', atMs: 2000, speaker: 'patient' },
  { kind: 'response', atMs: 4500, speaker: 'patient', correct: true, transcriptReliable: true },
];

describe('cue attribution research safety contract', () => {
  it('credits a verified patient answer without a cue', () => {
    expect(classifyResponse(baseline).status).toBe('independent');
  });
  it('does not count a cued answer as independent', () => {
    expect(classifyResponse([...baseline, { kind: 'cue', atMs: 3000, cueId: 'first-sound', source: 'app' }]).status).toBe('assisted');
  });
  it('marks caregiver help as assisted', () => {
    expect(classifyResponse([...baseline, { kind: 'cue', atMs: 2000, cueId: 'hint', source: 'caregiver' }])).toEqual({ status: 'assisted', reason: 'caregiver_help' });
  });
  it('abstains when caregiver supplies the response', () => {
    expect(classifyResponse([{ kind: 'prompt', atMs: 0 }, { kind: 'response', atMs: 4500, speaker: 'caregiver', correct: true, transcriptReliable: true }]).status).toBe('unscorable');
  });
  it('abstains when the speaker is unknown', () => {
    expect(classifyResponse([{ ...baseline[0] }, { kind: 'response', atMs: 4500, speaker: 'unknown', correct: true, transcriptReliable: true }]).status).toBe('unscorable');
  });
  it('abstains when transcription is unreliable', () => {
    expect(classifyResponse(baseline.map(e => e.kind === 'response' ? { ...e, transcriptReliable: false } : e)).status).toBe('unscorable');
  });
  it('abstains when cue overlaps the answer', () => {
    expect(classifyResponse([...baseline, { kind: 'cue', atMs: 4400, cueId: 'first-sound', source: 'app' }])).toEqual({ status: 'unscorable', reason: 'timing_overlap' });
  });
  it('abstains if audio capture was interrupted', () => {
    expect(classifyResponse([...baseline, { kind: 'recording_gap', atMs: 3000 }]).status).toBe('unscorable');
  });
  it('does not interpret a wrong answer as independent success', () => {
    expect(classifyResponse(baseline.map(e => e.kind === 'response' ? { ...e, correct: false } : e)).status).toBe('unscorable');
  });
  it('does not mutate the original event order', () => {
    const events = [...baseline].reverse();
    classifyResponse(events);
    expect(events[0].kind).toBe('response');
  });
});
