import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert, Json } from '@/integrations/supabase/types';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';
import { parseResponseTiming, type ResponseTiming } from '@/lib/speech/responseTiming';

/**
 * Attempt-scoped speech evidence. A late callback must never borrow the next
 * trial's identity. Finalization means the backend acknowledged the write, not
 * that a request was started. No schema or clinical scoring changes here.
 */
interface AttemptContext {
  attemptId: string;
  pronRequestId: string;
  sessionId: string;
  userId: string;
  exerciseSlug: string;
  trialIndex: number;
  attemptNumber: number;
  targetWord: string;
  category?: string;
  startedAt: number;
}

export type FluencyUnavailableReason =
  | 'no_recording' | 'no_session' | 'not_authed' | 'permission_denied'
  | 'recorder_error' | 'analysis_error' | 'wav_conversion_failed'
  | 'azure_api_error' | 'discourse_task';

export interface PronunciationDiagnostics {
  pronRequestId?: string;
  pronunciationStatus?: 'pending' | 'complete' | 'failed' | 'skipped';
  pronunciationErrorStage?: 'wav_conversion' | 'base64_encoding' | 'edge_function' | 'azure_api' | 'parse' | 'unexpected';
  pronunciationTimingsMs?: { wav?: number; base64?: number; edge?: number; total: number };
  audioMeta?: { originalMime: string; originalSize: number; wavSize?: number; base64Len?: number };
}

export type EvaluationModel = 'test' | 'flow';

export interface MomentumComponents {
  pauseRatio: number;
  prewordPauseAvgMs: number;
  filledPauseRate: number;
  burstCount: number;
  longestPauseMs: number;
  trailingOffDetected: boolean;
}

export interface FinalAnalysisInput {
  /** Capture at recording/response time. Explicit missing/unknown IDs fail closed. */
  attemptId?: string | null;
  /** Captured before recording/upload/analysis awaits; never inferred at save. */
  responseTiming?: ResponseTiming | null;
  transcript?: string;
  transcriptSource: 'browser' | 'azure' | 'whisper' | 'manual';
  asrConfidence?: number | null;
  isCorrect?: boolean | null;
  errorType?: string;
  phonologicalSimilarity?: number | null;
  semanticSimilarity?: number | null;
  classificationConfidence?: number | null;
  reasoning?: string;
  speechRateWpm?: number | null;
  pauseCount?: number | null;
  totalPauseMs?: number | null;
  avgPauseDurationMs?: number | null;
  effortfulSpeech?: boolean | null;
  fluencyAvailable?: boolean | null;
  fluencyUnavailableReason?: FluencyUnavailableReason;
  cueTypeGiven?: string;
  cueWasEffective?: boolean | null;
  timeToSuccessAfterCueMs?: number | null;
  cueTrigger?: 'stall' | 'consecutive_errors' | 'user_request';
  audioStoragePath?: string;
  recordingDurationMs?: number | null;
  pronunciationScore?: number | null;
  accuracyScore?: number | null;
  fluencyScore?: number | null;
  completenessScore?: number | null;
  prosodyScore?: number | null;
  gopData?: any;
  alignmentData?: {
    word_segments: { word: string; start: number; end: number }[];
    phone_segments: { phone: string; start: number; end: number }[];
  };
  pronunciationError?: string;
  pronunciationDiagnostics?: PronunciationDiagnostics;
  evaluationModel?: EvaluationModel;
  didSpeak?: boolean | null;
  utteranceComplete?: boolean | null;
  coherenceScore?: number | null;
  momentumScore?: number | null;
  latencyToFirstWordMs?: number | null;
  narrowingLevelUsed?: number | null;
  narrowingTrigger?: 'auto_silence' | 'user_request';
  momentumComponents?: MomentumComponents;
  promptIntentType?: string;
  promptTheme?: string;
  stuckType?: string;
}

export type FinalizationResult =
  | { status: 'persisted'; attemptId: string; duplicate: boolean }
  | { status: 'in_flight'; attemptId: string }
  | { status: 'failed'; attemptId: string; reason: 'database_error' | 'transport_or_payload_error' }
  | { status: 'missing_attempt'; attemptId: string | null };

type AttemptRecord = {
  context: Readonly<AttemptContext>;
  browserTranscript: string | null;
  state: 'open' | 'saving' | 'failed' | 'persisted';
  /** Reuse the exact logical write on retries, including the original timing. */
  payload?: TablesInsert<'utterance_analyses'>;
};

export interface CapturedAttempt {
  readonly attemptId: string | null;
  readonly finalize: (analysis: Omit<FinalAnalysisInput, 'attemptId'>) => Promise<FinalizationResult>;
}

interface UtteranceLoggerReturn {
  currentAttemptId: string | null;
  isFinalized: boolean;
  startAttempt: (context: Omit<AttemptContext, 'attemptId' | 'pronRequestId' | 'startedAt'>) => { attemptId: string; pronRequestId: string };
  logBrowserTranscript: (transcript: string, attemptId?: string | null) => void;
  logFinalAnalysis: (analysis: FinalAnalysisInput) => Promise<FinalizationResult>;
  captureAttempt: () => CapturedAttempt;
  resetAttempt: () => void;
}

function measuredNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// An explicit null means unavailable. Only an absent field may use the
// equivalent top-level value; never convert missing evidence into a zero.
function pronunciationMetric(value: unknown, fallback?: number | null): number | null {
  return measuredNumber(value === undefined ? fallback : value);
}

/** Preserve existing database columns, units, and score semantics. */
function buildPayload(record: AttemptRecord, analysis: FinalAnalysisInput): TablesInsert<'utterance_analyses'> {
  const ctx = record.context;
  const diag = analysis.pronunciationDiagnostics;
  const responseTiming = parseResponseTiming(analysis.responseTiming);
  const hasPronError = !!analysis.pronunciationError || diag?.pronunciationStatus === 'failed';
  const pronunciationStatus = analysis.gopData ? 'complete' : hasPronError ? 'failed' : 'skipped';
  // Untagged legacy game callers use Azure PA. Keep that compatibility, but
  // never overwrite provenance explicitly supplied by a different analyzer.
  const gopSource = analysis.gopData?.source === undefined ? 'azure' : analysis.gopData.source;
  const gopSchema = analysis.gopData?.schemaVersion === undefined
    ? (gopSource === 'azure' ? 'azure-pa-v2' : null)
    : analysis.gopData.schemaVersion;
  const payload: TablesInsert<'utterance_analyses'> = {
    attempt_id: ctx.attemptId,
    user_id: ctx.userId,
    session_id: ctx.sessionId,
    exercise_slug: ctx.exerciseSlug,
    trial_index: ctx.trialIndex,
    attempt_number: ctx.attemptNumber,
    target_word: ctx.targetWord,
    category: ctx.category,
    // An explicitly empty transcript is evidence too; do not replace it.
    transcript: analysis.transcript ?? record.browserTranscript,
    // Historical database CHECK permits browser/whisper/manual. Azure STT uses
    // that legacy wire slot; audio_meta carries the actual provider below.
    transcript_source: analysis.transcriptSource === 'azure' ? 'whisper' : analysis.transcriptSource,
    asr_confidence: analysis.asrConfidence,
    is_correct: analysis.isCorrect,
    error_type: analysis.errorType,
    phonological_similarity: analysis.phonologicalSimilarity,
    semantic_similarity: analysis.semanticSimilarity,
    classification_confidence: analysis.classificationConfidence,
    reasoning: analysis.reasoning,
    speech_rate_wpm: analysis.speechRateWpm,
    pause_count: analysis.pauseCount,
    total_pause_ms: analysis.totalPauseMs,
    avg_pause_duration_ms: analysis.avgPauseDurationMs,
    effortful_speech: analysis.effortfulSpeech,
    cue_type_given: analysis.cueTypeGiven,
    time_to_success_after_cue_ms: analysis.timeToSuccessAfterCueMs,
    cue_trigger: analysis.cueTrigger,
    // This is the existing analysis-completion latency, not speech-onset time.
    latency_ms: Math.max(0, Date.now() - ctx.startedAt),
    recording_duration_ms: analysis.recordingDurationMs,
    audio_storage_path: analysis.audioStoragePath,
    fluency_available: analysis.fluencyAvailable,
    fluency_unavailable_reason: analysis.fluencyUnavailableReason,
    gop_data: analysis.gopData ? {
      schemaVersion: gopSchema,
      source: gopSource,
      pronunciationScore: pronunciationMetric(analysis.gopData.pronunciationScore, analysis.pronunciationScore),
      accuracyScore: pronunciationMetric(analysis.gopData.accuracyScore, analysis.accuracyScore),
      fluencyScore: pronunciationMetric(analysis.gopData.fluencyScore, analysis.fluencyScore),
      completenessScore: pronunciationMetric(analysis.gopData.completenessScore, analysis.completenessScore),
      prosodyScore: pronunciationMetric(analysis.gopData.prosodyScore, analysis.prosodyScore),
      words: analysis.gopData.words ?? [],
      transcript: analysis.gopData.transcript ?? '',
      duration: measuredNumber(analysis.gopData.duration),
    } : null,
    alignment_data: analysis.alignmentData ?? (analysis.gopData?.alignmentData ? {
      word_segments: analysis.gopData.alignmentData.word_segments,
      phone_segments: analysis.gopData.alignmentData.phone_segments,
    } : null),
    analysis_status: 'complete',
    error_message: null,
    locked_at: null,
    locked_by: null,
    next_retry_at: null,
    analysis_priority: 0,
    pron_request_id: diag?.pronRequestId || ctx.pronRequestId,
    pronunciation_status: pronunciationStatus,
    pronunciation_error_stage: diag?.pronunciationErrorStage,
    pronunciation_error_message: analysis.pronunciationError || (diag?.pronunciationErrorStage ? `${diag.pronunciationErrorStage} failed` : null),
    pronunciation_timings_ms: diag?.pronunciationTimingsMs,
    audio_meta: diag?.audioMeta || analysis.transcriptSource === 'azure' || responseTiming
      ? {
        ...diag?.audioMeta,
        ...(analysis.transcriptSource === 'azure' ? { transcriptProvider: 'azure' } : {}),
        // Timing belongs to the captured answer, never to opaque diagnostics.
        // JSON serialization omits this key when no valid measurement exists.
        responseTiming: responseTiming ? { ...responseTiming } : undefined,
      }
      : undefined,
    evaluation_model: analysis.evaluationModel ?? 'test',
    did_speak: analysis.didSpeak,
    utterance_complete: analysis.utteranceComplete,
    coherence_score: analysis.coherenceScore,
    momentum_score: analysis.momentumScore,
    latency_to_first_word_ms: analysis.latencyToFirstWordMs,
    narrowing_level_used: analysis.narrowingLevelUsed,
    narrowing_trigger: analysis.narrowingTrigger,
    momentum_components: analysis.momentumComponents as unknown as Json,
    prompt_intent_type: analysis.promptIntentType,
    prompt_theme: analysis.promptTheme,
    stuck_type: analysis.stuckType,
  };
  if (analysis.cueWasEffective !== undefined) payload.cue_was_effective = analysis.cueWasEffective;
  // Snapshot nested caller objects as they will be serialized by the SDK. An
  // asynchronous caller must not mutate an in-flight or retry payload.
  return JSON.parse(JSON.stringify(payload)) as TablesInsert<'utterance_analyses'>;
}

export const useUtteranceLogger = (): UtteranceLoggerReturn => {
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);
  const [isFinalized, setIsFinalized] = useState(false);
  const attemptsRef = useRef(new Map<string, AttemptRecord>());
  const activeAttemptRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const startAttempt = useCallback((context: Omit<AttemptContext, 'attemptId' | 'pronRequestId' | 'startedAt'>) => {
    const attemptId = crypto.randomUUID();
    const pronRequestId = crypto.randomUUID();
    const snapshot = Object.freeze({
      ...context,
      exerciseSlug: normalizeExerciseSlug(context.exerciseSlug),
      attemptId, pronRequestId, startedAt: Date.now(),
    });
    attemptsRef.current.set(attemptId, { context: snapshot, browserTranscript: null, state: 'open' });
    activeAttemptRef.current = attemptId;
    if (mountedRef.current) {
      setCurrentAttemptId(attemptId);
      setIsFinalized(false);
    }
    return { attemptId, pronRequestId };
  }, []);

  const logBrowserTranscript = useCallback((transcript: string, attemptId?: string | null): void => {
    // Legacy recognition callbacks are synchronous; asynchronous callers can
    // supply their original ID. An explicit null never borrows active context.
    const id = attemptId === undefined ? activeAttemptRef.current : attemptId;
    const record = id ? attemptsRef.current.get(id) : undefined;
    if (!record || record.state !== 'open') return;
    record.browserTranscript = transcript;
  }, []);

  const logFinalAnalysis = useCallback(async (analysis: FinalAnalysisInput): Promise<FinalizationResult> => {
    const explicitIdentity = Object.prototype.hasOwnProperty.call(analysis, 'attemptId');
    // Keep the synchronous legacy API stable. Async game callbacks must use
    // captureAttempt() before awaiting work, or pass an explicit original ID.
    const id = explicitIdentity ? analysis.attemptId ?? null : activeAttemptRef.current;
    const record = id ? attemptsRef.current.get(id) : undefined;
    if (!record || !id) return { status: 'missing_attempt', attemptId: id ?? null };
    if (record.state === 'persisted') return { status: 'persisted', attemptId: id, duplicate: true };
    if (record.state === 'saving') return { status: 'in_flight', attemptId: id };

    record.state = 'saving';
    try {
      record.payload ??= buildPayload(record, analysis);
      const response = await supabase.from('utterance_analyses').upsert(record.payload, { onConflict: 'attempt_id' });
      if (!response || response.error) {
        record.state = 'failed';
        // Do not log transcripts, patient identifiers, or server error bodies.
        console.warn('[UtteranceLogger] Write was not acknowledged; retry remains available.');
        return { status: 'failed', attemptId: id, reason: 'database_error' };
      }
      record.state = 'persisted';
      // Retain the deduplication marker, not completed audio-analysis payloads.
      record.payload = undefined;
      record.browserTranscript = null;
      if (mountedRef.current && activeAttemptRef.current === id) setIsFinalized(true);
      return { status: 'persisted', attemptId: id, duplicate: false };
    } catch {
      record.state = 'failed';
      console.warn('[UtteranceLogger] Transport or payload failure; retry remains available.');
      return { status: 'failed', attemptId: id, reason: 'transport_or_payload_error' };
    }
  }, []);

  const captureAttempt = useCallback((): CapturedAttempt => {
    const id = activeAttemptRef.current;
    const browserTranscript = id ? attemptsRef.current.get(id)?.browserTranscript : null;
    // This function is stable across renders and reads the active identity at
    // invocation. The returned finalizer never reads the next active attempt.
    return Object.freeze({
      attemptId: id,
      finalize: (analysis: Omit<FinalAnalysisInput, 'attemptId'>) => logFinalAnalysis({
        ...analysis,
        attemptId: id,
        transcript: analysis.transcript ?? browserTranscript ?? undefined,
      }),
    });
  }, [logFinalAnalysis]);

  const resetAttempt = useCallback((): void => {
    activeAttemptRef.current = null;
    // Retain attempt records for callbacks already in flight. Their lifetime
    // is this hook instance, not a global cache or cross-user singleton.
    if (mountedRef.current) {
      setCurrentAttemptId(null);
      setIsFinalized(false);
    }
  }, []);

  return { currentAttemptId, isFinalized, startAttempt, logBrowserTranscript, logFinalAnalysis, captureAttempt, resetAttempt };
};
