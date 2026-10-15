/**
 * Conservative, opt-in research classifier for cue and speaker attribution.
 * NOT a clinical scoring engine. Nothing imports this into production games.
 * Unknown evidence must never be silently converted into independent success.
 */
export type Speaker = 'patient' | 'caregiver' | 'coach' | 'other' | 'unknown';
export type EvidenceEvent =
  | { kind: 'prompt'; atMs: number }
  | { kind: 'speech_start'; atMs: number; speaker: Speaker }
  | { kind: 'speech_end'; atMs: number; speaker: Speaker }
  | { kind: 'cue'; atMs: number; cueId: string; source: 'app' | 'caregiver' }
  | { kind: 'response'; atMs: number; speaker: Speaker; correct: boolean | null; transcriptReliable: boolean }
  | { kind: 'recording_gap'; atMs: number };

export type Attribution =
  | { status: 'independent'; reason: 'verified_patient_before_cue' }
  | { status: 'assisted'; reason: 'cue_before_response' | 'caregiver_help' }
  | { status: 'unscorable'; reason: 'unknown_speaker' | 'unreliable_transcript' | 'missing_evidence' | 'timing_overlap' | 'recording_gap' | 'incorrect_or_unknown' };

export function classifyResponse(events: readonly EvidenceEvent[], overlapWindowMs = 300): Attribution {
  const ordered = [...events].sort((a, b) => a.atMs - b.atMs);
  const responses = ordered.filter((e): e is Extract<EvidenceEvent, {kind:'response'}> => e.kind === 'response');
  if (responses.length !== 1 || !ordered.some(e => e.kind === 'prompt')) return { status: 'unscorable', reason: 'missing_evidence' };
  const response = responses[0];
  if (response.speaker !== 'patient') return { status: 'unscorable', reason: 'unknown_speaker' };
  if (!response.transcriptReliable) return { status: 'unscorable', reason: 'unreliable_transcript' };
  if (response.correct !== true) return { status: 'unscorable', reason: 'incorrect_or_unknown' };
  if (ordered.some(e => e.kind === 'recording_gap' && e.atMs <= response.atMs)) return { status: 'unscorable', reason: 'recording_gap' };
  const cues = ordered.filter((e): e is Extract<EvidenceEvent, {kind:'cue'}> => e.kind === 'cue' && e.atMs <= response.atMs + overlapWindowMs);
  if (cues.some(e => Math.abs(response.atMs - e.atMs) <= overlapWindowMs)) return { status: 'unscorable', reason: 'timing_overlap' };
  if (cues.some(e => e.source === 'caregiver')) return { status: 'assisted', reason: 'caregiver_help' };
  if (cues.length) return { status: 'assisted', reason: 'cue_before_response' };
  const otherSpeech = ordered.some(e => e.kind === 'speech_start' && e.speaker !== 'patient' && e.atMs <= response.atMs);
  if (otherSpeech) return { status: 'unscorable', reason: 'unknown_speaker' };
  return { status: 'independent', reason: 'verified_patient_before_cue' };
}
