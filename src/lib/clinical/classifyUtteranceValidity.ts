/**
 * Speech Validity Gate — Phase 1 (heuristic only)
 *
 * Classifies every recorded utterance BEFORE it reaches scoring,
 * adaptation, or clinician analytics. Only `valid_attempt` should
 * affect score / progress / cue logic. All other labels are stored
 * for audit and surfaced in the Session Review tab.
 *
 * Phase 1 explicitly does NOT detect other-speaker / caregiver voices.
 * That label is reserved for Phase 2 (voice fingerprinting). No weak
 * heuristics — clean data over false positives.
 *
 * Pure function — safe to use in edge functions and the browser.
 */

export type ValidityLabel =
  | 'valid_attempt'
  | 'filler_only'
  | 'no_response'
  | 'background_noise'
  | 'other_speaker_suspected' // reserved for Phase 2; never emitted in Phase 1
  | 'low_confidence'
  // Phase 1B — user/caregiver explicitly confirmed a correct response that ASR
  // could not verify (empty/unscorable transcript, mic/ASR failure, or
  // hard-to-transcribe aphasic speech). Counts toward participation + practice
  // accuracy, but NEVER toward ASR/independent accuracy.
  | 'manual_confirmed';

/** Who confirmed a manual_confirmed trial (or 'asr' for ASR-verified attempts). */
export type ConfirmedBy = 'asr' | 'user' | 'caregiver';

export interface ValidityInput {
  transcript?: string | null;
  asrConfidence?: number | null; // 0..1
  recordingDurationMs?: number | null;
  acousticMetrics?: {
    speechRateWpm?: number | null;
    pauseCount?: number | null;
    speechToPauseRatio?: number | null;
    totalDurationSec?: number | null;
  } | null;
  // ── Phase 1B: manual-confirmation metadata ──
  /** True when user/caregiver explicitly confirmed the response correct. */
  manualConfirmed?: boolean | null;
  /** Who confirmed it (drives the manual_confirmed branch + analytics). */
  confirmedBy?: ConfirmedBy | null;
  /** True only when ASR actually produced/verified a scorable transcript. */
  asrVerified?: boolean | null;
  /** Provenance of the transcript, when known. */
  confirmationMode?: 'asr' | 'manual' | 'caregiver' | null;
  // Reserved (unused in Phase 1)
  targetWord?: string | null;
  targetPhrase?: string | null;
}

export interface ValiditySignals {
  durationMs: number;
  trimmedTranscriptLength: number;
  asrConfidence: number | null;
  speechToPauseRatio: number | null;
  matchedFiller: boolean;
}

export interface ValidityResult {
  validity: ValidityLabel;
  reason: string;
  /** 0..1 — how confident the gate is in its classification */
  confidence: number;
  /**
   * Counts toward ASR/clinically-verified accuracy (summary.accuracy /
   * independent_accuracy). FALSE for manual_confirmed — that axis stays clean.
   */
  countsTowardScore: boolean;
  /** Phase 1B — counts toward session participation/engagement. */
  countsTowardParticipation: boolean;
  /** Phase 1B — counts toward coarse practice accuracy (may include manual). */
  countsTowardPracticeAccuracy: boolean;
  /** Who confirmed this trial ('asr' for verified attempts, null otherwise). */
  confirmedBy: ConfirmedBy | null;
  signals: ValiditySignals;
}

/**
 * Filler-only regex: transcript is nothing but disfluencies.
 * Examples matched: "um", "uh uh", "hmm.", "Um, uh.", "ah ah ah"
 * Examples NOT matched: "um cat" (has real content), "umbrella"
 */
const FILLER_TOKEN = /^(um+|uh+|hmm+|mm+|er+|ah+|eh+|oh+)$/i;

function isFillerOnly(transcript: string): boolean {
  const tokens = transcript
    .toLowerCase()
    .replace(/[.,!?;:"]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((t) => FILLER_TOKEN.test(t));
}

const MIN_VALID_DURATION_MS = 400;
const LOW_CONFIDENCE_THRESHOLD = 0.4;
const NOISE_SPEECH_RATIO = 0.2;

export function classifyUtteranceValidity(input: ValidityInput): ValidityResult {
  const transcriptRaw = (input.transcript ?? '').trim();
  const durationMs = Math.max(0, Math.round(input.recordingDurationMs ?? 0));
  const asrConfidence =
    typeof input.asrConfidence === 'number' && Number.isFinite(input.asrConfidence)
      ? input.asrConfidence
      : null;
  const speechToPauseRatio =
    typeof input.acousticMetrics?.speechToPauseRatio === 'number'
      ? input.acousticMetrics.speechToPauseRatio
      : null;

  const signals: ValiditySignals = {
    durationMs,
    trimmedTranscriptLength: transcriptRaw.length,
    asrConfidence,
    speechToPauseRatio,
    matchedFiller: false,
  };

  // 1. No response — too short OR no transcript at all
  if (durationMs < MIN_VALID_DURATION_MS || transcriptRaw.length === 0) {
    // Distinguish: if duration is sufficient but transcript is empty AND
    // ratio looks like noise → background_noise; else no_response.
    if (
      durationMs >= MIN_VALID_DURATION_MS &&
      transcriptRaw.length === 0 &&
      speechToPauseRatio !== null &&
      speechToPauseRatio < NOISE_SPEECH_RATIO
    ) {
      return {
        validity: 'background_noise',
        reason: 'No transcribed speech; audio appears to be background noise.',
        confidence: 0.7,
        countsTowardScore: false,
        signals,
      };
    }
    return {
      validity: 'no_response',
      reason:
        durationMs < MIN_VALID_DURATION_MS
          ? `Recording too short (${durationMs}ms < ${MIN_VALID_DURATION_MS}ms).`
          : 'Empty transcript — no speech detected.',
      confidence: 0.9,
      countsTowardScore: false,
      signals,
    };
  }

  // 2. Filler-only response
  if (isFillerOnly(transcriptRaw)) {
    signals.matchedFiller = true;
    return {
      validity: 'filler_only',
      reason: 'Transcript contains only filler sounds (um/uh/hmm). Not a language attempt.',
      confidence: 0.85,
      countsTowardScore: false,
      signals,
    };
  }

  // 3. Low confidence — short transcript + low ASR confidence
  if (
    asrConfidence !== null &&
    asrConfidence < LOW_CONFIDENCE_THRESHOLD &&
    transcriptRaw.length < 3
  ) {
    return {
      validity: 'low_confidence',
      reason: `ASR confidence ${asrConfidence.toFixed(2)} below ${LOW_CONFIDENCE_THRESHOLD} on a very short transcript. Flagged for clinician review.`,
      confidence: 0.6,
      countsTowardScore: false,
      signals,
    };
  }

  // 4. Phase 1: other_speaker_suspected is reserved — never emitted.
  // Voice fingerprinting (Phase 2) will populate this label.

  // 5. Default — valid patient attempt
  return {
    validity: 'valid_attempt',
    reason: 'Patient produced a scorable speech attempt.',
    confidence: 0.9,
    countsTowardScore: true,
    signals,
  };
}
