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

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { saveCoachSessionSummary, loadLatestCoachSummary, formatMemoryForPrompt, type CoachSessionSummary } from '@/lib/coachSessionMemory';
import { 
  getNextAction, 
  createInitialState, 
  updateState,
  updateStateAfterPopup,
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
  type PopupReason,
} from '@/lib/coachOrchestrator';
import type { NormalizedExerciseResult } from '@/lib/normalizedExerciseResult';
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
import { getWordsForTopic, getFramesForTopic, detectTopicFromWords, getWarmupWords } from '@/lib/topicWordBanks';

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

// Pending popup exercise info
export interface PendingPopupExercise {
  slug: string;
  reason: PopupReason;
  targetDomain?: string;
  targetPhonemes?: string[];
  difficultyHint?: 'easier' | 'same' | 'harder';
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
  sessionPhase: SessionPhase;
  assistivePanelState: AssistivePanelState;
  lastAction: NextAction | null;
  // Popup exercise
  pendingPopupExercise: PendingPopupExercise | null;
  ingestExerciseResult: (result: NormalizedExerciseResult) => Promise<string>;
  startSession: () => string;
  processUserTurn: (transcript: string, latencyMs: number | null, totalDurationMs?: number | null, audioBlob?: Blob) => Promise<string | null>;
  insertPendingCard: () => void;
  handleCardComplete: (messageId: string, result: unknown) => string;
  clearPendingAI: () => void;
  reset: () => void;
  requestCard: (cardType: CardType) => string;
  endSession: () => void;
  handleWordTileTap: (word: string) => string;
  handleFrameTap: (frame: string) => string;
  requestCue: (level?: number) => void;
  currentSupportLevel: SupportLevel;
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
  const [pendingPopupExercise, setPendingPopupExercise] = useState<PendingPopupExercise | null>(null);
  
  // Cross-session memory
  const [priorSessionSummary, setPriorSessionSummary] = useState<CoachSessionSummary | null>(null);
  const popupResultsRef = useRef<NormalizedExerciseResult[]>([]);
  
  // Load prior session summary on mount
  useEffect(() => {
    loadLatestCoachSummary(userId).then(setPriorSessionSummary);
  }, [userId]);
  
  // NEW: Session phase & assistive panel state
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('warmup');
  // FIX #1: Make supportLevel reactive (not read from ref at render time)
  const [currentSupportLevel, setCurrentSupportLevel] = useState<SupportLevel>('guided');
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
  // FIX #4: Use ref for primed vocabulary to avoid stale closures
  const primedVocabularyRef = useRef<string[]>([]);
  
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
    
    // Initialize assistive panel with warmup words
    const warmupWords = getWarmupWords();
    primedVocabularyRef.current = warmupWords; // FIX #4: Keep ref in sync
    setAssistivePanelState(prev => ({
      ...prev,
      wordTiles: warmupWords,
      showTiles: true,
      primedVocabulary: warmupWords,
    }));
    
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
    setLastAction(action);
    
    // DEBUG LOGGING: Orchestrator decision
    console.log('[orchestrator]', { 
      turn: orchestratorStateRef.current.turnNumber, 
      actionType: action.type,
      showTiles: 'showTiles' in action ? action.showTiles : undefined,
      showFrames: 'showFrames' in action ? action.showFrames : undefined,
      objective: 'objective' in action ? action.objective : undefined,
    });
    
    // FIX #3: Apply cue engine first (emergency override), then orchestrator (session policy)
    // Cue engine runs on struggle signals, orchestrator runs on session flow
    const topic = orchestratorStateRef.current.currentTopic;
    // FIX #3: Improved silenceMs - only treat as "silence" when wordCount === 0
    // Using slower per-word estimate for aphasia speech (700ms), and only use silence triggers
    // when user truly didn't speak (avoids misclassifying slow speech as silence)
    const estimatedSpeechMs = wordCount * 700; // more realistic for aphasia
    const rawSilenceMs = totalDurationMs 
      ? Math.max(0, totalDurationMs - estimatedSpeechMs)
      : (latencyMs ?? 0);
    // Only use silence triggers if they truly didn't speak
    const effectiveSilenceMs = wordCount === 0 ? rawSilenceMs : 0;
    
    const cueRec = getCueForUtterance(
      {
        wordCount,
        effortfulSpeech: analysis.effortfulSpeech,
        pausePattern: analysis.pausePattern,
        silenceMs: effectiveSilenceMs, // FIX #3: Use effective silence
        filledPauseCount: analysis.filledPauseCount || 0,
        fluencyScore: analysis.fluencyScore || 50,
        circumlocutionDetected: analysis.circumlocutionDetected,
        lastUserWords: transcript.split(/\s+/).slice(-3),
        primedVocabulary: primedVocabularyRef.current, // FIX #4: Use ref
      },
      topic,
      primedVocabularyRef.current, // FIX #4: Use ref
      cueStateRef.current
    );
    
    // DEBUG LOGGING: Cue engine recommendation
    console.log('[cue-engine]', { 
      turn: orchestratorStateRef.current.turnNumber,
      action: cueRec.action,
      cueLevel: cueRec.cueLevel,
      tiles: cueRec.tiles?.length,
      frames: cueRec.frames?.length,
      effectiveSilenceMs,
    });
    
    // DEBUG LOGGING: Turn signals
    console.log('[turn]', { 
      transcript: transcript.slice(0, 50),
      wordCount,
      effortful: analysis.effortfulSpeech,
      pausePattern: analysis.pausePattern,
      filledPauseCount: analysis.filledPauseCount,
      circumlocution: analysis.circumlocutionDetected,
      effectiveSilenceMs,
    });
    
    // Update cue state based on recommendation
    const userSucceeded = wordCount >= 3 && !analysis.effortfulSpeech;
    if (cueRec.action !== 'none') {
      cueStateRef.current = updateCueState(cueStateRef.current, cueRec.action, userSucceeded);
    } else if (userSucceeded) {
      // Reset on success even if no action
      cueStateRef.current = updateCueState(cueStateRef.current, 'celebrate', true);
    }
    
    // Determine panel state: cue engine overrides orchestrator when struggling
    const topicWords = topic ? getWordsForTopic(topic) : [];
    const topicFrames = topic ? getFramesForTopic(topic) : [];
    
    if (cueRec.action !== 'none' && cueRec.action !== 'celebrate') {
      // Cue engine takes precedence (user is struggling)
      setAssistivePanelState(prev => {
        // FIX #4: Keep ref in sync
        const newPrimed = prev.primedVocabulary;
        primedVocabularyRef.current = newPrimed;
        return {
          ...prev,
          showTiles: true,  // Always show tiles when struggling
          showFrames: cueRec.cueLevel >= 2,  // Show frames at higher cue levels
          wordTiles: cueRec.tiles || [...new Set([...newPrimed, ...topicWords])].slice(0, 6),
          sentenceFrames: cueRec.frames || topicFrames,
          cueLevel: cueRec.cueLevel,
          cueText: cueRec.cueText || getCueTextForLevel(
            cueRec.cueLevel,
            cueStateRef.current.targetWord,
            topic || undefined
          ),
          currentTopic: topic,
        };
      });
    } else if (action.type === 'chat_followup') {
      // Orchestrator policy applies (user is flowing)
      setAssistivePanelState(prev => {
        // FIX #4: Keep ref in sync
        const newPrimed = prev.primedVocabulary;
        primedVocabularyRef.current = newPrimed;
        return {
          ...prev,
          showTiles: action.showTiles ?? prev.showTiles,
          showFrames: action.showFrames ?? prev.showFrames,
          wordTiles: action.showTiles ? [...new Set([...newPrimed, ...topicWords])].slice(0, 6) : prev.wordTiles,
          sentenceFrames: action.showFrames ? topicFrames : prev.sentenceFrames,
          currentTopic: topic,
          // Reset cue level on success
          cueLevel: userSucceeded ? 0 : prev.cueLevel,
          cueText: userSucceeded ? null : prev.cueText,
        };
      });
    }
    
    // Update difficulty controller with turn result
    const turnSuccess = wordCount >= 3 && !analysis.effortfulSpeech;
    const adjustResult = recordTurnAndAdjust(difficultyStateRef.current, turnSuccess);
    difficultyStateRef.current = adjustResult.newState;
    
    // FIX #1: Update reactive supportLevel state when it changes
    if (adjustResult.newState.supportLevel !== currentSupportLevel) {
      setCurrentSupportLevel(adjustResult.newState.supportLevel);
    }
    
    // DEBUG LOGGING: Difficulty controller
    console.log('[difficulty]', { 
      turn: orchestratorStateRef.current.turnNumber,
      support: adjustResult.newState.supportLevel,
      cueFrequency: adjustResult.newState.cueFrequency,
      action: adjustResult.action,
    });

    let aiResponseText: string | null = null;

    // Handle action
    if (action.type === 'wrap_up') {
      const wrapUpText = getFollowupLine('wrap_up');
      addMessage({ type: 'ai', text: wrapUpText, id: generateId() });
      aiWordsRef.current += countWords(wrapUpText);
      aiResponseText = wrapUpText;
      setIsComplete(true);
      setCurrentPhase('complete');
    } else if (action.type === 'popup_exercise') {
      // Trigger popup exercise modal
      const introLines = [
        "Let's try a quick practice together.",
        "I have a short exercise that might help.",
        "Let's work on this a different way.",
      ];
      const intro = introLines[Math.floor(Math.random() * introLines.length)];
      addMessage({ type: 'ai', text: intro, id: generateId() });
      aiWordsRef.current += countWords(intro);
      aiResponseText = intro;
      
      setPendingPopupExercise({
        slug: action.slug,
        reason: action.reason,
        targetDomain: action.targetDomain,
        targetPhonemes: action.targetPhonemes,
        difficultyHint: action.difficultyHint,
      });
      
      orchestratorStateRef.current = updateState(
        orchestratorStateRef.current, stuckType, false
      );
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
            // Prior session memory for continuity
            priorSessionMemory: priorSessionSummary ? formatMemoryForPrompt(priorSessionSummary) : undefined,
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
    
    // FIX #3: Expand success detection to handle more result formats
    const cardSuccess = result && typeof result === 'object' && 
      (('success' in result && result.success === true) || 
       ('answered' in result && result.answered === true) ||
       ('correct' in result && result.correct === true) ||
       ('completed' in result));  // Treat any completion as success for phase progression
    
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
    
    // Store previous state for logging
    const prevPhase = orchestratorStateRef.current.sessionPhase;
    const prevWarmupCount = orchestratorStateRef.current.warmupCardsCompleted;
    
    if (cardType) {
      // FIX #1: Pass cardInserted=true (we ARE completing an inserted card)
      orchestratorStateRef.current = updateState(
        orchestratorStateRef.current,
        orchestratorStateRef.current.lastStuckType || 'strong_flow',
        true,  // FIX: Card WAS inserted
        cardType,
        cardSuccess as boolean,
        currentTopic,
        userResponse ? String(userResponse).split(/\s+/).filter(w => w.length > 2) : undefined
      );
      
      // FIX #2: Debug logging for phase transitions
      console.log('[card-complete]', {
        cardType,
        cardSuccess,
        previousPhase: prevPhase,
        newPhase: orchestratorStateRef.current.sessionPhase,
        warmupCardsCompleted: orchestratorStateRef.current.warmupCardsCompleted,
        prevWarmupCount,
        buildComplete: orchestratorStateRef.current.buildComplete,
        cardsInsertedThisSession: orchestratorStateRef.current.cardsInsertedThisSession,
      });
    }
    
    // Prime vocabulary from card result (for later reuse)
    if (userResponse && typeof userResponse === 'string') {
      const responseWords = userResponse.split(/\s+/).filter(w => w.length > 2);
      if (responseWords.length > 0) {
        setAssistivePanelState(prev => {
          const newPrimed = [...new Set([...prev.primedVocabulary, ...responseWords])].slice(0, 10);
          primedVocabularyRef.current = newPrimed; // FIX #4: Keep ref in sync
          return {
            ...prev,
            primedVocabulary: newPrimed,
          };
        });
      }
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
    primedVocabularyRef.current = []; // FIX #4: Reset ref
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
    setCurrentSupportLevel('guided'); // FIX #1: Reset reactive support level
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
  // FIX #1: Tile taps are INPUT-ONLY - no scoring, no orchestrator updates
  // Scoring happens in processUserTurn when the word is actually submitted
  const handleWordTileTap = useCallback((word: string): string => {
    // Just return the word - caller handles submission via processTurnAndRespond
    // Do NOT update orchestrator or difficulty here (would double-score)
    return word;
  }, []);

  const handleFrameTap = useCallback((frame: string): string => {
    // Return the frame template for the input field
    return frame;
  }, []);

  // FIX #2: requestCue accepts optional level parameter
  const requestCue = useCallback((level?: number) => {
    // If level provided, set directly; otherwise escalate by 1
    const nextLevel = typeof level === 'number'
      ? Math.min(Math.max(level, 0), 4)
      : Math.min(cueStateRef.current.currentLevel + 1, 4);
    
    cueStateRef.current = {
      ...cueStateRef.current,
      currentLevel: nextLevel,
      lastActionTime: Date.now(),
    };
    
    const newCueText = getCueTextForLevel(
      nextLevel,
      cueStateRef.current.targetWord,
      orchestratorStateRef.current.currentTopic || undefined
    );
    
    setAssistivePanelState(prev => ({
      ...prev,
      cueLevel: nextLevel,
      cueText: newCueText,
    }));
  }, []);

  // Ingest result from popup exercise and generate Maya follow-up
  const ingestExerciseResult = useCallback(async (result: NormalizedExerciseResult): Promise<string> => {
    setPendingPopupExercise(null);
    
    // Update orchestrator state
    orchestratorStateRef.current = updateStateAfterPopup(
      orchestratorStateRef.current,
      result.score >= 0.5,
      result.targetWords
    );

    // Generate AI follow-up that references the exercise
    let followupText: string;
    try {
      const { data, error } = await supabase.functions.invoke('conversation-coach-ai', {
        body: {
          userTranscript: `[Completed ${result.slug} exercise]`,
          turnNumber: orchestratorStateRef.current.turnNumber,
          conversationHistory: messages
            .filter(m => m.type === 'ai' || m.type === 'user')
            .slice(-4)
            .map(m => ({ role: m.type as 'ai' | 'user', text: (m as any).text || '' })),
          exerciseContext: {
            slug: result.slug,
            summary: result.summary,
            accuracy: result.accuracy,
            cueLevelUsed: result.cueLevelUsed,
            successBand: result.successBand,
            targetDomain: result.targetDomain,
            errorTypes: result.errorTypes,
            struggleSignal: result.struggleSignal,
          },
        }
      });
      followupText = data?.response || result.score >= 0.7
        ? "Nice work on that! Let's keep going with our conversation."
        : "Good effort — that gives me a better sense of what to focus on. Let's continue.";
    } catch {
      followupText = result.score >= 0.7
        ? "Great job on that practice! Now, where were we?"
        : "Thanks for working through that. Let's keep chatting.";
    }

    addMessage({ type: 'ai', text: followupText, id: generateId() });
    aiWordsRef.current += countWords(followupText);
    setPendingAIText(followupText);
    setCurrentPhase('user_turn');
    
    return followupText;
  }, [messages, addMessage]);

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
    sessionPhase,
    assistivePanelState,
    lastAction,
    pendingPopupExercise,
    ingestExerciseResult,
    startSession,
    processUserTurn,
    insertPendingCard,
    handleCardComplete,
    clearPendingAI,
    reset,
    requestCard,
    endSession,
    handleWordTileTap,
    handleFrameTap,
    requestCue,
    currentSupportLevel,
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
