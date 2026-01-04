/**
 * useCoachSession - Manages the Conversation Coach session state
 * 
 * Handles conversation flow, orchestrator decisions, card insertions,
 * and metrics tracking for the unified coach experience.
 */

import { useState, useCallback, useRef } from 'react';
import { 
  getNextAction, 
  createInitialState, 
  updateState,
  OrchestratorState,
  CardType,
  getCardIntro,
  getCardOutro,
} from '@/lib/coachOrchestrator';
import { 
  getFollowupLine, 
  getRandomOpener,
  FollowupType,
} from '@/lib/conversationFollowups';
import { classifyStuckType, StuckType } from '@/lib/stuckTypeClassifier';
import { FeedMessage } from '@/components/coach/CoachChatFeed';

interface CoachSessionMetrics {
  turnsCompleted: number;
  cardsCompleted: number;
  totalUserWords: number;
  totalAIWords: number;
  avgLatencyMs: number;
  completionRate: number;
}

interface UseCoachSessionProps {
  userId: string;
  profileId: string;
  sessionId: string | null;
  maxTurns?: number;
}

interface UseCoachSessionReturn {
  messages: FeedMessage[];
  isComplete: boolean;
  isProcessing: boolean;
  metrics: CoachSessionMetrics;
  currentPhase: 'ready' | 'ai_speaking' | 'user_turn' | 'card_active' | 'complete';
  startSession: () => string; // Returns opener text
  processUserTurn: (transcript: string, latencyMs: number | null) => Promise<void>;
  handleCardComplete: (messageId: string, result: unknown) => void;
  reset: () => void;
}

export function useCoachSession({
  userId,
  profileId,
  sessionId,
  maxTurns = 5,
}: UseCoachSessionProps): UseCoachSessionReturn {
  const [messages, setMessages] = useState<FeedMessage[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'ready' | 'ai_speaking' | 'user_turn' | 'card_active' | 'complete'>('ready');
  
  const orchestratorStateRef = useRef<OrchestratorState>(createInitialState(maxTurns));
  const latenciesRef = useRef<number[]>([]);
  const userWordsRef = useRef(0);
  const aiWordsRef = useRef(0);
  const cardsCompletedRef = useRef(0);
  const pendingCardIdRef = useRef<string | null>(null);

  const addMessage = useCallback((message: FeedMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const startSession = useCallback((): string => {
    const opener = getRandomOpener();
    const messageId = generateId();
    
    addMessage({ type: 'ai', text: opener, id: messageId });
    aiWordsRef.current += countWords(opener);
    setCurrentPhase('user_turn');
    
    return opener;
  }, [addMessage]);

  const processUserTurn = useCallback(async (transcript: string, latencyMs: number | null) => {
    setIsProcessing(true);
    
    // Add user message
    const userMessageId = generateId();
    addMessage({ type: 'user', text: transcript || '(no speech)', id: userMessageId });
    userWordsRef.current += countWords(transcript);
    
    if (latencyMs !== null) {
      latenciesRef.current.push(latencyMs);
    }

    // Classify stuck type
    const wordCount = countWords(transcript);
    const stuckType = classifyStuckType({
      didSpeak: wordCount > 0,
      latencyToFirstWordMs: latencyMs,
      utteranceComplete: wordCount >= 5, // Simple heuristic
      wordCount,
      durationMs: 10000, // Approximate
      narrowingLevelUsed: 0,
    }).stuckType;

    // Get next action from orchestrator
    const action = getNextAction(stuckType, orchestratorStateRef.current);

    // Handle action
    if (action.type === 'wrap_up') {
      const wrapUpText = getFollowupLine('wrap_up');
      addMessage({ type: 'ai', text: wrapUpText, id: generateId() });
      aiWordsRef.current += countWords(wrapUpText);
      setIsComplete(true);
      setCurrentPhase('complete');
    } else if (action.type === 'insert_card') {
      // Speak intro
      const intro = getCardIntro(action.cardType);
      addMessage({ type: 'ai', text: intro, id: generateId() });
      aiWordsRef.current += countWords(intro);
      
      // Add card
      const cardId = generateId();
      pendingCardIdRef.current = cardId;
      addMessage({ 
        type: 'card', 
        cardType: action.cardType, 
        difficulty: action.config.difficulty, 
        id: cardId,
        completed: false,
      });
      
      setCurrentPhase('card_active');
      
      // Update orchestrator state (card was inserted)
      orchestratorStateRef.current = updateState(
        orchestratorStateRef.current,
        stuckType,
        true
      );
    } else {
      // Regular follow-up
      const followupText = getFollowupLine(action.followupType);
      addMessage({ type: 'ai', text: followupText, id: generateId() });
      aiWordsRef.current += countWords(followupText);
      
      // Update orchestrator state (no card)
      orchestratorStateRef.current = updateState(
        orchestratorStateRef.current,
        stuckType,
        false
      );
      
      // Check if we've reached max turns
      if (orchestratorStateRef.current.turnNumber >= maxTurns) {
        const wrapUpText = getFollowupLine('wrap_up');
        addMessage({ type: 'ai', text: wrapUpText, id: generateId() });
        aiWordsRef.current += countWords(wrapUpText);
        setIsComplete(true);
        setCurrentPhase('complete');
      } else {
        setCurrentPhase('user_turn');
      }
    }

    setIsProcessing(false);
  }, [addMessage, maxTurns]);

  const handleCardComplete = useCallback((messageId: string, result: unknown) => {
    // Mark card as completed
    setMessages(prev => prev.map(msg => 
      msg.id === messageId && msg.type === 'card'
        ? { ...msg, completed: true }
        : msg
    ));

    cardsCompletedRef.current += 1;
    pendingCardIdRef.current = null;

    // Add outro and return to conversation
    const outro = getCardOutro();
    addMessage({ type: 'ai', text: outro, id: generateId() });
    aiWordsRef.current += countWords(outro);
    
    // Check if we've reached max turns
    if (orchestratorStateRef.current.turnNumber >= maxTurns) {
      const wrapUpText = getFollowupLine('wrap_up');
      addMessage({ type: 'ai', text: wrapUpText, id: generateId() });
      aiWordsRef.current += countWords(wrapUpText);
      setIsComplete(true);
      setCurrentPhase('complete');
    } else {
      setCurrentPhase('user_turn');
    }
  }, [addMessage, maxTurns]);

  const reset = useCallback(() => {
    setMessages([]);
    setIsComplete(false);
    setIsProcessing(false);
    setCurrentPhase('ready');
    orchestratorStateRef.current = createInitialState(maxTurns);
    latenciesRef.current = [];
    userWordsRef.current = 0;
    aiWordsRef.current = 0;
    cardsCompletedRef.current = 0;
    pendingCardIdRef.current = null;
  }, [maxTurns]);

  const metrics: CoachSessionMetrics = {
    turnsCompleted: orchestratorStateRef.current.turnNumber,
    cardsCompleted: cardsCompletedRef.current,
    totalUserWords: userWordsRef.current,
    totalAIWords: aiWordsRef.current,
    avgLatencyMs: latenciesRef.current.length > 0
      ? latenciesRef.current.reduce((a, b) => a + b, 0) / latenciesRef.current.length
      : 0,
    completionRate: orchestratorStateRef.current.turnNumber > 0
      ? (orchestratorStateRef.current.successStreak / orchestratorStateRef.current.turnNumber) * 100
      : 0,
  };

  return {
    messages,
    isComplete,
    isProcessing,
    metrics,
    currentPhase,
    startSession,
    processUserTurn,
    handleCardComplete,
    reset,
  };
}

// Helper functions
function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
