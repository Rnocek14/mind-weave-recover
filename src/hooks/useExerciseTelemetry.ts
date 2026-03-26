import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMicroEncouragement } from '@/hooks/useMicroEncouragement';
import type { ErrorClassificationResult } from '@/lib/errorClassifier';
import type { UtteranceAnalysis, ShadowEvent } from '@/types/utteranceAnalysis';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';

export type CueType = 'none' | 'semantic' | 'phonemic' | 'full_word';

export interface TrialData {
  correct: boolean;
  reactionTimeMs: number;
  cueLevel?: number; // 0=none, 1=semantic, 2=phonemic, 3=full
  errorType?: string; // e.g. 'semantic_related', 'phonological', 'omission', 'spatial_miss'
  taskParameters?: Record<string, any>; // Current difficulty state
  errorClassification?: ErrorClassificationResult; // Detailed error classification from ML
  engagementFlags?: Record<string, any>; // Frustration/fatigue state from engagement monitor
  adaptationsActive?: {
    extended_time?: boolean;
    larger_targets?: boolean;
    audio_cues?: boolean;
    high_contrast?: boolean;
    simplified_ui?: boolean;
  }; // Track which adaptations are currently active
  audioStoragePath?: string; // Path to audio recording in storage
  recordingDurationMs?: number; // Duration of audio recording
  audioMimeType?: string; // MIME type of audio (webm, mp4, etc.)
  whisperTranscript?: string; // Whisper transcription of audio
  whisperConfidence?: number; // Whisper confidence score (0-1)
  acousticMetrics?: {
    speechRateWpm: number;
    totalDurationSec: number;
    wordCount: number;
    pauseCount: number;
    avgPauseDurationMs: number;
    totalPauseDurationSec: number;
    speechToPauseRatio: number;
    segmentCount: number;
  };
  // Structured analysis for future co-pilot
  utteranceAnalysis?: UtteranceAnalysis;
  shadowEvent?: ShadowEvent;
  // NEW: Cue efficacy tracking for UserSpeechProfile
  cueTypeGiven?: CueType;
  cueWasEffective?: boolean | null;
  timeToSuccessAfterCueMs?: number | null;
  // Structured outputs for CSE consumption (explanation + depth)
  trialOutputs?: Record<string, any>;
}

/**
 * Runtime guard: ensures trialOutputs has correct shape before persistence.
 * - depth always includes taskType (inferred from slug if missing)
 * - explanation numeric fields coerced or dropped
 */
function sanitizeTrialOutputs(
  outputs: Record<string, any> | undefined,
  exerciseSlug: string
): Record<string, any> {
  if (!outputs) return {};
  const result = { ...outputs };

  // Ensure depth.taskType is always present
  if (result.depth && typeof result.depth === 'object') {
    if (!result.depth.taskType) {
      // Infer from exercise slug: "narrative-retell" → "narrative_retell"
      result.depth = { ...result.depth, taskType: exerciseSlug.replace(/-/g, '_') };
    }
  }

  // Coerce explanation numeric fields
  if (result.explanation && typeof result.explanation === 'object') {
    const exp = { ...result.explanation };
    for (const key of ['coverageRatio', 'onTopicScore', 'conceptsFound', 'conceptsTotal'] as const) {
      if (key in exp && exp[key] !== null && typeof exp[key] !== 'number') {
        exp[key] = null; // Drop non-numeric values
      }
    }
    result.explanation = exp;
  }

  return result;
}

export const useExerciseTelemetry = (
  sessionId: string | null,
  rawExerciseSlug: string
) => {
  // Normalize slug at entry point
  const exerciseSlug = normalizeExerciseSlug(rawExerciseSlug);
  const [trialNumber, setTrialNumber] = useState(0);
  const [trialStartTime, setTrialStartTime] = useState<number | null>(null);

  const startTrial = useCallback(() => {
    setTrialStartTime(Date.now());
    setTrialNumber((prev) => prev + 1);
  }, []);

  const logTrial = useCallback(
    async (trial: TrialData) => {
      if (!sessionId) {
        console.warn('No session ID - trial not logged');
        return;
      }

      try {
        const eventData: any = {
          session_id: sessionId,
          exercise_slug: exerciseSlug,
          round: trialNumber,
          score: trial.correct ? 100 : 0,
          reaction_time_ms: trial.reactionTimeMs,
          cue_level: trial.cueLevel ?? 0,
          error_type: trial.errorType,
          task_parameters: trial.taskParameters ?? {},
          inputs: {
            rt_ms: trial.reactionTimeMs,
            cue_level: trial.cueLevel ?? 0,
            error_type: trial.errorType,
          },
          outputs: {
            task_params: trial.taskParameters,
            timestamp: new Date().toISOString(),
            ...sanitizeTrialOutputs(trial.trialOutputs, exerciseSlug),
          },
        };

        // Add new error classification fields if available
        if (trial.errorClassification) {
          eventData.error_classification = {
            errorType: trial.errorClassification.errorType,
            confidence: trial.errorClassification.confidence,
            reasoning: trial.errorClassification.reasoning,
            needs_review: trial.errorClassification.needs_review
          };
          eventData.phonological_similarity = trial.errorClassification.phonological_similarity;
          eventData.semantic_similarity = trial.errorClassification.semantic_similarity;
          eventData.classification_confidence = trial.errorClassification.confidence;
          eventData.needs_review = trial.errorClassification.needs_review;
        }

        // Add engagement monitoring flags if available
        if (trial.engagementFlags) {
          eventData.engagement_flags = trial.engagementFlags;
        }

        // Add adaptation tracking if available
        if (trial.adaptationsActive) {
          eventData.adaptations_active = trial.adaptationsActive;
        }

        // Add audio recording metadata if available
        if (trial.audioStoragePath) {
          eventData.audio_storage_path = trial.audioStoragePath;
          eventData.recording_duration_ms = trial.recordingDurationMs;
          eventData.audio_mime_type = trial.audioMimeType;
        }

        // Add Whisper transcription and acoustic metrics if available
        if (trial.whisperTranscript) {
          eventData.whisper_transcript = trial.whisperTranscript;
          eventData.whisper_confidence = trial.whisperConfidence;
        }
        
        if (trial.acousticMetrics) {
          eventData.acoustic_metrics = trial.acousticMetrics;
        }

        // Add cue efficacy tracking fields
        if (trial.cueTypeGiven) {
          eventData.cue_type_given = trial.cueTypeGiven;
          eventData.cue_was_effective = trial.cueWasEffective ?? null;
          eventData.time_to_success_after_cue_ms = trial.timeToSuccessAfterCueMs ?? null;
        }

        const { error } = await supabase.from('exercise_events').insert(eventData);

        if (error) throw error;
      } catch (error) {
        console.error('Error logging trial:', error);
      }
    },
    [sessionId, exerciseSlug, trialNumber]
  );

  const calculateReactionTime = useCallback((): number => {
    if (!trialStartTime) return 0;
    return Date.now() - trialStartTime;
  }, [trialStartTime]);

  const reset = useCallback(() => {
    setTrialNumber(0);
    setTrialStartTime(null);
  }, []);

  return {
    trialNumber,
    startTrial,
    logTrial,
    calculateReactionTime,
    reset,
  };
};
