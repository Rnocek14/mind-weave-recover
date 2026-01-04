/**
 * useCoachSession - Manages the Conversation Coach session state
 * 
 * Handles conversation flow, orchestrator decisions, card insertions,
 * metrics tracking, and integrates with:
 * - Real-time speech analysis with pronunciation
 * - User speech profiles
 * - Engagement monitoring
 * - Contextual cue generation
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  getNextAction, 
  createInitialState, 
  updateState,
  OrchestratorState,
  CardType,
  getCardIntro,
  getCardOutro,
  SpeechAnalysisForOrchestrator,
} from '@/lib/coachOrchestrator';
import { 
  getFollowupLine, 
  getRandomOpener,
} from '@/lib/conversationFollowups';
import { classifyStuckType } from '@/lib/stuckTypeClassifier';
import { detectUtteranceComplete } from '@/lib/completionDetector';
import { FeedMessage } from '@/components/coach/CoachChatFeed';
import { EngagementMonitor, EngagementState as MonitorEngagementState } from '@/lib/engagementMonitor';
import { useConversationSpeechAnalysis, ConversationUtteranceAnalysis } from './useConversationSpeechAnalysis';

// Store card results for AI context
interface CardResult {
  cardType: CardType;
  response: string;
  success: boolean;
}

export interface CoachSessionMetrics {
  turnsCompleted: number;
  cardsCompleted: number;
  totalUserWords: number;
  totalAIWords: number;
  avgLatencyMs: number;
  completionRate: number;
  // Enhanced metrics from speech analysis
  avgFluency?: number;
  fluencyTrend?: 'improving' | 'stable' | 'declining';
  effortfulCount?: number;
  circumlocutionCount?: number;
}

interface UseCoachSessionProps {
  userId: string;
  profileId: string;
  sessionId: string | null;
  maxTurns?: number;
  // User speech profile for personalization
  userSpeechProfile?: {
    primaryChallenge?: string;
    bestCueType?: string;
    typicalPace?: string;
    // Enhanced profile data
    errorTypeDistribution?: Record<string, number>;
    phonemeDifficultyMap?: Record<string, unknown>;
    avgStallDurationMs?: number | null;
    effortfulSpeechRate?: number | null;
    commonSubstitutions?: Record<string, string> | unknown;
  } | null;
}

interface UseCoachSessionReturn {
  messages: FeedMessage[];
  isComplete: boolean;
  isProcessing: boolean;
  metrics: CoachSessionMetrics;
  currentPhase: 'ready' | 'ai_speaking' | 'user_turn' | 'card_active' | 'complete';
  pendingAIText: string | null;
  hasPendingCard: boolean;
  engagementState: MonitorEngagementState | null;
  startSession: () => string;
  processUserTurn: (transcript: string, latencyMs: number | null, totalDurationMs?: number | null, audioBlob?: Blob) => Promise<string | null>;
  insertPendingCard: () => void;
  handleCardComplete: (messageId: string, result: unknown) => string;
  clearPendingAI: () => void;
  reset: () => void;
}

export function useCoachSession({
  userId,
  profileId,
  sessionId,
  maxTurns = 5,
  userSpeechProfile,
}: UseCoachSessionProps): UseCoachSessionReturn {
  const [messages, setMessages] = useState<FeedMessage[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'ready' | 'ai_speaking' | 'user_turn' | 'card_active' | 'complete'>('ready');
  const [pendingAIText, setPendingAIText] = useState<string | null>(null);
  const [hasPendingCard, setHasPendingCard] = useState(false);
  const [engagementState, setEngagementState] = useState<MonitorEngagementState | null>(null);
  
  const orchestratorStateRef = useRef<OrchestratorState>(createInitialState(maxTurns));
  const latenciesRef = useRef<number[]>([]);
  const userWordsRef = useRef(0);
  const aiWordsRef = useRef(0);
  const cardsCompletedRef = useRef(0);
  const pendingCardIdRef = useRef<string | null>(null);
  const pendingCardTypeRef = useRef<CardType | null>(null);
  const pendingCardDifficultyRef = useRef<'easy' | 'medium'>('easy');
  const lastCardResultRef = useRef<CardResult | null>(null);
  const engagementMonitorRef = useRef(new EngagementMonitor(5));
  const analysisHistoryRef = useRef<ConversationUtteranceAnalysis[]>([]);
  
  // Speech analysis hook
  const speechAnalysis = useConversationSpeechAnalysis({
    userId,
    profileId,
    sessionId,
  });

  const addMessage = useCallback((message: FeedMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const startSession = useCallback((): string => {
    const opener = getRandomOpener();
    const messageId = generateId();
    
    addMessage({ type: 'ai', text: opener, id: messageId });
    aiWordsRef.current += countWords(opener);
    setPendingAIText(opener);
    setCurrentPhase('user_turn');
    
    // Reset engagement monitor
    engagementMonitorRef.current.reset();
    speechAnalysis.reset();
    
    return opener;
  }, [addMessage, speechAnalysis]);

  const processUserTurn = useCallback(async (
    transcript: string, 
    latencyMs: number | null,
    totalDurationMs?: number | null,
    audioBlob?: Blob
  ): Promise<string | null> => {
    setIsProcessing(true);
    
    // Add user message
    const userMessageId = generateId();
    addMessage({ type: 'user', text: transcript || '(no speech)', id: userMessageId });
    userWordsRef.current += countWords(transcript);
    
    if (latencyMs !== null) {
      latenciesRef.current.push(latencyMs);
    }

    // Analyze the utterance with speech analysis (now with audio blob for pronunciation)
    const analysis = await speechAnalysis.analyzeUtterance(
      transcript,
      latencyMs,
      totalDurationMs ?? null,
      audioBlob
    );
    analysisHistoryRef.current.push(analysis);

    // Update engagement monitor
    const wordCount = countWords(transcript);
    engagementMonitorRef.current.addTrial({
      correct: wordCount > 0 && !analysis.effortfulSpeech,
      reactionTimeMs: latencyMs ?? 3000,
      timeout: wordCount === 0,
      cueLevel: 0,
      timestamp: Date.now(),
    });
    const currentEngagement = engagementMonitorRef.current.assessState();
    setEngagementState(currentEngagement);

    // Use smart completion detection
    const completion = detectUtteranceComplete(transcript);
    
    const stuckType = classifyStuckType({
      didSpeak: wordCount > 0,
      latencyToFirstWordMs: latencyMs,
      utteranceComplete: completion.isComplete,
      wordCount,
      durationMs: totalDurationMs ?? 10000,
      narrowingLevelUsed: 0,
    }).stuckType;

    // Build speech analysis data for orchestrator
    const speechAnalysisForOrchestrator: SpeechAnalysisForOrchestrator = {
      effortfulSpeech: analysis.effortfulSpeech,
      circumlocutionDetected: analysis.circumlocutionDetected,
      fluencyScore: analysis.fluencyScore,
      pausePattern: analysis.pausePattern,
      wordCount: analysis.wordCount,
      filledPauseCount: analysis.filledPauseCount,
    };

    // Get next action from orchestrator (now with speech analysis)
    const action = getNextAction(stuckType, orchestratorStateRef.current, speechAnalysisForOrchestrator);

    let aiResponseText: string | null = null;

    // Handle action
    if (action.type === 'wrap_up') {
      const wrapUpText = getFollowupLine('wrap_up');
      addMessage({ type: 'ai', text: wrapUpText, id: generateId() });
      aiWordsRef.current += countWords(wrapUpText);
      aiResponseText = wrapUpText;
      setIsComplete(true);
      setCurrentPhase('complete');
    } else if (action.type === 'insert_card') {
      const intro = getCardIntro(action.cardType);
      addMessage({ type: 'ai', text: intro, id: generateId() });
      aiWordsRef.current += countWords(intro);
      aiResponseText = intro;
      
      pendingCardTypeRef.current = action.cardType;
      pendingCardDifficultyRef.current = action.config.difficulty;
      setHasPendingCard(true);
      
      orchestratorStateRef.current = updateState(
        orchestratorStateRef.current,
        stuckType,
        true,
        action.cardType
      );
    } else {
      // Get contextual response from AI with full speech analysis context
      try {
        const currentMessages = [...messages, { type: 'user' as const, text: transcript, id: userMessageId }];
        const conversationHistory = currentMessages
          .filter(m => m.type === 'ai' || m.type === 'user')
          .slice(-6)
          .map(m => ({
            role: m.type as 'ai' | 'user',
            text: m.type === 'ai' ? m.text : m.type === 'user' ? m.text : ''
          }));

        // Include card context if we just completed one
        const cardContext = lastCardResultRef.current ? {
          cardType: lastCardResultRef.current.cardType,
          response: lastCardResultRef.current.response,
          success: lastCardResultRef.current.success,
        } : undefined;
        
        lastCardResultRef.current = null;

        // Get session metrics for AI context
        const sessionMetrics = speechAnalysis.getSessionMetrics();
        
        // Determine if user needs a cue (effortful + low words)
        let suggestedCue: { cueType: 'semantic' | 'phonemic' | 'encouragement'; cueText: string } | undefined;
        if (analysis.effortfulSpeech && analysis.wordCount < 4) {
          // Generate contextual cue based on user's profile
          const cueType = userSpeechProfile?.bestCueType === 'phonemic' ? 'phonemic' : 'semantic';
          suggestedCue = {
            cueType,
            cueText: cueType === 'semantic' 
              ? 'Maybe something about your day or something you like?'
              : 'Take a moment, start with any word that comes to mind.'
          };
        }

        // Call the new speech-aware AI function
        const { data, error } = await supabase.functions.invoke('conversation-coach-ai', {
          body: {
            userTranscript: transcript,
            turnNumber: orchestratorStateRef.current.turnNumber + 1,
            maxTurns,
            conversationHistory,
            cardContext,
            // Full speech analysis data including pronunciation
            speechAnalysis: {
              effortfulSpeech: analysis.effortfulSpeech,
              pausePattern: analysis.pausePattern,
              circumlocutionDetected: analysis.circumlocutionDetected,
              fluencyScore: analysis.fluencyScore,
              wordCount: analysis.wordCount,
              completionConfidence: analysis.completionConfidence,
              speechContext: speechAnalysis.buildAISpeechContext(analysis),
              // Pronunciation data
              pronunciationScore: analysis.pronunciationScore,
              challengingSounds: analysis.challengingSounds,
              microFluencyNotes: analysis.microFluency?.notes || [],
            },
            // Enhanced user profile for personalization
            userProfile: userSpeechProfile ? {
              primaryChallenge: userSpeechProfile.primaryChallenge,
              bestCueType: userSpeechProfile.bestCueType,
              typicalPace: userSpeechProfile.typicalPace,
              predominantErrorPattern: getPredominantErrorPattern(userSpeechProfile.errorTypeDistribution),
              effortfulSpeechRate: userSpeechProfile.effortfulSpeechRate,
            } : undefined,
            // Session metrics with pronunciation data
            sessionMetrics: sessionMetrics ? {
              turnsCompleted: sessionMetrics.totalUtterances,
              avgFluency: sessionMetrics.avgFluency,
              fluencyTrend: sessionMetrics.fluencyTrend,
              effortfulCount: sessionMetrics.effortfulCount,
              avgPronunciationScore: sessionMetrics.avgPronunciationScore,
              challengingSounds: sessionMetrics.challengingSounds,
            } : undefined,
            // Engagement state
            engagementState: currentEngagement ? {
              frustration: currentEngagement.frustration,
              fatigue: currentEngagement.fatigue,
              recommendedAction: currentEngagement.recommendedAction,
            } : undefined,
            // Suggested cue if user is struggling
            suggestedCue,
          }
        });

        if (error || !data?.response) {
          console.warn('Edge function error, using fallback:', error);
          aiResponseText = getFollowupLine(action.followupType);
        } else {
          aiResponseText = data.response;
          
          // Check if AI suggested a break
          if (data.suggestBreak) {
            // Could trigger a break prompt UI
            console.log('AI suggests taking a break');
          }
        }
      } catch (err) {
        console.warn('Failed to get AI response:', err);
        aiResponseText = getFollowupLine(action.followupType);
      }

      addMessage({ type: 'ai', text: aiResponseText, id: generateId() });
      aiWordsRef.current += countWords(aiResponseText);
      
      orchestratorStateRef.current = updateState(
        orchestratorStateRef.current,
        stuckType,
        false
      );
      
      if (orchestratorStateRef.current.turnNumber >= maxTurns) {
        const wrapUpText = getFollowupLine('wrap_up');
        addMessage({ type: 'ai', text: wrapUpText, id: generateId() });
        aiWordsRef.current += countWords(wrapUpText);
        aiResponseText = wrapUpText;
        setIsComplete(true);
        setCurrentPhase('complete');
      } else {
        setCurrentPhase('user_turn');
      }
    }

    setPendingAIText(aiResponseText);
    setIsProcessing(false);
    return aiResponseText;
  }, [addMessage, maxTurns, messages, speechAnalysis, userSpeechProfile]);

  const handleCardComplete = useCallback((messageId: string, result: unknown): string => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId && msg.type === 'card'
        ? { ...msg, completed: true }
        : msg
    ));

    const cardMessage = messages.find(msg => msg.id === messageId && msg.type === 'card');
    const cardType = cardMessage && cardMessage.type === 'card' ? cardMessage.cardType : undefined;
    
    const cardSuccess = result && typeof result === 'object' && 
      (('success' in result && result.success === true) || 
       ('answered' in result && result.answered === true));
    
    const userResponse = result && typeof result === 'object' 
      ? (result as Record<string, unknown>).answer || 
        (result as Record<string, unknown>).response || 
        (result as Record<string, unknown>).transcript || ''
      : '';
    
    if (cardType) {
      lastCardResultRef.current = {
        cardType,
        response: String(userResponse),
        success: !!cardSuccess,
      };
    }

    cardsCompletedRef.current += 1;
    pendingCardIdRef.current = null;
    
    if (cardType) {
      orchestratorStateRef.current = updateState(
        orchestratorStateRef.current,
        orchestratorStateRef.current.lastStuckType || 'strong_flow',
        false,
        cardType,
        cardSuccess as boolean
      );
    }

    const outro = getCardOutro();
    addMessage({ type: 'ai', text: outro, id: generateId() });
    aiWordsRef.current += countWords(outro);
    
    if (orchestratorStateRef.current.turnNumber >= maxTurns) {
      const wrapUpText = getFollowupLine('wrap_up');
      addMessage({ type: 'ai', text: wrapUpText, id: generateId() });
      aiWordsRef.current += countWords(wrapUpText);
      setIsComplete(true);
      setCurrentPhase('complete');
      setPendingAIText(wrapUpText);
      return wrapUpText;
    } else {
      setCurrentPhase('user_turn');
      setPendingAIText(outro);
      return outro;
    }
  }, [messages, addMessage, maxTurns]);

  const clearPendingAI = useCallback(() => {
    setPendingAIText(null);
  }, []);

  const insertPendingCard = useCallback(() => {
    if (pendingCardTypeRef.current) {
      const cardId = generateId();
      pendingCardIdRef.current = cardId;
      addMessage({ 
        type: 'card', 
        cardType: pendingCardTypeRef.current, 
        difficulty: pendingCardDifficultyRef.current, 
        id: cardId,
        completed: false,
      });
      setCurrentPhase('card_active');
      pendingCardTypeRef.current = null;
      setHasPendingCard(false);
    }
  }, [addMessage]);

  const reset = useCallback(() => {
    setMessages([]);
    setIsComplete(false);
    setIsProcessing(false);
    setCurrentPhase('ready');
    setPendingAIText(null);
    setHasPendingCard(false);
    setEngagementState(null);
    orchestratorStateRef.current = createInitialState(maxTurns);
    latenciesRef.current = [];
    userWordsRef.current = 0;
    aiWordsRef.current = 0;
    cardsCompletedRef.current = 0;
    pendingCardIdRef.current = null;
    pendingCardTypeRef.current = null;
    engagementMonitorRef.current.reset();
    speechAnalysis.reset();
    analysisHistoryRef.current = [];
  }, [maxTurns, speechAnalysis]);

  // Calculate enhanced metrics
  const sessionMetrics = speechAnalysis.getSessionMetrics();
  
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
    // Enhanced metrics
    avgFluency: sessionMetrics?.avgFluency,
    fluencyTrend: sessionMetrics?.fluencyTrend,
    effortfulCount: sessionMetrics?.effortfulCount,
    circumlocutionCount: sessionMetrics?.circumlocutionCount,
  };

  return {
    messages,
    isComplete,
    isProcessing,
    metrics,
    currentPhase,
    pendingAIText,
    hasPendingCard,
    engagementState,
    startSession,
    processUserTurn,
    insertPendingCard,
    handleCardComplete,
    clearPendingAI,
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

// Derive predominant error pattern from distribution
function getPredominantErrorPattern(distribution?: Record<string, number>): string | undefined {
  if (!distribution) return undefined;
  
  const semantic = (distribution.semantic_paraphasia || 0) + (distribution.circumlocution || 0);
  const phonemic = (distribution.phonemic_paraphasia || 0) + (distribution.neologism || 0);
  
  if (semantic === 0 && phonemic === 0) return undefined;
  if (semantic > phonemic * 1.5) return 'semantic';
  if (phonemic > semantic * 1.5) return 'phonemic';
  return 'mixed';
}
