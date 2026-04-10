/**
 * Shadow Event Logger
 * 
 * Captures system predictions vs actual user outcomes for ML training
 * and therapy optimization research.
 * 
 * Gated by Shadow Mode feature flag — no-ops when disabled.
 */

import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isShadowModeEnabled, SHADOW_MODEL_VERSION } from '@/lib/shadowMode';
import type { ShadowEvent } from '@/types/utteranceAnalysis';

interface UseShadowEventLoggerOptions {
  userId: string | undefined;
  profileId?: string;
  sessionId?: string | null;
  /** Profile runtime_config for feature flag check */
  runtimeConfig?: Record<string, any> | null;
}

export const useShadowEventLogger = ({
  userId,
  profileId,
  sessionId,
  runtimeConfig,
}: UseShadowEventLoggerOptions) => {
  const configRef = useRef({ userId, profileId, sessionId, runtimeConfig });
  
  // Update ref on changes
  configRef.current = { userId, profileId, sessionId, runtimeConfig };

  /**
   * Log a shadow event to the database (fire-and-forget).
   * Returns false if skipped (no user, flag off) or failed.
   */
  const logShadowEvent = useCallback(async (
    event: ShadowEvent,
    attemptId?: string,
    provenance?: {
      cueTypeCandidate?: string;
      triggerReason?: string;
      userSelfRecovered?: boolean;
      environment?: string;
    }
  ): Promise<boolean> => {
    const { userId, profileId, sessionId, runtimeConfig } = configRef.current;
    
    if (!userId) {
      if (import.meta.env.DEV) {
        console.debug('[ShadowEventLogger] No userId, skipping');
      }
      return false;
    }

    // Feature flag gate
    if (!isShadowModeEnabled(runtimeConfig)) {
      if (import.meta.env.DEV) {
        console.debug('[ShadowEventLogger] Shadow Mode disabled, skipping write');
      }
      return false;
    }

    try {
      const { error } = await supabase
        .from('shadow_events' as any)
        .insert({
          user_id: userId,
          profile_id: profileId || null,
          session_id: sessionId || null,
          attempt_id: attemptId || null,
          
          // Task context (from event.context)
          task_type: event.context.taskType,
          domain: event.context.domain || null,
          interaction_mode: event.context.interactionMode || 'independent',
          target_word: event.context.targetWord || null,
          target_phrase: event.context.targetPhrase || null,
          
          // System decision
          system_guess: event.systemGuess || null,
          system_action: event.systemAction || null,
          system_confidence: event.systemGuessConfidence || null,
          
          // Actual outcome (from event.analysis)
          user_spoke: event.analysis?.transcript ? true : null,
          user_transcript: event.analysis?.transcript || null,
          outcome_correct: event.analysis?.errorType === 'correct',
          outcome_error_type: event.analysis?.errorType || null,
          latency_ms: event.analysis?.totalDurationMs || null,
          
          // Full payloads
          analysis_data: event.analysis || {},
          task_data: event.context || {},
          
          // Provenance (NEW)
          model_version: SHADOW_MODEL_VERSION,
          source_type: 'shadow',
          review_status: 'pending',
          asr_confidence: event.analysis?.asrConfidence || null,
          cue_type_candidate: provenance?.cueTypeCandidate || null,
          trigger_reason: provenance?.triggerReason || null,
          user_self_recovered: provenance?.userSelfRecovered ?? null,
          environment: provenance?.environment || 'structured',
        });

      if (error) {
        console.warn('[ShadowEventLogger] Insert failed:', error.message);
        return false;
      }

      if (import.meta.env.DEV) {
        console.debug('[ShadowEventLogger] ✅ Logged shadow event:', event.context.taskType, '| target:', event.context.targetWord || event.context.targetPhrase);
      }

      return true;
    } catch (err) {
      console.warn('[ShadowEventLogger] Unexpected error:', err);
      return false;
    }
  }, []);

  return {
    logShadowEvent,
  };
};
