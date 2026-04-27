import { useRef, useCallback } from 'react';
import { EngagementMonitor, type TrialResult, type EngagementState } from '@/lib/engagementMonitor';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook for monitoring user engagement during exercise sessions
 * Tracks frustration and fatigue, recommends interventions
 */
export const useEngagementMonitor = (sessionId: string | null) => {
  const monitorRef = useRef<EngagementMonitor>(new EngagementMonitor(10));

  /**
   * Record a trial result and update engagement assessment
   */
  const recordTrial = useCallback((trial: TrialResult): EngagementState => {
    monitorRef.current.addTrial(trial);
    const state = monitorRef.current.assessState();
    if (import.meta.env.DEV) {
      // Per-trial visibility for validating engagement signals + cue dependency.
      // Logged at debug level so it's easy to filter in DevTools.
      console.debug('[engagement]', {
        correct: trial.correct,
        rt: trial.reactionTimeMs,
        cueLevel: trial.cueLevel,
        timeout: trial.timeout ?? false,
        frustration: state.frustration,
        fatigue: state.fatigue,
        cueDependency: Number(state.signals.cueDependency.toFixed(2)),
        errorStreak: state.signals.errorStreak,
        recommended: state.recommendedAction,
      });
    }
    return state;
  }, []);

  /**
   * Track behavioral signals (pause, quit attempt, etc.)
   */
  const trackBehavior = useCallback((event: 'pause' | 'end_attempt' | 'cue_request') => {
    monitorRef.current.trackBehavior(event);
  }, []);

  /**
   * Get current engagement state without adding new data
   */
  const getState = useCallback((): EngagementState => {
    return monitorRef.current.assessState();
  }, []);

  /**
   * Get engagement flags for database logging
   */
  const getEngagementFlags = useCallback(() => {
    return monitorRef.current.getEngagementFlags();
  }, []);

  /**
   * Log an intervention to the database
   */
  const logIntervention = useCallback(async (
    triggerType: string,
    intervention: string,
    userAction?: string
  ) => {
    if (!sessionId) {
      console.warn('No session ID - intervention not logged');
      return;
    }

    try {
      const state = monitorRef.current.assessState();
      const { error } = await supabase
        .from('engagement_interventions')
        .insert({
          session_id: sessionId,
          trigger_type: triggerType,
          intervention,
          user_action: userAction || null,
          trigger_data: {
            signals: state.signals,
            frustration: state.frustration,
            fatigue: state.fatigue,
            confidence: state.confidence
          }
        } as any); // Type assertion until Supabase types regenerate

      if (error) throw error;
    } catch (error) {
      console.error('Error logging intervention:', error);
    }
  }, [sessionId]);

  /**
   * Reset monitor for new session
   */
  const reset = useCallback(() => {
    monitorRef.current.reset();
  }, []);

  /**
   * Get diagnostics for debugging
   */
  const getDiagnostics = useCallback(() => {
    return monitorRef.current.getDiagnostics();
  }, []);

  return {
    recordTrial,
    trackBehavior,
    getState,
    getEngagementFlags,
    logIntervention,
    reset,
    getDiagnostics
  };
};
