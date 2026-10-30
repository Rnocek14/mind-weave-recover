/**
 * Non-diagnostic, SHADOW-ONLY attribution of recorded speech to an enrolled
 * patient voiceprint. Attribution is not authentication, proof of patient
 * independence, or a clinical accuracy score. Never change game/progression
 * outcomes from these values without a separate validated release.
 *
 * Provider: pyannoteAI /v1/identify output. Always abstain on missing/partial
 * metadata. We deliberately do not turn an unmatched voice into a patient
 * failure. Speech that is too short can still be useful practice.
 */
export type SpeakerAttributionLabel =
  | 'patient_candidate'
  | 'mixed_speakers'
  | 'unmatched_speaker'
  | 'uncertain';

export type SpeakerAttributionReason =
  | 'patient_only_candidate'
  | 'multiple_speakers_detected'
  | 'no_patient_match'
  | 'audio_too_short'
  | 'missing_or_invalid_provider_evidence'
  | 'empty_speech'
  | 'low_match_confidence';

export interface SpeakerAttribution {
  schemaVersion: 1;
  label: SpeakerAttributionLabel;
  reason: SpeakerAttributionReason;
  /** Advisory confidence 0..100, not a calibrated clinical probability. */
  matchConfidence: number | null;
  observedSpeakerCount: number;
  patientSpeechMs: number;
  otherOrUnknownSpeechMs: number;
  requiresReview: boolean;
  clinicalScoringAllowed: false;
  mode: 'shadow_only';
}

type Segment = {
  start: number;
  end: number;
  speaker: string;
  match: string | null;
  diarizationSpeaker: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseSegment(value: unknown): Segment | null {
  if (!isRecord(value)) return null;
  const { start, end, speaker, match, diarizationSpeaker } = value;
  if (
    typeof start !== 'number' || !Number.isFinite(start) || start < 0 ||
    typeof end !== 'number' || !Number.isFinite(end) || end <= start ||
    end - start > 120 ||
    typeof speaker !== 'string' || !speaker ||
    !(match === null || typeof match === 'string') ||
    !(diarizationSpeaker === undefined || diarizationSpeaker === null || typeof diarizationSpeaker === 'string')
  ) return null;
  return { start, end, speaker, match, diarizationSpeaker: typeof diarizationSpeaker === 'string' ? diarizationSpeaker : null };
}

function confidenceForPatient(output: Record<string, unknown>, segments: readonly Segment[]): number | null {
  if (!Array.isArray(output.voiceprints)) return null;
  const matched = new Set(
    segments.filter(s => s.match === 'patient')
      .map(s => s.diarizationSpeaker ?? s.speaker),
  );
  const confidences: number[] = [];
  for (const candidate of output.voiceprints) {
    if (!isRecord(candidate) || typeof candidate.speaker !== 'string' || !matched.has(candidate.speaker)) continue;
    if (!isRecord(candidate.confidence)) return null;
    const value = candidate.confidence.patient;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) return null;
    confidences.push(value);
  }
  if (matched.size !== confidences.length || !confidences.length) return null;
  return Math.min(...confidences);
}

function verdict(
  label: SpeakerAttributionLabel,
  reason: SpeakerAttributionReason,
  patientMs = 0,
  otherMs = 0,
  speakerCount = 0,
  confidence: number | null = null,
): SpeakerAttribution {
  return {
    schemaVersion: 1,
    label,
    reason,
    matchConfidence: confidence,
    observedSpeakerCount: speakerCount,
    patientSpeechMs: Math.round(patientMs),
    otherOrUnknownSpeechMs: Math.round(otherMs),
    requiresReview: label !== 'patient_candidate',
    clinicalScoringAllowed: false,
    mode: 'shadow_only',
  };
}

/**
 * Interpret provider output, never auto-accept a recording when evidence is
 * absent or contradictory. A 60/100 candidate cutoff is only a technical
 * shadow-review heuristic; it is NOT calibrated on aphasic speech.
 */
export function classifySpeakerIdentification(
  raw: unknown,
  audioDurationMs?: number | null,
): SpeakerAttribution {
  if (!isRecord(raw) || !Array.isArray(raw.identification) || raw.identification.length > 200) {
    return verdict('uncertain', 'missing_or_invalid_provider_evidence');
  }
  if (raw.identification.length === 0) return verdict('uncertain', 'empty_speech');
  const segments = raw.identification.map(parseSegment);
  if (segments.some(s => s === null)) return verdict('uncertain', 'missing_or_invalid_provider_evidence');
  const parsed = segments as Segment[];
  const speakerIds = new Set(parsed.map(s => s.diarizationSpeaker ?? s.speaker));
  const patientMs = parsed.filter(s => s.match === 'patient')
    .reduce((sum, s) => sum + (s.end - s.start) * 1000, 0);
  const otherMs = parsed.filter(s => s.match !== 'patient')
    .reduce((sum, s) => sum + (s.end - s.start) * 1000, 0);
  const confidence = confidenceForPatient(raw, parsed);
  const speakerCount = speakerIds.size;
  if (patientMs === 0) {
    return verdict('unmatched_speaker', 'no_patient_match', 0, otherMs, speakerCount);
  }
  if (otherMs > 0 || speakerCount > 1) {
    return verdict('mixed_speakers', 'multiple_speakers_detected', patientMs, otherMs, speakerCount, confidence);
  }
  // An observed patient speech segment may be only a syllable. Do not treat
  // duration of the *whole recording* (mostly silence) as speech evidence.
  if (patientMs < 2000 || (typeof audioDurationMs === 'number' && audioDurationMs < 2000)) {
    return verdict('uncertain', 'audio_too_short', patientMs, otherMs, speakerCount, confidence);
  }
  if (confidence === null) {
    return verdict('uncertain', 'missing_or_invalid_provider_evidence', patientMs, otherMs, speakerCount);
  }
  if (confidence < 60) {
    return verdict('uncertain', 'low_match_confidence', patientMs, otherMs, speakerCount, confidence);
  }
  return verdict('patient_candidate', 'patient_only_candidate', patientMs, 0, speakerCount, confidence);
}
