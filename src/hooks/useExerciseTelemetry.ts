import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ErrorClassificationResult } from '@/lib/errorClassifier';

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
}

export const useExerciseTelemetry = (
  sessionId: string | null,
  exerciseSlug: string
) => {
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
