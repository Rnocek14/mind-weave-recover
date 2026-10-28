import { finiteNumber, record, text, ticksToSeconds, timedSegment, TICKS_PER_SECOND } from '../_shared/azureSpeechValues.ts';

export interface AcousticMetrics {
  speechRateWpm: number | null;
  /** Azure's recognized-speech span, not the duration of the uploaded recording. */
  totalDurationSec: number | null;
  wordCount: number | null;
  pauseCount: number | null;
  avgPauseDurationMs: number | null;
  totalPauseDurationSec: number | null;
  /** Undefined when no qualifying pauses were observed, or timing is unavailable. */
  speechToPauseRatio: number | null;
  segmentCount: number;
}

const round = (value: number, places: number): number | null => {
  const factor = 10 ** places;
  return Number.isFinite(value) && Number.isFinite(value * factor)
    ? Math.round(value * factor) / factor : null;
};

/** Retain the established >100 ms inter-word pause rule; compare integer ticks
 * so floating-point subtraction cannot move a 100 ms gap across that boundary.
 * This is speaking rate (recognized words / recognized interval), not articulation rate.
 */
export function calculateAcousticMetrics(wordsInput: unknown, durationInput: number | null, spokenText: string | null): AcousticMetrics {
  const words = Array.isArray(wordsInput) ? wordsInput : [];
  const duration = finiteNumber(durationInput);
  const wordLabels = words.map((word) => text(record(word)?.Word));
  const wordCount = spokenText !== null
    ? spokenText.trim().split(/\s+/).filter(Boolean).length
    : words.length > 0 && wordLabels.every(Boolean) ? words.length : null;
  const metrics: AcousticMetrics = {
    speechRateWpm: duration !== null && duration > 0 && wordCount !== null
      ? round(wordCount / duration * 60, 1) : null,
    totalDurationSec: duration === null ? null : round(duration, 3),
    wordCount, pauseCount: null, avgPauseDurationMs: null,
    totalPauseDurationSec: null, speechToPauseRatio: null, segmentCount: words.length,
  };
  const segments = words.map(timedSegment);
  // Detailed STT commonly omits Words altogether. Missing/partial timing does
  // not establish zero pauses or a fluent recording.
  if (segments.length === 0 || segments.some((segment) => !segment || segment.duration <= 0)) return metrics;
  const ordered = segments.filter((segment): segment is NonNullable<typeof segment> => segment !== null)
    .sort((a, b) => a.start - b.start);
  let previousEnd = ordered[0].end;
  let pauseCount = 0;
  let totalPauseTicks = 0;
  for (const segment of ordered.slice(1)) {
    const gap = segment.start - previousEnd;
    if (gap > 1_000_000) { pauseCount += 1; totalPauseTicks += gap; }
    previousEnd = Math.max(previousEnd, segment.end);
  }
  const span = (previousEnd - ordered[0].start) / TICKS_PER_SECOND;
  // Inconsistent timestamps cannot yield a valid negative speech duration.
  if (duration !== null && span > duration + 1 / TICKS_PER_SECOND) return metrics;
  const pauseSeconds = totalPauseTicks / TICKS_PER_SECOND;
  return {
    ...metrics, pauseCount,
    avgPauseDurationMs: pauseCount ? Math.round(pauseSeconds / pauseCount * 1000) : 0,
    totalPauseDurationSec: round(pauseSeconds, 3),
    speechToPauseRatio: duration !== null && pauseSeconds > 0
      ? round((duration - pauseSeconds) / pauseSeconds, 2) : null,
  };
}

export class AzureSpeechResponseError extends Error {
  constructor(message: string, public readonly stage: 'azure_api' | 'parse' = 'parse') {
    super(message); this.name = 'AzureSpeechResponseError';
  }
}

export interface SpeechAnalysisResponse {
  transcript: string;
  confidence: number | null;
  acousticMetrics: AcousticMetrics | null;
  validity: ReturnType<typeof classifyUtteranceValidity> | null;
  // Legacy name retained for callers: the provider payload is Azure, not Whisper.
  rawWhisperData: unknown;
}

/** Normalize the real provider response without inventing speech or measurements. */
export function parseAzureSpeechResponse(input: unknown): SpeechAnalysisResponse {
  const azure = record(input);
  if (!azure || typeof azure.RecognitionStatus !== 'string') {
    throw new AzureSpeechResponseError('Azure speech response is missing a recognition status.');
  }
  const duration = ticksToSeconds(azure.Duration);
  const recordingDurationMs = duration === null ? null : Math.round(duration * 1000);
  if (['NoMatch', 'InitialSilenceTimeout', 'BabbleTimeout'].includes(azure.RecognitionStatus)) {
    return {
      transcript: '', confidence: null, acousticMetrics: null,
      validity: recordingDurationMs === null ? null : classifyUtteranceValidity({
        transcript: '', asrConfidence: null, recordingDurationMs, acousticMetrics: null,
      }),
      rawWhisperData: input,
    };
  }
  if (azure.RecognitionStatus !== 'Success') {
    throw new AzureSpeechResponseError(`Azure speech recognition failed: ${azure.RecognitionStatus}`, 'azure_api');
  }
  const best = Array.isArray(azure.NBest) ? record(azure.NBest[0]) : null;
  const transcript = text(best?.Display) || text(azure.DisplayText) || text(best?.Lexical);
  if (!transcript) throw new AzureSpeechResponseError('Successful Azure speech response has no transcript.');
  const confidence = finiteNumber(best?.Confidence, 0, 1);
  // Lexical contains spoken words; Display/ITN can turn "one hundred" into
  // "100", which is unsuitable for counting spoken words.
  const lexical = text(best?.Lexical) || null;
  const acousticMetrics = calculateAcousticMetrics(best?.Words, duration, lexical);
  return {
    transcript, confidence, acousticMetrics,
    validity: recordingDurationMs === null ? null : classifyUtteranceValidity({
      transcript, asrConfidence: confidence, recordingDurationMs, acousticMetrics,
    }),
    rawWhisperData: input,
  };
}

// ===== Speech Validity Gate (Phase 1) =====
// Mirrors src/lib/clinical/classifyUtteranceValidity.ts
// Edge functions cannot import from src/, so logic is duplicated here.
// Keep both files in sync.

const FILLER_TOKEN = /^(um+|uh+|hmm+|mm+|er+|ah+|eh+|oh+)$/i;
const MIN_VALID_DURATION_MS = 400;
const LOW_CONFIDENCE_THRESHOLD = 0.4;
const NOISE_SPEECH_RATIO = 0.2;

function isFillerOnly(transcript: string): boolean {
  const tokens = transcript
    .toLowerCase()
    .replace(/[.,!?;:"]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((t) => FILLER_TOKEN.test(t));
}

function classifyUtteranceValidity(input: {
  transcript?: string | null;
  asrConfidence?: number | null;
  recordingDurationMs?: number | null;
  acousticMetrics?: { speechToPauseRatio?: number | null; speechRateWpm?: number | null } | null;
}) {
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

  const signals = {
    durationMs,
    trimmedTranscriptLength: transcriptRaw.length,
    asrConfidence,
    speechToPauseRatio,
    matchedFiller: false as boolean,
  };

  if (durationMs < MIN_VALID_DURATION_MS || transcriptRaw.length === 0) {
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

  return {
    validity: 'valid_attempt',
    reason: 'Patient produced a scorable speech attempt.',
    confidence: 0.9,
    countsTowardScore: true,
    signals,
  };
}
