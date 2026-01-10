/**
 * useCoachSession - Manages the Conversation Coach session state
 * 
 * ENHANCED with Revolutionary Coach features:
 * - Session phases (warmup → build → conversation → wrapup)
 * - Vocabulary priming & reuse
 * - Cue engine integration for real-time panel updates
 * - Difficulty controller for 70-85% success band
 * - Anti-loop enforcement from orchestrator
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
  extractTopicFromMessages,
  getUserRequestedCardConfig,
  SessionPhase,
  TherapyObjective,
  NextAction,
} from '@/lib/coachOrchestrator';
import { 
  getFollowupLine, 
  getRandomOpener,
  getSmartFallback,
  getSmartAcknowledge,
} from '@/lib/conversationFollowups';
import { classifyStuckType } from '@/lib/stuckTypeClassifier';
import { detectUtteranceComplete } from '@/lib/completionDetector';
import { FeedMessage } from '@/components/coach/CoachChatFeed';
import { EngagementMonitor, EngagementState as MonitorEngagementState } from '@/lib/engagementMonitor';
import { useConversationSpeechAnalysis, ConversationUtteranceAnalysis } from './useConversationSpeechAnalysis';
import { 
  getCueForUtterance, 
  createInitialCueState, 
  updateCueState, 
  CueState, 
  CueRecommendation,
  getCueTextForLevel,
} from '@/lib/conversationCueEngine';
import { 
  createInitialDifficultyState, 
  recordTurnAndAdjust, 
  DifficultyState,
  SupportLevel,
  AdjustmentResult,
} from '@/lib/conversationDifficultyController';
import { getWordsForTopic, getFramesForTopic, detectTopicFromWords } from '@/lib/topicWordBanks';

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

// Assistive Panel state for the UI
export interface AssistivePanelState {
  wordTiles: string[];
  sentenceFrames: string[];
  cueLevel: number;
  cueText: string | null;
  showTiles: boolean;
  showFrames: boolean;
  currentTopic: string | null;
  primedVocabulary: string[];
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
  currentTopic: string | null;
  // NEW: Session phase and assistive panel state
  sessionPhase: SessionPhase;
  assistivePanelState: AssistivePanelState;
  lastAction: NextAction | null;
  startSession: () => string;
  processUserTurn: (transcript: string, latencyMs: number | null, totalDurationMs?: number | null, audioBlob?: Blob) => Promise<string | null>;
  insertPendingCard: () => void;
  handleCardComplete: (messageId: string, result: unknown) => string;
  clearPendingAI: () => void;
  reset: () => void;
  requestCard: (cardType: CardType) => string;
  endSession: () => void;
  // NEW: Assistive panel interactions
  handleWordTileTap: (word: string) => void;
  handleFrameTap: (frame: string) => string;
  requestCue: () => void;
}

export function useCoachSession({
  userId,
  profileId,
  sessionId,
  maxTurns, // No default - undefined means unlimited
  userSpeechProfile,
}: UseCoachSessionProps): UseCoachSessionReturn {
  const [messages, setMessages] = useState<FeedMessage[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'ready' | 'ai_speaking' | 'user_turn' | 'card_active' | 'complete'>('ready');
  const [pendingAIText, setPendingAIText] = useState<string | null>(null);
  const [hasPendingCard, setHasPendingCard] = useState(false);
  const [engagementState, setEngagementState] = useState<MonitorEngagementState | null>(null);
  
  // NEW: Session phase & assistive panel state
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('warmup');
  const [assistivePanelState, setAssistivePanelState] = useState<AssistivePanelState>({
    wordTiles: [],
    sentenceFrames: [],
    cueLevel: 0,
    cueText: null,
    showTiles: false,
    showFrames: false,
    currentTopic: null,
    primedVocabulary: [],
  });
  const [lastAction, setLastAction] = useState<NextAction | null>(null);
  
  const orchestratorStateRef = useRef<OrchestratorState>(createInitialState(maxTurns ?? 999));
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
  
  // NEW: Cue engine and difficulty controller state
  const cueStateRef = useRef<CueState>(createInitialCueState());
  const difficultyStateRef = useRef<DifficultyState>(createInitialDifficultyState());
  
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
      // Extract topic for topic-aware intro
      const currentMessages = [...messages, { type: 'user' as const, text: transcript, id: userMessageId }];
      const conversationHistory = currentMessages
        .filter(m => m.type === 'ai' || m.type === 'user')
        .slice(-6)
        .map(m => ({
          role: m.type as 'ai' | 'user',
          text: m.type === 'ai' ? m.text : m.type === 'user' ? m.text : ''
        }));
      const topic = extractTopicFromMessages(conversationHistory);
      
      const intro = getCardIntro(action.cardType, topic);
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
        action.cardType,
        undefined,
        topic || undefined
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
          console.warn('Edge function error, using smart fallback:', error);
          
          // Get last AI message for context-aware fallback
          const lastAIMessage = messages
            .filter(m => m.type === 'ai')
            .pop();
          const lastAIText = lastAIMessage?.type === 'ai' ? lastAIMessage.text : undefined;
          
          // Use smart fallback that references conversation context
          aiResponseText = getSmartFallback(lastAIText, transcript);
        } else {
          aiResponseText = data.response;
          
          // Double-check: if AI response is a dead-end, enhance it
          const deadEnds = ['i see', 'nice.', 'okay.', 'got it.', 'makes sense.'];
          const lowerResponse = aiResponseText.toLowerCase().trim();
          if (deadEnds.some(de => lowerResponse === de || lowerResponse === de.replace('.', ''))) {
            // AI gave dead-end, enhance with smart acknowledge
            aiResponseText = getSmartAcknowledge(transcript);
          }
          
          // Check if AI suggested a break
          if (data.suggestBreak) {
            console.log('AI suggests taking a break');
          }
        }
      } catch (err) {
        console.warn('Failed to get AI response, using smart fallback:', err);
        
        // Get last AI message for context
        const lastAIMessage = messages
          .filter(m => m.type === 'ai')
          .pop();
        const lastAIText = lastAIMessage?.type === 'ai' ? lastAIMessage.text : undefined;
        
        aiResponseText = getSmartFallback(lastAIText, transcript);
      }

      addMessage({ type: 'ai', text: aiResponseText, id: generateId() });
      aiWordsRef.current += countWords(aiResponseText);
      
      orchestratorStateRef.current = updateState(
        orchestratorStateRef.current,
        stuckType,
        false
      );
      
      // No automatic wrap-up - user ends when ready
      setCurrentPhase('user_turn');
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
    
    // Get current topic for connected outro
    const currentTopic = orchestratorStateRef.current.currentTopic;
    
    if (cardType) {
      orchestratorStateRef.current = updateState(
        orchestratorStateRef.current,
        orchestratorStateRef.current.lastStuckType || 'strong_flow',
        false,
        cardType,
        cardSuccess as boolean
      );
    }

    // Use topic-connected outro
    const outro = getCardOutro(currentTopic || undefined);
    addMessage({ type: 'ai', text: outro, id: generateId() });
    aiWordsRef.current += countWords(outro);
    
    // No automatic wrap-up - user ends when ready
    setCurrentPhase('user_turn');
    setPendingAIText(outro);
    return outro;
  }, [messages, addMessage]);

  // New: Handle user-requested card insertion
  const requestCard = useCallback((cardType: CardType): string => {
    const topic = orchestratorStateRef.current.currentTopic;
    const { intro, config } = getUserRequestedCardConfig(cardType, topic);
    
    addMessage({ type: 'ai', text: intro, id: generateId() });
    aiWordsRef.current += countWords(intro);
    
    pendingCardTypeRef.current = cardType;
    pendingCardDifficultyRef.current = config.difficulty;
    setHasPendingCard(true);
    
    // Update state but mark as user-requested (doesn't count against auto limits)
    orchestratorStateRef.current = {
      ...orchestratorStateRef.current,
      userRequestedCards: orchestratorStateRef.current.userRequestedCards + 1,
    };
    
    return intro;
  }, [addMessage]);

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
    setSessionPhase('warmup');
    setAssistivePanelState({
      wordTiles: [],
      sentenceFrames: [],
      cueLevel: 0,
      cueText: null,
      showTiles: false,
      showFrames: false,
      currentTopic: null,
      primedVocabulary: [],
    });
    setLastAction(null);
    orchestratorStateRef.current = createInitialState(maxTurns ?? 999);
    latenciesRef.current = [];
    userWordsRef.current = 0;
    aiWordsRef.current = 0;
    cardsCompletedRef.current = 0;
    pendingCardIdRef.current = null;
    pendingCardTypeRef.current = null;
    engagementMonitorRef.current.reset();
    speechAnalysis.reset();
    analysisHistoryRef.current = [];
    cueStateRef.current = createInitialCueState();
    difficultyStateRef.current = createInitialDifficultyState();
  }, [maxTurns, speechAnalysis]);

  // User-initiated session end
  const endSession = useCallback(() => {
    setIsComplete(true);
    setCurrentPhase('complete');
  }, []);

  // NEW: Assistive panel interaction handlers
  const handleWordTileTap = useCallback((word: string) => {
    // Add the word to the conversation as if user spoke it
    const messageId = generateId();
    addMessage({ type: 'user', text: word, id: messageId });
    userWordsRef.current += 1;
    
    // Track as a rep/word retrieval success
    orchestratorStateRef.current = updateState(
      orchestratorStateRef.current,
      'strong_flow',
      false,
      undefined,
      true,
      undefined,
      [word]
    );
    
    // Update difficulty controller with success
    const adjustResult = recordTurnAndAdjust(difficultyStateRef.current, true);
    difficultyStateRef.current = adjustResult.newState;
  }, [addMessage]);

  const handleFrameTap = useCallback((frame: string): string => {
    // Return the frame template for the input field
    return frame;
  }, []);

  const requestCue = useCallback(() => {
    // Escalate cue level
    cueStateRef.current = updateCueState(cueStateRef.current, 'escalate', false);
    
    const newCueText = getCueTextForLevel(
      cueStateRef.current.currentLevel,
      cueStateRef.current.targetWord,
      orchestratorStateRef.current.currentTopic || undefined
    );
    
    setAssistivePanelState(prev => ({
      ...prev,
      cueLevel: cueStateRef.current.currentLevel,
      cueText: newCueText,
    }));
  }, []);

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
    currentTopic: orchestratorStateRef.current.currentTopic,
    // NEW: Session phase and assistive panel
    sessionPhase,
    assistivePanelState,
    lastAction,
    startSession,
    processUserTurn,
    insertPendingCard,
    handleCardComplete,
    clearPendingAI,
    reset,
    requestCard,
    endSession,
    // NEW: Assistive panel interactions
    handleWordTileTap,
    handleFrameTap,
    requestCue,
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
