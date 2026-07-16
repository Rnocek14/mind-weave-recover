import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';
import { buildCleaningEvents, normalizeASROutput } from '@/lib/speechNormalizer';

/**
 * Proper attempt-based logging for speech exercises.
 * 
 * Design principles:
 * 1. ONE attempt_id per trial attempt (no duplicates)
 * 2. Browser transcript logged immediately as interim
 * 3. Final analysis upserted to utterance_analyses (clean table for analytics)
 * 4. Every attempt gets analyzed, even failures
 * 5. Idempotent finalization - logFinalAnalysis can only be called once per attempt
 * 6. Tracks cue_trigger (stall/consecutive_errors/user_request) for learning signal analysis
 */

interface AttemptContext {
  attemptId: string;
  pronRequestId: string; // Always generated - correlation ID for all pronunciation tracing
  sessionId: string;
  userId: string;
  exerciseSlug: string;
  trialIndex: number;
  attemptNumber: number;
  targetWord: string;
  category?: string;
  startedAt: number;
}

// Fluency diagnostic: why fluency might not be available
export type FluencyUnavailableReason = 
  | 'no_recording' 
  | 'no_session' 
  | 'not_authed' 
  | 'permission_denied' 
  | 'recorder_error'
  | 'analysis_error'
  | 'wav_conversion_failed'
  | 'azure_api_error'
  | 'discourse_task';

// Structured pronunciation diagnostics for admin debugging
export interface PronunciationDiagnostics {
  pronRequestId?: string;
  pronunciationStatus?: 'pending' | 'complete' | 'failed' | 'skipped';
  pronunciationErrorStage?: 'wav_conversion' | 'base64_encoding' | 'edge_function' | 'azure_api' | 'unexpected';
  pronunciationTimingsMs?: { wav?: number; base64?: number; edge?: number; total: number };
  audioMeta?: { originalMime: string; originalSize: number; wavSize?: number; base64Len?: number };
}

// Evaluation model discriminator
export type EvaluationModel = 'test' | 'flow';

// Momentum components for flow evaluation (explainable)
export interface MomentumComponents {
  pauseRatio: number;
  prewordPauseAvgMs: number;
  filledPauseRate: number;
  burstCount: number;
  longestPauseMs: number;
  trailingOffDetected: boolean;
}

interface UtteranceLoggerReturn {
  currentAttemptId: string | null;
  isFinalized: boolean;
  startAttempt: (context: Omit<AttemptContext, 'attemptId' | 'pronRequestId' | 'startedAt'>) => { attemptId: string; pronRequestId: string };
  logBrowserTranscript: (transcript: string) => void;
  logFinalAnalysis: (analysis: {
    transcript?: string;
    transcriptSource: 'browser' | 'whisper' | 'manual';
    asrConfidence?: number;
    // CHANGED: Optional for flow games (no correctness concept)
    isCorrect?: boolean | null;
    errorType?: string;
    phonologicalSimilarity?: number;
    semanticSimilarity?: number | null; // null = intentionally skipped (no_response)
    classificationConfidence?: number;
    reasoning?: string;
    speechRateWpm?: number;
    pauseCount?: number;
    totalPauseMs?: number;
    avgPauseDurationMs?: number;
    effortfulSpeech?: boolean;
    // Fluency diagnostics
    fluencyAvailable?: boolean;
    fluencyUnavailableReason?: FluencyUnavailableReason;
    // Cue tracking
    cueTypeGiven?: string;
    cueWasEffective?: boolean;
    timeToSuccessAfterCueMs?: number;
    cueTrigger?: 'stall' | 'consecutive_errors' | 'user_request';
    audioStoragePath?: string;
    recordingDurationMs?: number;
    // Azure Pronunciation Assessment scores
    pronunciationScore?: number;
    accuracyScore?: number;
    fluencyScore?: number;
    completenessScore?: number;
    prosodyScore?: number;
    gopData?: any; // Full Azure response with word/phoneme-level data
    alignmentData?: { // Word/phone timing for micro-fluency analysis
      word_segments: { word: string; start: number; end: number }[];
      phone_segments: { phone: string; start: number; end: number }[];
    };
    // Pronunciation analysis error tracking (legacy - prefer diagnostics)
    pronunciationError?: string;
    // NEW: Structured pronunciation diagnostics
    pronunciationDiagnostics?: PronunciationDiagnostics;
    // NEW: Evaluation model (test = right/wrong, flow = momentum-based)
    evaluationModel?: EvaluationModel;
    // NEW: Flow-specific metrics (only used when evaluationModel = 'flow')
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
    // NEW: Stuck-type classification for flow games
    stuckType?: string;
  }) => Promise<void>;
  resetAttempt: () => void;
}

export const useUtteranceLogger = (): UtteranceLoggerReturn => {
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);
  const [isFinalized, setIsFinalized] = useState(false);
  const attemptContextRef = useRef<AttemptContext | null>(null);
  const browserTranscriptRef = useRef<string | null>(null);
  const finalizedRef = useRef(false); // Prevents double-finalization

  /**
   * Start a new attempt - call this when a new trial begins
   * Returns { attemptId, pronRequestId } for correlation
   */
  const startAttempt = useCallback((context: Omit<AttemptContext, 'attemptId' | 'pronRequestId' | 'startedAt'>): { attemptId: string; pronRequestId: string } => {
    const attemptId = crypto.randomUUID();
    const pronRequestId = crypto.randomUUID(); // Always generate - even if pronunciation is skipped
    
    // Normalize the exercise slug for consistent analytics
    const normalizedSlug = normalizeExerciseSlug(context.exerciseSlug);
    
    attemptContextRef.current = {
      ...context,
      exerciseSlug: normalizedSlug,
      attemptId,
      pronRequestId,
      startedAt: Date.now()
    };
    
    browserTranscriptRef.current = null;
    finalizedRef.current = false; // Reset finalized flag for new attempt
    setIsFinalized(false);
    setCurrentAttemptId(attemptId);
    
    console.log('📝 [UtteranceLogger] New attempt started:', {
      attemptId,
      pronRequestId,
      target: context.targetWord,
      slug: normalizedSlug,
      sessionId: context.sessionId,
      userId: context.userId,
      trialIndex: context.trialIndex
    });
    
    return { attemptId, pronRequestId };
  }, []);

  /**
   * Log browser transcript (interim) - stores locally only, no DB writes
   * This is called on every speech recognition result but only stores the latest
   * DB write happens once in logFinalAnalysis to avoid duplicates
   */
  const logBrowserTranscript = useCallback((transcript: string): void => {
    const ctx = attemptContextRef.current;
    if (!ctx) {
      console.warn('⚠️ No active attempt context for transcript');
      return;
    }

    // Store locally only - will be included in final analysis
    browserTranscriptRef.current = transcript;
    console.log('🎤 Browser transcript captured for attempt:', ctx.attemptId, transcript);
  }, []);

  /**
   * Log final analysis - this is the REAL logging that goes to utterance_analyses
   * Call this when the trial completes (success, failure, timeout, or abandon)
   * 
   * IDEMPOTENT: Can only be called once per attempt - subsequent calls are ignored
   */
  const logFinalAnalysis = useCallback(async (analysis: {
    // Core transcript data
    transcript?: string;
    transcriptSource: 'browser' | 'whisper' | 'manual';
    asrConfidence?: number;
    // Error classification - OPTIONAL for flow games
    isCorrect?: boolean | null;
    errorType?: string;
    phonologicalSimilarity?: number;
    semanticSimilarity?: number | null;
    classificationConfidence?: number;
    reasoning?: string;
    // Fluency metrics
    speechRateWpm?: number;
    pauseCount?: number;
    totalPauseMs?: number;
    avgPauseDurationMs?: number;
    effortfulSpeech?: boolean;
    fluencyAvailable?: boolean;
    fluencyUnavailableReason?: FluencyUnavailableReason;
    // Cue tracking
    cueTypeGiven?: string;
    cueWasEffective?: boolean;
    timeToSuccessAfterCueMs?: number;
    cueTrigger?: 'stall' | 'consecutive_errors' | 'user_request';
    // Audio data
    audioStoragePath?: string;
    recordingDurationMs?: number;
    // Azure Pronunciation Assessment
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
    // Pronunciation analysis error tracking (legacy)
    pronunciationError?: string;
    // Structured pronunciation diagnostics
    pronunciationDiagnostics?: PronunciationDiagnostics;
    // NEW: Evaluation model (test = right/wrong, flow = momentum-based)
    evaluationModel?: EvaluationModel;
    // NEW: Flow-specific metrics (only used when evaluationModel = 'flow')
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
    // NEW: Stuck-type classification for flow games
    stuckType?: string;
  }): Promise<void> => {
    // IDEMPOTENT GUARD: Prevent double-finalization
    if (finalizedRef.current) {
      console.log('⏭️ Attempt already finalized, skipping duplicate logFinalAnalysis');
      return;
    }
    
    const ctx = attemptContextRef.current;
    if (!ctx) {
      console.error('❌ No active attempt context for final analysis');
      return;
    }

    // Mark as finalized BEFORE async operations to prevent race conditions
    finalizedRef.current = true;
    setIsFinalized(true);

    const latencyMs = Date.now() - ctx.startedAt;
    
    // Use Whisper transcript if available, fall back to browser transcript
    const finalTranscript = analysis.transcript || browserTranscriptRef.current;

    // ── Voice Engine v2 Phase 1: pure capture (docs/voice-engine-v2-spec.md §4, §5) ──
    // Persist both raw ASR sources, which one won, the cleaned transcript + the
    // structured cleaning events, and the per-source confidences. This is
    // capture ONLY — nothing below feeds is_correct / error_type / scoring.
    const browserRaw = browserTranscriptRef.current ?? null;
    // analysis.transcript is the Azure/Whisper string only when that source won.
    const azureRaw = analysis.transcriptSource === 'whisper' ? (analysis.transcript ?? null) : null;
    // Normalize the legacy 'whisper' source label to the spec's 'azure'.
    const chosenTranscriptSource =
      analysis.transcriptSource === 'whisper' ? 'azure' : analysis.transcriptSource;
    const cleaning = buildCleaningEvents(finalTranscript ?? '');
    // We only hold the chosen source's confidence here; record it honestly and
    // leave the other source null rather than inventing a value.
    const sourceConfidences: Record<string, number | null> = { azure: null, browser: null };
    if (chosenTranscriptSource === 'azure' || chosenTranscriptSource === 'browser') {
      sourceConfidences[chosenTranscriptSource] =
        typeof analysis.asrConfidence === 'number' ? analysis.asrConfidence : null;
    }
    // Agreement is only defined when both sources produced content.
    const sourcesAgreed =
      browserRaw && azureRaw
        ? normalizeASROutput(browserRaw) === normalizeASROutput(azureRaw)
        : null;

    console.log('📊 [UtteranceLogger] Logging final analysis:', {
      attemptId: ctx.attemptId,
      target: ctx.targetWord,
      transcript: finalTranscript,
      isCorrect: analysis.isCorrect,
      errorType: analysis.errorType,
      sessionId: ctx.sessionId,
      hasAudio: !!analysis.audioStoragePath,
      pipelineStatus: analysis.audioStoragePath ? 'pending_alignment' : 'complete_no_audio',
      phonologicalSim: analysis.phonologicalSimilarity,
      semanticSim: analysis.semanticSimilarity,
      cueTypeGiven: analysis.cueTypeGiven,
      fluencyAvailable: analysis.fluencyAvailable,
      fluencyUnavailableReason: analysis.fluencyUnavailableReason
    });

    try {
      // Determine analysis status: 'pending' if audio available (for MFA worker), else 'complete'
      const hasAudioForAnalysis = !!analysis.audioStoragePath;
      
      // Extract structured diagnostics (prefer new format, fall back to legacy)
      const diag = analysis.pronunciationDiagnostics;
      const hasPronSuccess = !!analysis.gopData;
      const hasPronError = !!analysis.pronunciationError || diag?.pronunciationStatus === 'failed';
      
      // Determine pronunciation status - IMPORTANT: Don't use 'pending' unless there's a background processor
      // Since pronunciation is computed inline, it's either complete, failed, or skipped
      let pronunciationStatus: string;
      if (hasPronSuccess) {
        pronunciationStatus = 'complete';
      } else if (hasPronError) {
        pronunciationStatus = 'failed';
      } else if (!hasAudioForAnalysis) {
        pronunciationStatus = 'skipped'; // No audio = intentionally didn't run
      } else {
        // Had audio but no success/error = pronunciation was skipped (not attempted)
        pronunciationStatus = 'skipped';
      }

      // Build payload - CRITICAL: Only include cue_was_effective when explicitly true/false
      // to avoid overwriting with NULL on subsequent upserts
      const payload: Record<string, any> = {
        attempt_id: ctx.attemptId,
        user_id: ctx.userId,
        session_id: ctx.sessionId,
        exercise_slug: ctx.exerciseSlug, // Already normalized in startAttempt
        trial_index: ctx.trialIndex,
        attempt_number: ctx.attemptNumber,
        target_word: ctx.targetWord,
        category: ctx.category,
        transcript: finalTranscript,
        transcript_source: analysis.transcriptSource,
        asr_confidence: analysis.asrConfidence,
        // Voice Engine v2 Phase 1 capture (no scoring impact):
        raw_transcript_browser: browserRaw,
        raw_transcript_azure: azureRaw,
        chosen_transcript_source: chosenTranscriptSource,
        cleaned_transcript: cleaning.cleaned || null,
        cleaning_events: finalTranscript ? cleaning.events : null,
        source_confidences: sourceConfidences,
        sources_agreed: sourcesAgreed,
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
        latency_ms: latencyMs,
        recording_duration_ms: analysis.recordingDurationMs,
        audio_storage_path: analysis.audioStoragePath,
        fluency_available: analysis.fluencyAvailable,
        fluency_unavailable_reason: analysis.fluencyUnavailableReason,
        // Azure Pronunciation Assessment: store normalized gop_data with source marker
        gop_data: analysis.gopData ? {
          schemaVersion: 'azure-pa-v2', // Distinguishes enriched payloads (NBest + word ErrorType) from legacy
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
        // Azure alignment data for micro-fluency analysis
        alignment_data: analysis.alignmentData ?? (analysis.gopData?.alignmentData ? {
          word_segments: analysis.gopData.alignmentData.word_segments,
          phone_segments: analysis.gopData.alignmentData.phone_segments
        } : null),
        // Pipeline status: Since Azure pronunciation is computed inline (not queued), 
        // analysis_status is 'complete' when we have gop_data, otherwise depends on audio
        analysis_status: analysis.gopData ? 'complete' : (hasAudioForAnalysis ? 'complete' : 'complete'),
        // Keep error_message for legacy/overall attempt errors only
        error_message: null, // Don't mix pronunciation errors here
        // Clear worker queue fields - we don't use background processing for pronunciation anymore
        locked_at: null,
        locked_by: null,
        next_retry_at: null,
        analysis_priority: 0,
        
        // NEW: Structured pronunciation diagnostics for admin debugging
        // ALWAYS include pronRequestId from context (even if pronunciation was skipped)
        pron_request_id: diag?.pronRequestId || ctx.pronRequestId,
        pronunciation_status: pronunciationStatus,
        pronunciation_error_stage: diag?.pronunciationErrorStage,
        pronunciation_error_message: analysis.pronunciationError || (diag?.pronunciationErrorStage ? `${diag.pronunciationErrorStage} failed` : null),
        pronunciation_timings_ms: diag?.pronunciationTimingsMs,
        audio_meta: diag?.audioMeta,
        
        // NEW: Flow evaluation model fields
        evaluation_model: analysis.evaluationModel ?? 'test',
        did_speak: analysis.didSpeak,
        utterance_complete: analysis.utteranceComplete,
        coherence_score: analysis.coherenceScore,
        momentum_score: analysis.momentumScore,
        latency_to_first_word_ms: analysis.latencyToFirstWordMs,
        narrowing_level_used: analysis.narrowingLevelUsed,
        narrowing_trigger: analysis.narrowingTrigger,
        momentum_components: analysis.momentumComponents,
        prompt_intent_type: analysis.promptIntentType,
        prompt_theme: analysis.promptTheme,
        // NEW: Stuck-type classification
        stuck_type: analysis.stuckType,
      };

      // CRITICAL: Only include cue_was_effective when explicitly true or false
      // This prevents NULL overwrites on subsequent upserts
      if (analysis.cueWasEffective === true || analysis.cueWasEffective === false) {
        payload.cue_was_effective = analysis.cueWasEffective;
      }

      console.log('[utterance_analyses write]', {
        attemptId: ctx.attemptId,
        cueTypeGiven: analysis.cueTypeGiven,
        cueTrigger: analysis.cueTrigger,
        timeToSuccessAfterCueMs: analysis.timeToSuccessAfterCueMs,
        cueWasEffective: analysis.cueWasEffective,
        willWriteCueWasEffective: (analysis.cueWasEffective === true || analysis.cueWasEffective === false),
      });

      // Upsert to utterance_analyses (clean analytics table)
      const { error: uaError } = await supabase
        .from('utterance_analyses')
        .upsert(payload as any, {
          onConflict: 'attempt_id'
        });

      if (uaError) {
        console.error('❌ Failed to log to utterance_analyses:', uaError);
      } else {
        console.log('✅ Utterance analysis logged successfully');
      }

    } catch (err) {
      console.error('❌ Error logging final analysis:', err);
    }
  }, []);

  /**
   * Reset current attempt (call when moving to next trial)
   */
  const resetAttempt = useCallback((): void => {
    attemptContextRef.current = null;
    browserTranscriptRef.current = null;
    finalizedRef.current = false;
    setIsFinalized(false);
    setCurrentAttemptId(null);
  }, []);

  return {
    currentAttemptId,
    isFinalized,
    startAttempt,
    logBrowserTranscript,
    logFinalAnalysis,
    resetAttempt
  };
};
