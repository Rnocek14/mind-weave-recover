import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ThoughtPrompt } from '@/types/thoughtContinuation';
import type { StuckType } from '@/lib/stuckTypeClassifier';
import type { SessionHistory, SelectionStrategy } from '@/lib/adaptivePromptSelector';

interface LogDecisionParams {
  userId: string;
  profileId?: string;
  sessionId: string | null;
  prompt: ThoughtPrompt;
  selectionReason: string;
  strategy: SelectionStrategy;
  previousStuckType: StuckType | null;
  sessionHistory: SessionHistory;
}

interface LogOutcomeParams {
  decisionId: string;
  stuckType: StuckType;
  didSpeak: boolean;
  latencyMs: number | null;
  utteranceComplete: boolean;
}

/**
 * Hook to log adaptive prompt selection decisions
 * Similar to useAdaptiveDecisionLog but for Thought Continuation game
 */
export const useThoughtDecisionLog = () => {
  const currentDecisionIdRef = useRef<string | null>(null);

  /**
   * Log a prompt selection decision (before the attempt)
   */
  const logDecision = useCallback(async ({
    userId,
    profileId,
    sessionId,
    prompt,
    selectionReason,
    strategy,
    previousStuckType,
    sessionHistory,
  }: LogDecisionParams): Promise<string | null> => {
    try {
      const decisionId = crypto.randomUUID();
      
      const { error } = await (supabase
        .from('thought_decision_logs' as any)
        .insert({
          id: decisionId,
          user_id: userId,
          profile_id: profileId || null,
          session_id: sessionId,
          prompt_id: prompt.id,
          prompt_text: prompt.promptText,
          prompt_intent_type: prompt.intentType,
          prompt_theme: prompt.theme,
          prompt_difficulty_tier: prompt.difficultyTier,
          selection_reason: `[${strategy}] ${selectionReason}`,
          previous_stuck_type: previousStuckType,
          session_attempt_count: sessionHistory.attemptCount,
          session_completion_count: sessionHistory.completionCount,
          session_avg_latency_ms: sessionHistory.avgLatencyMs,
          narrowing_levels_used: sessionHistory.narrowingLevelsUsed,
          stuck_type_history: sessionHistory.stuckTypes,
        }) as any);

      if (error) {
        console.error('[ThoughtDecisionLog] Error logging decision:', error);
        return null;
      }

      console.log('[ThoughtDecisionLog] Decision logged:', {
        strategy,
        promptTheme: prompt.theme,
        promptIntent: prompt.intentType,
        previousStuckType,
        attemptCount: sessionHistory.attemptCount,
      });

      currentDecisionIdRef.current = decisionId;
      return decisionId;
    } catch (err) {
      console.error('[ThoughtDecisionLog] Unexpected error:', err);
      return null;
    }
  }, []);

  /**
   * Update the decision log with the outcome (after the attempt)
   */
  const logOutcome = useCallback(async ({
    decisionId,
    stuckType,
    didSpeak,
    latencyMs,
    utteranceComplete,
  }: LogOutcomeParams): Promise<boolean> => {
    try {
      const { error } = await (supabase
        .from('thought_decision_logs' as any)
        .update({
          outcome_stuck_type: stuckType,
          outcome_did_speak: didSpeak,
          outcome_latency_ms: latencyMs,
          outcome_utterance_complete: utteranceComplete,
        })
        .eq('id', decisionId) as any);

      if (error) {
        console.error('[ThoughtDecisionLog] Error logging outcome:', error);
        return false;
      }

      console.log('[ThoughtDecisionLog] Outcome logged:', {
        decisionId,
        stuckType,
        didSpeak,
        utteranceComplete,
      });

      return true;
    } catch (err) {
      console.error('[ThoughtDecisionLog] Unexpected error:', err);
      return false;
    }
  }, []);

  /**
   * Log outcome using the most recent decision ID
   */
  const logCurrentOutcome = useCallback(async (
    stuckType: StuckType,
    didSpeak: boolean,
    latencyMs: number | null,
    utteranceComplete: boolean
  ): Promise<boolean> => {
    if (!currentDecisionIdRef.current) {
      console.warn('[ThoughtDecisionLog] No current decision to update');
      return false;
    }

    return logOutcome({
      decisionId: currentDecisionIdRef.current,
      stuckType,
      didSpeak,
      latencyMs,
      utteranceComplete,
    });
  }, [logOutcome]);

  const resetCurrentDecision = useCallback(() => {
    currentDecisionIdRef.current = null;
  }, []);

  return { 
    logDecision, 
    logOutcome, 
    logCurrentOutcome,
    resetCurrentDecision,
    currentDecisionId: currentDecisionIdRef.current,
  };
};
