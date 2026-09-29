import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert, Json } from '@/integrations/supabase/types';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';

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
  pronunciationErrorStage?: 'wav_conversion' | 'base64_encoding' | 'edge_function' | 'azure_api' | 'unexpected';
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
  transcript?: string;
  transcriptSource: 'browser' | 'whisper' | 'manual';
  asrConfidence?: number;
  isCorrect?: boolean | null;
  errorType?: string;
  phonologicalSimilarity?: number;
  semanticSimilarity?: number | null;
  classificationConfidence?: number;
  reasoning?: string;
  speechRateWpm?: number;
  pauseCount?: number;
  totalPauseMs?: number;
  avgPauseDurationMs?: number;
  effortfulSpeech?: boolean;
  fluencyAvailable?: boolean;
  fluencyUnavailableReason?: FluencyUnavailableReason;
  cueTypeGiven?: string;
  cueWasEffective?: boolean;
  timeToSuccessAfterCueMs?: number;
  cueTrigger?: 'stall' | 'consecutive_errors' | 'user_request';
  audioStoragePath?: string;
  recordingDurationMs?: number;
  pronunciationScore?: number;
  accuracyScore?: number;
  fluencyScore?: number;
  completenessScore?: number;
  prosodyScore?: number;
  gopData?: any;
  alignmentData?: {
    word_segments: { word: string; start: number; end: number }[];
    phone_segments: { phone: string; start: number; end: number }[];
  };
  pronunciationError?: string;
  pronunciationDiagnostics?: PronunciationDiagnostics;
  evaluationModel?: EvaluationModel;
  didSpeak?: boolean;
  utteranceComplete?: boolean;
  coherenceScore?: number;
  momentumScore?: number;
  latencyToFirstWordMs?: number;
  narrowingLevelUsed?: number;
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

interface UtteranceLoggerReturn {
  currentAttemptId: string | null;
  isFinalized: boolean;
  startAttempt: (context: Omit<AttemptContext, 'attemptId' | 'pronRequestId' | 'startedAt'>) => { attemptId: string; pronRequestId: string };
  logBrowserTranscript: (transcript: string, attemptId?: string | null) => void;
  logFinalAnalysis: (analysis: FinalAnalysisInput) => Promise<FinalizationResult>;
  resetAttempt: () => void;
}

/** Preserve existing database columns and score semantics. */
function buildPayload(record: AttemptRecord, analysis: FinalAnalysisInput): TablesInsert<'utterance_analyses'> {
  const ctx = record.context;
  const diag = analysis.pronunciationDiagnostics;
  const hasPronError = !!analysis.pronunciationError || diag?.pronunciationStatus === 'failed';
  const pronunciationStatus = analysis.gopData ? 'complete' : hasPronError ? 'failed' : 'skipped';
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
    transcript_source: analysis.transcriptSource,
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
      schemaVersion: 'azure-pa-v2',
      source: 'azure',
      pronunciationScore: analysis.gopData.pronunciationScore ?? analysis.pronunciationScore ?? 0,
      accuracyScore: analysis.gopData.accuracyScore ?? analysis.accuracyScore ?? 0,
      fluencyScore: analysis.gopData.fluencyScore ?? analysis.fluencyScore ?? 0,
      completenessScore: analysis.gopData.completenessScore ?? analysis.completenessScore ?? 0,
      prosodyScore: analysis.gopData.prosodyScore ?? analysis.prosodyScore ?? 0,
      words: analysis.gopData.words ?? [],
      transcript: analysis.gopData.transcript ?? '',
      duration: analysis.gopData.duration ?? 0,
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
    audio_meta: diag?.audioMeta,
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
  if (typeof analysis.cueWasEffective === 'boolean') payload.cue_was_effective = analysis.cueWasEffective;
  // Snapshot nested caller objects as they will be serialized by the SDK. An
  // asynchronous caller must not mutate an in-flight or retry payload.
  return JSON.parse(JSON.stringify(payload)) as TablesInsert<'utterance_analyses'>;
}

export const useUtteranceLogger = (): UtteranceLoggerReturn => {
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);
  const [isFinalized, setIsFinalized] = useState(false);
  const attemptsRef = useRef(new Map<string, AttemptRecord>());
  const activeAttemptRef = useRef<string | null>(null);
  const epochRef = useRef(0);
  const mountedRef = useRef(true);
  const renderEpoch = epochRef.current;

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
    epochRef.current += 1;
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
    // Existing game handlers close over this render's finalizer. Binding that
    // render's ID protects late callbacks even before every game is migrated
    // to explicit IDs. The synchronous startAttempt+finalize legacy sequence
    // is supported only for the immediately next identity epoch.
    const id = explicitIdentity
      ? analysis.attemptId ?? null
      : currentAttemptId ?? (epochRef.current === renderEpoch + 1 ? activeAttemptRef.current : null);
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
      if (mountedRef.current && activeAttemptRef.current === id) setIsFinalized(true);
      return { status: 'persisted', attemptId: id, duplicate: false };
    } catch {
      record.state = 'failed';
      console.warn('[UtteranceLogger] Transport or payload failure; retry remains available.');
      return { status: 'failed', attemptId: id, reason: 'transport_or_payload_error' };
    }
  }, [currentAttemptId, renderEpoch]);

  const resetAttempt = useCallback((): void => {
    activeAttemptRef.current = null;
    epochRef.current += 1;
    // Retain attempt records for callbacks already in flight. Their lifetime
    // is this hook instance, not a global cache or cross-user singleton.
    if (mountedRef.current) {
      setCurrentAttemptId(null);
      setIsFinalized(false);
    }
  }, []);

  return { currentAttemptId, isFinalized, startAttempt, logBrowserTranscript, logFinalAnalysis, resetAttempt };
};
