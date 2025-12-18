import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';

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
  | 'analysis_error';

interface UtteranceLoggerReturn {
  currentAttemptId: string | null;
  isFinalized: boolean;
  startAttempt: (context: Omit<AttemptContext, 'attemptId' | 'startedAt'>) => string;
  logBrowserTranscript: (transcript: string) => void;
  logFinalAnalysis: (analysis: {
    transcript?: string;
    transcriptSource: 'browser' | 'whisper' | 'manual';
    asrConfidence?: number;
    isCorrect: boolean;
    errorType: string;
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
   */
  const startAttempt = useCallback((context: Omit<AttemptContext, 'attemptId' | 'startedAt'>): string => {
    const attemptId = crypto.randomUUID();
    
    // Normalize the exercise slug for consistent analytics
    const normalizedSlug = normalizeExerciseSlug(context.exerciseSlug);
    
    attemptContextRef.current = {
      ...context,
      exerciseSlug: normalizedSlug,
      attemptId,
      startedAt: Date.now()
    };
    
    browserTranscriptRef.current = null;
    finalizedRef.current = false; // Reset finalized flag for new attempt
    setIsFinalized(false);
    setCurrentAttemptId(attemptId);
    
    console.log('📝 [UtteranceLogger] New attempt started:', {
      attemptId,
      target: context.targetWord,
      slug: normalizedSlug,
      sessionId: context.sessionId,
      userId: context.userId,
      trialIndex: context.trialIndex
    });
    
    return attemptId;
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
    // Error classification
    isCorrect: boolean;
    errorType: string;
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
        // Pipeline status: Azure replaces MFA worker, mark complete immediately when Azure data exists
        analysis_status: analysis.gopData ? 'complete' : (hasAudioForAnalysis ? 'pending' : 'complete'),
        // Clear worker queue fields when Azure provides data
        locked_at: analysis.gopData ? null : undefined,
        locked_by: analysis.gopData ? null : undefined,
        next_retry_at: (!analysis.gopData && hasAudioForAnalysis) ? new Date().toISOString() : null,
        analysis_priority: hasAudioForAnalysis ? 1 : 0
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
