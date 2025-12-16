import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { UtteranceAnalysis } from '@/types/utteranceAnalysis';

/**
 * Proper attempt-based logging for speech exercises.
 * 
 * Design principles:
 * 1. ONE attempt_id per trial attempt (no duplicates)
 * 2. Browser transcript logged immediately as interim
 * 3. Final analysis upserted to utterance_analyses (clean table for analytics)
 * 4. Every attempt gets analyzed, even failures
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

interface UtteranceLoggerReturn {
  currentAttemptId: string | null;
  startAttempt: (context: Omit<AttemptContext, 'attemptId' | 'startedAt'>) => string;
  logBrowserTranscript: (transcript: string) => void;
  logFinalAnalysis: (analysis: {
    transcript?: string;
    transcriptSource: 'browser' | 'whisper' | 'manual';
    asrConfidence?: number;
    isCorrect: boolean;
    errorType: string;
    phonologicalSimilarity?: number;
    semanticSimilarity?: number;
    classificationConfidence?: number;
    reasoning?: string;
    speechRateWpm?: number;
    pauseCount?: number;
    totalPauseMs?: number;
    avgPauseDurationMs?: number;
    effortfulSpeech?: boolean;
    cueTypeGiven?: string;
    cueWasEffective?: boolean;
    timeToSuccessAfterCueMs?: number;
    audioStoragePath?: string;
    recordingDurationMs?: number;
  }) => Promise<void>;
  resetAttempt: () => void;
}

export const useUtteranceLogger = (): UtteranceLoggerReturn => {
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);
  const attemptContextRef = useRef<AttemptContext | null>(null);
  const browserTranscriptRef = useRef<string | null>(null);

  /**
   * Start a new attempt - call this when a new trial begins
   */
  const startAttempt = useCallback((context: Omit<AttemptContext, 'attemptId' | 'startedAt'>): string => {
    const attemptId = crypto.randomUUID();
    
    attemptContextRef.current = {
      ...context,
      attemptId,
      startedAt: Date.now()
    };
    
    browserTranscriptRef.current = null;
    setCurrentAttemptId(attemptId);
    
    console.log('📝 New attempt started:', attemptId, 'target:', context.targetWord);
    
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
   */
  const logFinalAnalysis = useCallback(async (analysis: {
    transcript?: string;
    transcriptSource: 'browser' | 'whisper' | 'manual';
    asrConfidence?: number;
    isCorrect: boolean;
    errorType: string;
    phonologicalSimilarity?: number;
    semanticSimilarity?: number;
    classificationConfidence?: number;
    reasoning?: string;
    speechRateWpm?: number;
    pauseCount?: number;
    totalPauseMs?: number;
    avgPauseDurationMs?: number;
    effortfulSpeech?: boolean;
    cueTypeGiven?: string;
    cueWasEffective?: boolean;
    timeToSuccessAfterCueMs?: number;
    audioStoragePath?: string;
    recordingDurationMs?: number;
  }): Promise<void> => {
    const ctx = attemptContextRef.current;
    if (!ctx) {
      console.error('❌ No active attempt context for final analysis');
      return;
    }

    const latencyMs = Date.now() - ctx.startedAt;
    
    // Use Whisper transcript if available, fall back to browser transcript
    const finalTranscript = analysis.transcript || browserTranscriptRef.current;

    console.log('📊 Logging final analysis for attempt:', ctx.attemptId, {
      target: ctx.targetWord,
      transcript: finalTranscript,
      isCorrect: analysis.isCorrect,
      errorType: analysis.errorType
    });

    try {
      // Upsert to utterance_analyses (clean analytics table)
      const { error: uaError } = await supabase
        .from('utterance_analyses')
        .upsert({
          attempt_id: ctx.attemptId,
          user_id: ctx.userId,
          session_id: ctx.sessionId,
          exercise_slug: ctx.exerciseSlug,
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
          cue_was_effective: analysis.cueWasEffective,
          time_to_success_after_cue_ms: analysis.timeToSuccessAfterCueMs,
          latency_ms: latencyMs,
          recording_duration_ms: analysis.recordingDurationMs,
          audio_storage_path: analysis.audioStoragePath
        }, {
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
    setCurrentAttemptId(null);
  }, []);

  return {
    currentAttemptId,
    startAttempt,
    logBrowserTranscript,
    logFinalAnalysis,
    resetAttempt
  };
};
