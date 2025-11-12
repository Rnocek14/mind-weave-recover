import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TrialData {
  correct: boolean;
  reactionTimeMs: number;
  cueLevel?: number; // 0=none, 1=semantic, 2=phonemic, 3=full
  errorType?: string; // e.g. 'semantic_related', 'phonological', 'omission', 'spatial_miss'
  taskParameters?: Record<string, any>; // Current difficulty state
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
        const { error } = await supabase.from('exercise_events').insert({
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
        });

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
