/**
 * Shadow Event Helper for Speech Exercises
 * 
 * Provides a simple fire-and-forget function for exercises that
 * don't already build ShadowEvent objects (unlike PhotoNaming/PhrasePractice).
 * 
 * Usage: call logExerciseShadowEvent() after scoring a trial.
 */

import { supabase } from '@/integrations/supabase/client';
import { isShadowModeEnabled, SHADOW_MODEL_VERSION } from '@/lib/shadowMode';
import type { UtteranceContext } from '@/types/utteranceAnalysis';

interface ExerciseShadowEventParams {
  userId: string | undefined;
  profileId?: string;
  sessionId?: string | null;
  
  // Context
  taskType: UtteranceContext['taskType'];
  domain?: string;
  targetWord?: string;
  targetPhrase?: string;
  interactionMode?: string;
  difficultyLevel?: number;
  cueLevel?: number;
  
  // Outcome
  transcript?: string;
  correct?: boolean;
  errorType?: string;
  asrConfidence?: number;
  latencyMs?: number;
  
  // Provenance
  userSelfRecovered?: boolean;
  cueTypeCandidate?: string;
  triggerReason?: string;
}

/**
 * Fire-and-forget shadow event logging for any exercise.
 * Checks feature flag internally. Safe to call unconditionally.
 */
export async function logExerciseShadowEvent(
  params: ExerciseShadowEventParams,
  runtimeConfig?: Record<string, any> | null,
): Promise<void> {
  if (!params.userId) return;
  if (!isShadowModeEnabled(runtimeConfig)) return;

  try {
    await supabase
      .from('shadow_events' as any)
      .insert({
        user_id: params.userId,
        profile_id: params.profileId || null,
        session_id: params.sessionId || null,
        
        task_type: params.taskType,
        domain: params.domain || null,
        interaction_mode: params.interactionMode || 'independent',
        target_word: params.targetWord || null,
        target_phrase: params.targetPhrase || null,
        
        user_spoke: params.transcript ? true : null,
        user_transcript: params.transcript || null,
        outcome_correct: params.correct ?? null,
        outcome_error_type: params.errorType || null,
        latency_ms: params.latencyMs || null,
        asr_confidence: params.asrConfidence || null,
        
        analysis_data: {},
        task_data: {
          taskType: params.taskType,
          domain: params.domain,
          difficultyLevel: params.difficultyLevel,
          cueLevel: params.cueLevel,
        },
        
        // Provenance
        model_version: SHADOW_MODEL_VERSION,
        source_type: 'shadow',
        review_status: 'pending',
        environment: 'structured',
        user_self_recovered: params.userSelfRecovered ?? null,
        cue_type_candidate: params.cueTypeCandidate || null,
        trigger_reason: params.triggerReason || null,
      });
  } catch (err) {
    // Fire-and-forget: never crash the exercise
    if (import.meta.env.DEV) {
      console.debug('[ShadowEvent] Write failed:', err);
    }
  }
}
