import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TodayFocus } from '@/lib/adaptiveDecisionEngine';

interface LogParams {
  userId: string;
  profileId?: string;
  todayFocus: TodayFocus;
  performanceSignals?: {
    avgAccuracy?: number;
    timeoutRate?: number;
    avgReactionTimeMs?: number;
    semanticErrorRate?: number;
  };
}

/**
 * Hook to log adaptive engine decisions idempotently (once per day per user)
 */
export const useAdaptiveDecisionLog = () => {
  // Track if we've already logged today to prevent duplicate calls
  const loggedTodayRef = useRef<string | null>(null);

  const logDecision = useCallback(async ({
    userId,
    profileId,
    todayFocus,
    performanceSignals,
  }: LogParams): Promise<boolean> => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const cacheKey = `${userId}:${today}`;

    // Skip if already logged today (in-memory cache)
    if (loggedTodayRef.current === cacheKey) {
      console.log('[AdaptiveDecisionLog] Already logged today, skipping');
      return false;
    }

    try {
      // Use type assertion for new table until Supabase types regenerate
      const { error } = await (supabase
        .from('adaptive_decision_logs' as any)
        .insert({
          user_id: userId,
          profile_id: profileId || null,
          log_date: today,
          confidence_level: todayFocus.confidence,
          trial_count: todayFocus.inputSnapshot.trialCount,
          utterance_count: todayFocus.inputSnapshot.utteranceCount,
          assessment_age_days: todayFocus.inputSnapshot.assessmentAgeDays ?? null,
          avg_accuracy: performanceSignals?.avgAccuracy ?? todayFocus.inputSnapshot.accuracy ?? null,
          timeout_rate: performanceSignals?.timeoutRate ?? todayFocus.inputSnapshot.timeoutRate ?? null,
          avg_reaction_time_ms: performanceSignals?.avgReactionTimeMs ?? null,
          semantic_error_rate: performanceSignals?.semanticErrorRate ?? null,
          rules_fired: todayFocus.rulesApplied.map(r => r.ruleId),
          rules_data: todayFocus.rulesApplied,
          adaptations: todayFocus.adaptations,
          reasoning: todayFocus.reasoning,
        }) as any);

      if (error) {
        // Check if it's a duplicate key error (expected for idempotency)
        if (error.code === '23505') {
          console.log('[AdaptiveDecisionLog] Already logged today (DB constraint), skipping');
          loggedTodayRef.current = cacheKey;
          return false;
        }
        console.error('[AdaptiveDecisionLog] Error logging decision:', error);
        return false;
      }

      console.log('[AdaptiveDecisionLog] Decision logged:', {
        confidence: todayFocus.confidence,
        rulesApplied: todayFocus.rulesApplied.map(r => r.ruleId),
        adaptations: Object.keys(todayFocus.adaptations),
      });

      loggedTodayRef.current = cacheKey;
      return true;
    } catch (err) {
      console.error('[AdaptiveDecisionLog] Unexpected error:', err);
      return false;
    }
  }, []);

  return { logDecision };
};
