import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';
import { 
  FollowupType, 
  getFollowupLine, 
  getSilenceNudge,
  getNarrowingPrompt,
  selectFollowupByRule,
  parseFollowupType
} from '@/lib/conversationFollowups';
import { StuckType, classifyStuckType } from '@/lib/stuckTypeClassifier';
import { afterPartnerPatientTurn, type ConversationPartnerMetrics } from '@/lib/conversationPartnerMetrics';
import type { ClinicalSignal } from '@/lib/discourseSignalScorerCore';
import type { SupportLevel } from '@/lib/progression/clinicalProgression';

interface ConversationTurn {
  role: 'ai' | 'user';
  text: string;
  timestamp: number;
  latencyMs?: number;
  wordCount?: number;
  stuckType?: StuckType;
}


/** Optional graded-practice metadata, never a validated language-recovery score. */
export interface PartnerClinicalTurnContext {
  level: 1 | 2 | 3;
  support: SupportLevel;
  signal: ClinicalSignal;
  meetsTarget: boolean;
}

export interface PartnerProcessOptions {
  /** Levels 1–3 use a stable, topic-continuous script instead of an LLM follow-up. */
  scriptedFollowupText?: string;
  clinical?: PartnerClinicalTurnContext;
}

interface UseConversationPartnerProps {
  userId: string;
  profileId: string;
  sessionId: string | null;
  maxTurns?: number;
}

export function useConversationPartner({
  userId,
  profileId,
  sessionId,
  maxTurns = 3
}: UseConversationPartnerProps) {
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [isLoadingFollowup, setIsLoadingFollowup] = useState(false);
  const [metrics, setMetrics] = useState<ConversationPartnerMetrics>({
    totalUserWords: 0,
    totalAIWords: 0,
    avgLatencyMs: 0,
    turnsCompleted: 0,
    nudgesGiven: 0,
    completionRate: 0
  });

  const turnStartTimeRef = useRef<number>(0);
  const latenciesRef = useRef<number[]>([]);
  const meaningfulTurnsRef = useRef<number>(0);

  /**
   * Start a new turn (called when AI speaks)
   */
  const startTurn = useCallback(() => {
    turnStartTimeRef.current = Date.now();
  }, []);

  /**
   * Add AI turn to history
   */
  const addAITurn = useCallback((text: string) => {
    const aiWords = text.split(/\s+/).filter(Boolean).length;
    
    setConversationHistory(prev => [...prev, {
      role: 'ai',
      text,
      timestamp: Date.now(),
      wordCount: aiWords
    }]);

    setMetrics(prev => ({
      ...prev,
      totalAIWords: prev.totalAIWords + aiWords
    }));

    startTurn();
  }, [startTurn]);

  /**
   * Process user's response and get follow-up type
   */
  const processUserTurn = useCallback(async (
    transcript: string,
    latencyToFirstWordMs: number | null,
    options?: PartnerProcessOptions,
  ): Promise<{ followupType: FollowupType; followupText: string; updatedMetrics: ConversationPartnerMetrics; eventSaved: boolean }> => {
    setIsLoadingFollowup(true);

    try {
      const userWords = transcript.split(/\s+/).filter(Boolean).length;
      const didSpeak = userWords > 0;
      const turnDurationMs = Date.now() - turnStartTimeRef.current;

      // Classify stuck type using existing classifier
      const stuckResult = classifyStuckType({
        didSpeak,
        latencyToFirstWordMs: latencyToFirstWordMs ?? undefined,
        utteranceComplete: userWords >= 3, // Simple heuristic
        wordCount: userWords,
        durationMs: turnDurationMs,
        narrowingLevelUsed: 0
      });

      // Add user turn to history
      const userTurn: ConversationTurn = {
        role: 'user',
        text: transcript || '(no response)',
        timestamp: Date.now(),
        latencyMs: latencyToFirstWordMs ?? undefined,
        wordCount: userWords,
        stuckType: stuckResult.stuckType
      };
      
      setConversationHistory(prev => [...prev, userTurn]);

      // Update metrics
      if (latencyToFirstWordMs) {
        latenciesRef.current.push(latencyToFirstWordMs);
      }
      if (userWords >= 2) {
        meaningfulTurnsRef.current++;
      }

      const newTurnNumber = currentTurn + 1;
      setCurrentTurn(newTurnNumber);

      const metricInput = {
        words: userWords,
        turnNumber: newTurnNumber,
        measuredLatencies: [...latenciesRef.current],
        repliesWithTwoWords: meaningfulTurnsRef.current,
      };
      // A returned snapshot includes THIS patient turn. The React state
      // snapshot captured by the caller is a render behind until re-render.
      const updatedMetrics = afterPartnerPatientTurn(metrics, metricInput);
      setMetrics(prev => afterPartnerPatientTurn(prev, metricInput));

      // Get follow-up type from GPT (or fallback to rules)
      let followupType: FollowupType;

      try {
        // Graded L1–L3 dialogues must not drift into unrelated questions.
        if (options?.scriptedFollowupText !== undefined) {
          followupType = newTurnNumber >= maxTurns ? 'wrap_up' : 'tell_more';
        } else {
        const { data, error } = await supabase.functions.invoke('conversation-partner', {
          body: {
            userTranscript: transcript,
            turnNumber: newTurnNumber,
            maxTurns,
            conversationHistory: conversationHistory.slice(-4).map(t => ({
              role: t.role,
              text: t.text
            }))
          }
        });

        if (error) {
          console.warn('Edge function error, using rule-based fallback:', error);
          followupType = selectFollowupByRule(stuckResult.stuckType, newTurnNumber, maxTurns);
        } else if (data?.fallbackType) {
          followupType = data.fallbackType as FollowupType;
        } else {
          followupType = data?.followupType || 'tell_more';
        }
        }
      } catch (err) {
        console.warn('Failed to call conversation-partner, using fallback:', err);
        followupType = selectFollowupByRule(stuckResult.stuckType, newTurnNumber, maxTurns);
      }

      // Get the actual line to speak
      const followupText = options?.scriptedFollowupText ?? getFollowupLine(followupType);

      // Log to database if we have a session
      // Progression can only use a turn if the full turn event was actually
      // accepted by the backend; no optimistic credit for a rejected insert.
      const eventSaved = sessionId
        ? await logConversationTurn(sessionId, userTurn, followupType, stuckResult.stuckType, newTurnNumber, options?.clinical)
        : false;

      return { followupType, followupText, updatedMetrics, eventSaved };
    } finally {
      setIsLoadingFollowup(false);
    }
  }, [currentTurn, maxTurns, conversationHistory, sessionId, metrics]);

  /**
   * Get a nudge for silence
   */
  const getNudge = useCallback((silenceDurationMs: number): string => {
    setMetrics(prev => ({ ...prev, nudgesGiven: prev.nudgesGiven + 1 }));
    
    // Extended silence gets a narrowing prompt
    if (silenceDurationMs > 20000) {
      return getNarrowingPrompt();
    }
    return getSilenceNudge();
  }, []);

  /**
   * Check if conversation is complete
   */
  const isComplete = currentTurn >= maxTurns;

  /**
   * Reset for new conversation
   */
  const reset = useCallback(() => {
    setConversationHistory([]);
    setCurrentTurn(0);
    setIsLoadingFollowup(false);
    setMetrics({
      totalUserWords: 0,
      totalAIWords: 0,
      avgLatencyMs: 0,
      turnsCompleted: 0,
      nudgesGiven: 0,
      completionRate: 0
    });
    latenciesRef.current = [];
    meaningfulTurnsRef.current = 0;
    turnStartTimeRef.current = 0;
  }, []);

  return {
    conversationHistory,
    currentTurn,
    maxTurns,
    isLoadingFollowup,
    metrics,
    isComplete,
    addAITurn,
    processUserTurn,
    getNudge,
    startTurn,
    reset
  };
}

/**
 * Log conversation turn to database
 */
async function logConversationTurn(
  sessionId: string,
  userTurn: ConversationTurn,
  followupType: FollowupType,
  stuckType: StuckType,
  turnNumber: number,
  clinical?: PartnerClinicalTurnContext,
): Promise<boolean> {
  try {
    const meaningful = (userTurn.wordCount || 0) >= 2;
    const clinicalSignal = clinical?.signal;
    // In early clinical stages, unknown / fallback scoring must not be
    // represented as clinical success. Ordinary Free Talk keeps its prior
    // participation convention when no clinical stage is active.
    const clinicalScorable = clinicalSignal?.source === 'llm';
    const isCorrect = clinical ? clinicalScorable && clinical.meetsTarget : meaningful;
    const resolvedErrorType = clinical
      ? !clinicalScorable ? 'unscorable' : isCorrect ? 'correct' : (clinicalSignal?.errorType ?? 'below_clinical_target')
      : meaningful ? 'correct' : (userTurn.wordCount || 0) === 0 ? 'no_response' : 'minimal_response';

    const { error } = await supabase.from('exercise_events').insert({
      session_id: sessionId,
      exercise_slug: normalizeExerciseSlug('conversation-partner'),
      round: turnNumber,
      score: clinical && !clinicalScorable ? null : isCorrect ? 100 : 0, // Practice proxy only
      reaction_time_ms: userTurn.latencyMs,
      error_type: resolvedErrorType,
      inputs: {
        user_text: userTurn.text,
        word_count: userTurn.wordCount,
        error_type: resolvedErrorType,
        clinical_level: clinical?.level ?? null,
        response_mode: 'spoken',
        support_used: clinical?.support ?? null,
      },
      outputs: {
        followup_type: followupType,
        stuck_type: stuckType,
        clinical_practice: clinical ? {
          level: clinical.level,
          target_met: isCorrect,
          scoring_valid: clinicalScorable,
          scorer_source: clinicalSignal?.source ?? 'unavailable',
          support_used: clinical.support,
          on_topic_score: clinicalSignal?.onTopicScore ?? null,
        } : null,
      },
      engagement_flags: {
        did_speak: (userTurn.wordCount || 0) > 0,
        meaningful_response: meaningful
      }
    });
    if (error) {
      console.warn('[ConversationPartner] turn-event write failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[ConversationPartner] turn-event write threw:', err);
    return false;
  }
}
