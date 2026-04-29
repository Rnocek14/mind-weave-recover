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

interface ConversationTurn {
  role: 'ai' | 'user';
  text: string;
  timestamp: number;
  latencyMs?: number;
  wordCount?: number;
  stuckType?: StuckType;
}

interface ConversationMetrics {
  totalUserWords: number;
  totalAIWords: number;
  avgLatencyMs: number;
  turnsCompleted: number;
  nudgesGiven: number;
  completionRate: number; // % of turns where user spoke meaningfully
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
  const [metrics, setMetrics] = useState<ConversationMetrics>({
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
    latencyToFirstWordMs: number | null
  ): Promise<{ followupType: FollowupType; followupText: string }> => {
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

      setMetrics(prev => ({
        ...prev,
        totalUserWords: prev.totalUserWords + userWords,
        turnsCompleted: newTurnNumber,
        avgLatencyMs: latenciesRef.current.length > 0
          ? latenciesRef.current.reduce((a, b) => a + b, 0) / latenciesRef.current.length
          : 0,
        completionRate: (meaningfulTurnsRef.current / Math.max(newTurnNumber, 1)) * 100
      }));

      // Get follow-up type from GPT (or fallback to rules)
      let followupType: FollowupType;

      try {
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
      } catch (err) {
        console.warn('Failed to call conversation-partner, using fallback:', err);
        followupType = selectFollowupByRule(stuckResult.stuckType, newTurnNumber, maxTurns);
      }

      // Get the actual line to speak
      const followupText = getFollowupLine(followupType);

      // Log to database if we have a session
      if (sessionId) {
        await logConversationTurn(sessionId, userTurn, followupType, stuckResult.stuckType);
      }

      return { followupType, followupText };
    } finally {
      setIsLoadingFollowup(false);
    }
  }, [currentTurn, maxTurns, conversationHistory, sessionId]);

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
  stuckType: StuckType
) {
  try {
    const meaningful = (userTurn.wordCount || 0) >= 2;
    const isCorrect = meaningful;
    const resolvedErrorType: string = isCorrect
      ? 'correct'
      : ((userTurn.wordCount || 0) === 0 ? 'no_response' : 'minimal_response');

    await supabase.from('exercise_events').insert({
      session_id: sessionId,
      exercise_slug: normalizeExerciseSlug('conversation-partner'),
      round: 1,
      score: isCorrect ? 1 : 0,
      reaction_time_ms: userTurn.latencyMs,
      error_type: resolvedErrorType,
      inputs: {
        user_text: userTurn.text,
        word_count: userTurn.wordCount,
        error_type: resolvedErrorType,
      },
      outputs: {
        followup_type: followupType,
        stuck_type: stuckType
      },
      engagement_flags: {
        did_speak: (userTurn.wordCount || 0) > 0,
        meaningful_response: meaningful
      }
    });
  } catch (err) {
    console.error('Failed to log conversation turn:', err);
  }
}
