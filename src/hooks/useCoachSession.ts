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

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { saveCoachSessionSummary, loadLatestCoachSummary, type CoachSessionSummary } from '@/lib/coachSessionMemory';
import { loadPatientIntelligence, serializeSnapshotForStorage, formatPatientIntelligenceForPrompt, getIntelligenceBiases, type PatientIntelligenceProfile, type IntelligenceBiases } from '@/lib/patientIntelligence';
import { selectTherapyStrategy, formatStrategyForPrompt, shouldSwitchStrategy, type TherapyStrategy, type MidSessionSignals } from '@/lib/therapyStrategyEngine';
import { validateResponse, applyClinicianOverride, enforceСueType, type ClinicianStrategyOverride } from '@/lib/strategyEnforcement';
import { generateContextBridge, generateTaskReturn } from '@/lib/flowEngine';
import { getPostCardReturn, getDifficultyNarration, getCircumlocutionOffer, getSuccessFeedback, getStruggleFeedback } from '@/lib/therapistFeedback';
import { matchAnswer, getFeedbackForMatch } from '@/lib/answerMatcher';
import { PHOTO_BANK, PhotoTrial } from '@/data/photoBank';
import { getMinimalPairTrials, getMinimalPairTrialsForLevel, MinimalPairTrial } from '@/data/minimalPairsBank';
import { generateSemanticCue, generatePhonologicalCue } from '@/lib/cueGenerator';
import type { MayaState } from '@/lib/buildMayaState';
import { formatMayaStateForCoachPrompt } from '@/lib/buildMayaState';
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
} from '@/lib/conversationFollowups';
import { classifyStuckType } from '@/lib/stuckTypeClassifier';
import { detectUtteranceComplete } from '@/lib/completionDetector';
import { FeedMessage } from '@/components/coach/CoachChatFeed';
import { EngagementMonitor, EngagementState as MonitorEngagementState } from '@/lib/engagementMonitor';
import { useConversationSpeechAnalysis, ConversationUtteranceAnalysis } from './useConversationSpeechAnalysis';
import { SessionIntelligenceTracker } from '@/lib/sessionIntelligence';
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
import { emitConversationTurnEvent, classifyTurnOutcome } from '@/lib/conversationTurnTelemetry';
import { buildAnchorContext, validateAnchoring, type AnchorMetrics } from '@/lib/anchorExtractor';
import { determineResponseLevel, TRLTracker, type ResponseLevelResult, type AnchorUsageType } from '@/lib/therapeuticResponseLadder';
import { RepairSuccessTracker } from '@/lib/repairSuccessTracker';
import { evaluateGameTrigger, createTriggerState, triggerToPopupExercise, type GameTriggerResult } from '@/lib/trlGameTriggers';
import { buildEntityAllowlist, getHallucinationGuardPromptBlock } from '@/lib/hallucinationGuard';
import { createSessionPhaseState, evaluatePhaseTransition, applyPhaseTransition, getPhaseBiases, getCloseSessionInsight, type SessionPhaseState as TherapyPhaseState } from '@/lib/sessionPhaseController';
import { createFeedbackTracker, recordTurnForFeedback, type FeedbackTracker } from '@/lib/microFeedback';
import { generateGameIntro, generateGameReturn, type GameTransitionContext, type GameReturnContext } from '@/lib/gameTransitions';
import { sanitizeMayaLine } from '@/lib/mayaSpeechGate';

// Correction detection patterns
const CORRECTION_PATTERNS = [
  /no,?\s*(i was|we were|i'm) (talking|telling|saying)/i,
  /that's not what i (said|meant)/i,
  /you'?re not listening/i,
  /i (said|meant|was talking about)/i,
  /no,?\s*i mean/i,
  /we'?re talking about/i,
  /i already (told|said|mentioned)/i,
];

function detectUserCorrection(transcript: string): boolean {
  return CORRECTION_PATTERNS.some(p => p.test(transcript));
}

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
  // Unified Maya intelligence state
  mayaState?: MayaState | null;
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
  // Inline photo naming
  activeInlinePhoto: { target: string; category: string; features: any } | null;
  // Inline minimal pairs
  activeInlineMinimalPair: { word1: string; word2: string; targetWord: string; targetIndex: 0 | 1; phoneme1: string; phoneme2: string } | null;
  handleMinimalPairSelect: (messageId: string, selectedIndex: 0 | 1) => void;
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
  addMessage: (message: FeedMessage) => void;
}

export function useCoachSession({
  userId,
  profileId,
  sessionId,
  maxTurns, // No default - undefined means unlimited
  mayaState,
  userSpeechProfile,
}: UseCoachSessionProps): UseCoachSessionReturn {
  const [messages, setMessages] = useState<FeedMessage[]>([]);
  const messagesRef = useRef<FeedMessage[]>([]);
  // Keep messagesRef in sync for use in callbacks
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const [isComplete, setIsComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'ready' | 'ai_speaking' | 'user_turn' | 'card_active' | 'complete'>('ready');
  const [pendingAIText, setPendingAIText] = useState<string | null>(null);
  const [hasPendingCard, setHasPendingCard] = useState(false);
  const [engagementState, setEngagementState] = useState<MonitorEngagementState | null>(null);
  const [pendingPopupExercise, setPendingPopupExercise] = useState<PendingPopupExercise | null>(null);
  
  // ═══════════════════════════════════════════════════════════════
  // INLINE PHOTO NAMING — No mode switch, stays in chat_listening
  // ═══════════════════════════════════════════════════════════════
  const activeInlinePhotoRef = useRef<{
    trial: PhotoTrial;
    messageId: string;
    startTime: number;
    cueLevel: number; // 0=none, 1=semantic, 2=phonemic
  } | null>(null);
  
  // INLINE MINIMAL PAIRS — No mode switch, tap-based in chat
  const activeInlineMinimalPairRef = useRef<{
    trial: MinimalPairTrial;
    messageId: string;
    startTime: number;
  } | null>(null);
  
  // Cross-session memory (now via MayaState from parent, fallback to direct load)
  const [fallbackSummary, setFallbackSummary] = useState<CoachSessionSummary | null>(null);
  const popupResultsRef = useRef<NormalizedExerciseResult[]>([]);
  
  // Cross-session patient intelligence profile
  const [patientIntelligence, setPatientIntelligence] = useState<PatientIntelligenceProfile | null>(null);
  const intelligenceBiasesRef = useRef<IntelligenceBiases>({ minimalPairBias: 0, photoNamingBias: 0, targetPhonemes: [], retryWords: [] });
  const activeStrategyRef = useRef<TherapyStrategy | null>(null);
  const clinicianLockedRef = useRef<boolean>(false);
  
  // Load cross-session intelligence and fallback summary
  useEffect(() => {
    if (!mayaState) {
      loadLatestCoachSummary(userId).then(setFallbackSummary);
    }
    // Always load patient intelligence for exercise biasing + strategy selection
    loadPatientIntelligence(userId).then(async (profile) => {
      if (profile) {
        setPatientIntelligence(profile);
        const biases = getIntelligenceBiases(profile);
        intelligenceBiasesRef.current = biases;
        // Inject biases into orchestrator state
        orchestratorStateRef.current = {
          ...orchestratorStateRef.current,
          intelligenceBiases: biases,
        };
        
        // Select therapy strategy from cross-session intelligence
        const { strategy, candidates } = selectTherapyStrategy({
          patientProfile: profile,
          todayFocus: null,
          sessionSnapshot: null,
        });
        
        // Check for clinician strategy overrides
        let finalStrategy = strategy;
        try {
          const { data: overrideData } = await (supabase as any)
            .from('clinician_overrides')
            .select('value_after')
            .eq('profile_id', profileId)
            .eq('override_type', 'therapy_strategy')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (overrideData?.[0]?.value_after) {
            const clinicianOverride = overrideData[0].value_after as ClinicianStrategyOverride;
            
            // FIX: If clinician locked a specific strategy, force-select it by ID
            if (clinicianOverride.lockedStrategyId && clinicianOverride.lockedStrategyId !== strategy.id) {
              const { strategy: lockedStrategy } = selectTherapyStrategy({
                patientProfile: profile,
                todayFocus: null,
                sessionSnapshot: null,
                forceStrategyId: clinicianOverride.lockedStrategyId,
              });
              finalStrategy = applyClinicianOverride(lockedStrategy, clinicianOverride);
              clinicianLockedRef.current = true;
              console.log('[strategy] Clinician lock applied:', clinicianOverride.lockedStrategyId);
            } else {
              finalStrategy = applyClinicianOverride(strategy, clinicianOverride);
            }
          }
        } catch (err) {
          console.warn('[strategy] Failed to load clinician overrides:', err);
        }
        
        activeStrategyRef.current = finalStrategy;
        orchestratorStateRef.current = {
          ...orchestratorStateRef.current,
          activeStrategy: finalStrategy,
        };
        
        console.log('[therapy-strategy] Selected:', {
          strategy: finalStrategy.id,
          label: finalStrategy.label,
          goal: finalStrategy.sessionGoal,
          confidence: finalStrategy.confidence,
          reasoning: finalStrategy.reasoning,
          candidates: candidates.slice(0, 3).map(c => `${c.id}(${c.score})`),
        });
        console.log('[patient-intelligence] Loaded cross-session profile:', {
          sessions: profile.sessionCount,
          phonemeErrors: profile.persistentPhonemeErrors.length,
          struggledWords: profile.persistentStruggledWords.length,
          recoveredWords: profile.recoveredWords.length,
          trend: profile.successRateTrend,
          biases,
        });
      }
    });
  }, [userId, mayaState]);
  
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
  const anchorMetricsRef = useRef<AnchorMetrics[]>([]);
  
  // NEW: Cue engine and difficulty controller state
  const cueStateRef = useRef<CueState>(createInitialCueState());
  const trlTrackerRef = useRef(new TRLTracker());
  const repairTrackerRef = useRef(new RepairSuccessTracker());
  const gameTriggerStateRef = useRef(createTriggerState());
  const difficultyStateRef = useRef<DifficultyState>(createInitialDifficultyState());
  // FIX #4: Use ref for primed vocabulary to avoid stale closures
  const primedVocabularyRef = useRef<string[]>([]);
  // Session phase controller — manages ideal 5-minute flow
  const sessionPhaseStateRef = useRef<TherapyPhaseState>(createSessionPhaseState());
  // Micro-feedback tracker — surfaces progress moments
  const feedbackTrackerRef = useRef<FeedbackTracker>(createFeedbackTracker());
  // Rolling semantic memory — AI-maintained conversation summary
    const rollingMemoryRef = useRef<string>('');
    // Session intelligence tracker — within-session memory for Maya
    const sessionIntelRef = useRef(new SessionIntelligenceTracker());
  // Maya Speech Gate state
  const userCorrectionActiveRef = useRef(false);
  const establishedFactsRef = useRef<string[]>([]);
  const pendingVisualActionRef = useRef(false);
  // Speech analysis hook
  const speechAnalysis = useConversationSpeechAnalysis({
    userId,
    profileId,
    sessionId,
  });

  // Centralized addMessage with Maya Speech Gate for AI messages
  const addMessage = useCallback((message: FeedMessage) => {
    if (message.type === 'ai' && message.text) {
      const gateResult = sanitizeMayaLine({
        text: message.text,
        activeTopic: orchestratorStateRef.current.currentTopic,
        establishedFacts: establishedFactsRef.current,
        userCorrectionActive: userCorrectionActiveRef.current,
        pendingVisualAction: pendingVisualActionRef.current,
        source: 'addMessage',
      });
      if (gateResult.rewritten || gateResult.blocked) {
        message = { ...message, text: gateResult.approvedText };
      }
    }
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
    
    // ═══════════════════════════════════════════════════════════════
    // MAYA SPEECH GATE: Detect user corrections & track established facts
    // ═══════════════════════════════════════════════════════════════
    if (detectUserCorrection(transcript)) {
      userCorrectionActiveRef.current = true;
      console.log('[MayaSpeechGate] User correction detected:', transcript.slice(0, 80));
    } else {
      // Clear correction flag after one non-correction turn
      userCorrectionActiveRef.current = false;
    }
    // Track established facts from user statements (simple extraction)
    const factWords = transcript.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (factWords.length >= 2 && transcript.length > 15) {
      establishedFactsRef.current.push(transcript.slice(0, 100));
      if (establishedFactsRef.current.length > 10) establishedFactsRef.current.shift();
    }
    // ═══════════════════════════════════════════════════════════════
    // INLINE PHOTO NAMING — Check answer before regular flow
    // ═══════════════════════════════════════════════════════════════
    if (activeInlinePhotoRef.current && transcript.trim().length > 0) {
      const photo = activeInlinePhotoRef.current;
      
      // Smart answer matching — handles synonyms, phonetic errors, circumlocution
      const match = matchAnswer(
        transcript,
        photo.trial.target,
        photo.trial.semanticFoils,
        photo.trial.category,
      );
      
      const latencyFromPhoto = Date.now() - photo.startTime;
      const wasQuick = latencyFromPhoto < 4000;
      
      // SESSION INTELLIGENCE: Check history and record attempt
      const wasHardBefore = sessionIntelRef.current.wasHardBefore(photo.trial.target);
      const isImproving = sessionIntelRef.current.isImprovingOn(photo.trial.target);
      sessionIntelRef.current.recordPhotoAttempt(
        photo.trial.target,
        match,
        photo.cueLevel,
        latencyFromPhoto,
        orchestratorStateRef.current.turnNumber,
      );
      
      // Mark inline photo as answered (reveal word only on correct or after giving it)
      setMessages(prev => prev.map(msg => 
        msg.id === photo.messageId && msg.type === 'inline_photo'
          ? { ...msg, answered: true, revealedWord: photo.trial.target }
          : msg
      ));
      
      // Add user message
      const userMessageId = generateId();
      addMessage({ type: 'user', text: transcript || '(no speech)', id: userMessageId });
      userWordsRef.current += countWords(transcript);
      
      // Generate context-aware therapist feedback with session memory
      const feedback = getFeedbackForMatch(match, photo.trial.target, {
        wasQuick,
        cueLevel: photo.cueLevel,
        wasHardBefore,
      });
      
      // Natural continuation back into conversation
      const topic = orchestratorStateRef.current.currentTopic;
      let continuation = '';
      if (match.countsAsCorrect && topic) {
        const continuations = [
          ` Anyway — you were telling me about ${topic}...`,
          ` So, back to ${topic}?`,
          ` Speaking of ${topic} — what else?`,
        ];
        continuation = continuations[Math.floor(Math.random() * continuations.length)];
      } else if (match.countsAsCorrect) {
        const continuations = [
          ' So, what were you saying?',
          ' Okay — what else is on your mind?',
          ' Alright, keep going!',
        ];
        continuation = continuations[Math.floor(Math.random() * continuations.length)];
      }
      
      const fullResponse = feedback + continuation;
      addMessage({ type: 'ai', text: fullResponse, id: generateId() });
      aiWordsRef.current += countWords(fullResponse);
      
      // Update orchestrator state
      orchestratorStateRef.current = updateState(
        orchestratorStateRef.current,
        match.countsAsCorrect ? 'strong_flow' : 'word_search_stall',
        true,
        'photo_naming',
        match.countsAsCorrect,
        topic || undefined,
        [photo.trial.target]
      );
      
      // Clear active inline photo
      activeInlinePhotoRef.current = null;
      
      setPendingAIText(fullResponse);
      setIsProcessing(false);
      setCurrentPhase('user_turn');
      return fullResponse;
    }
    
    // Add user message (regular flow)
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

    // SESSION INTELLIGENCE: Record conversation-level signals
    if (analysis.circumlocutionDetected) {
      sessionIntelRef.current.recordConversationSignal('circumlocution', orchestratorStateRef.current.turnNumber, transcript);
    }
    if (analysis.effortfulSpeech) {
      sessionIntelRef.current.recordConversationSignal('effortful', orchestratorStateRef.current.turnNumber);
    }
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
    // FIX: Allow silence detection for effortful speakers (1-2 words)
    // Core aphasia users produce minimal speech — zeroing silence breaks cueing for them
    const effectiveSilenceMs = wordCount <= 2 ? rawSilenceMs : 0;
    
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
    
    // ENFORCE CUE TYPE based on active strategy
    if (activeStrategyRef.current && cueRec.cueLevel >= 2) {
      const requestedCueType = cueRec.cueLevel >= 4 ? 'full_word' as const
        : cueRec.cueLevel >= 3 ? 'phonemic' as const
        : 'semantic' as const;
      const enforcedType = enforceСueType(requestedCueType, activeStrategyRef.current);
      // Remap cue level if enforcement changed the type
      if (enforcedType !== requestedCueType) {
        const remappedLevel = enforcedType === 'full_word' ? 4
          : enforcedType === 'phonemic' ? 3 : 2;
        cueRec.cueLevel = remappedLevel;
        console.log('[cue-enforce] Overrode cue type:', requestedCueType, '→', enforcedType);
      }
    }

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
    const previousSupport = difficultyStateRef.current.supportLevel;
    difficultyStateRef.current = adjustResult.newState;
    
    // FIX #1: Update reactive supportLevel state when it changes
    if (adjustResult.newState.supportLevel !== currentSupportLevel) {
      setCurrentSupportLevel(adjustResult.newState.supportLevel);
    }
    
    // TRANSPARENT ADAPTATION: Narrate difficulty changes so user understands
    let difficultyNarration: string | null = null;
    if (previousSupport !== adjustResult.newState.supportLevel) {
      if (adjustResult.action === 'increase_support') {
        difficultyNarration = getDifficultyNarration('easier');
      } else if (adjustResult.action === 'decrease_support') {
        difficultyNarration = getDifficultyNarration('harder');
      }
    }
    
    // DEBUG LOGGING: Difficulty controller
    console.log('[difficulty]', { 
      turn: orchestratorStateRef.current.turnNumber,
      support: adjustResult.newState.supportLevel,
      cueFrequency: adjustResult.newState.cueFrequency,
      action: adjustResult.action,
      narration: difficultyNarration,
    });

    let aiResponseText: string | null = null;
    // Reset pending visual flag before each action branch
    pendingVisualActionRef.current = false;

    // Handle action
    if (action.type === 'wrap_up') {
      const wrapUpText = getFollowupLine('wrap_up');
      addMessage({ type: 'ai', text: wrapUpText, id: generateId() });
      aiWordsRef.current += countWords(wrapUpText);
      aiResponseText = wrapUpText;
      setIsComplete(true);
      setCurrentPhase('complete');
    } else if (action.type === 'popup_exercise') {
      pendingVisualActionRef.current = true; // Gate: allow game transition language
      // GAME TRANSITIONS: Use contextual intro based on trigger type
      const intro = generateGameIntro({
        currentTopic: orchestratorStateRef.current.currentTopic,
        triggerType: action.reason === 'repeated_struggle' ? 'confidence_rebuild' : 'targeted_drill',
        gameSlug: action.slug,
        userLastWords: transcript.slice(0, 50),
        trlLevel: 2,
      });
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
    } else if (action.type === 'inline_photo_naming') {
      // ═══════════════════════════════════════════════════════════
      // INLINE PHOTO NAMING — No mode switch, image appears in chat
      // Maya introduces it naturally, user responds through normal speech
      // ═══════════════════════════════════════════════════════════
      pendingVisualActionRef.current = true; // Gate: allow "show you" / "check this out"
      const maxDifficulty = action.difficulty === 'easy' ? 2 : 3;
      const photos = PHOTO_BANK.filter(p => p.computed_difficulty <= maxDifficulty);
      const trial = photos[Math.floor(Math.random() * photos.length)];
      
      if (trial) {
        // Natural, varied intro — feels like a therapist, not a system
        const currentTopic = orchestratorStateRef.current.currentTopic;
        const topicIntros = currentTopic ? [
          `Hey — while we're talking about ${currentTopic}, take a look at this.`,
          `Oh, this reminds me of something. What do you see here?`,
          `Hold on — before I forget, check this out.`,
        ] : [];
        const genericIntros = [
          "Hey — take a look at this for me.",
          "Here's one for you — what do you see?",
          "Oh wait, look at this real quick.",
          "Check this out —",
          "Okay, here's a quick one.",
        ];
        const introPool = topicIntros.length > 0 && Math.random() < 0.4 ? topicIntros : genericIntros;
        const intro = introPool[Math.floor(Math.random() * introPool.length)];
        addMessage({ type: 'ai', text: intro, id: generateId() });
        aiWordsRef.current += countWords(intro);
        
        // Insert the photo inline
        const photoMessageId = generateId();
        addMessage({
          type: 'inline_photo',
          imageUrl: trial.imageUrl,
          target: trial.target,
          id: photoMessageId,
          answered: false,
        });
        
        // Varied follow-up prompt (not always "What is this?")
        const prompts = [
          "What do you see here?",
          "What's this one?",
          "Know what this is?",
          "What is it?",
        ];
        const prompt = intro.includes('what do you see') ? "Go ahead." : prompts[Math.floor(Math.random() * prompts.length)];
        addMessage({ type: 'ai', text: prompt, id: generateId() });
        aiWordsRef.current += countWords(prompt);
        
        // Track the active photo — answer will be checked on next processUserTurn
        activeInlinePhotoRef.current = {
          trial,
          messageId: photoMessageId,
          startTime: Date.now(),
          cueLevel: 0,
        };
        
        aiResponseText = intro;
        setCurrentPhase('user_turn');
        
        orchestratorStateRef.current = updateState(
          orchestratorStateRef.current, stuckType, false
        );
      } else {
        // Fallback to regular chat if no photos available
        aiResponseText = getSmartFallback(undefined, transcript);
        addMessage({ type: 'ai', text: aiResponseText, id: generateId() });
      }
    } else if (action.type === 'inline_minimal_pairs') {
      // ═══════════════════════════════════════════════════════════
      // INLINE MINIMAL PAIRS — Two images in chat, user taps one
      // Maya says a word, user picks the matching picture
      // ═══════════════════════════════════════════════════════════
      pendingVisualActionRef.current = true; // Gate: allow visual transition language
      // FIX: Use strategy's target phonemes to filter trials instead of random selection
      const targetPhonemes = activeStrategyRef.current?.id === 'phonological_training'
        ? (orchestratorStateRef.current.intelligenceBiases?.targetPhonemes ?? [])
        : [];
      const allTrials = targetPhonemes.length > 0
        ? getMinimalPairTrialsForLevel(action.difficulty === 'easy' ? 1 : 4, 20, { focusPhonemes: targetPhonemes })
        : getMinimalPairTrials();
      const maxDiff = action.difficulty === 'easy' ? 1 : 2;
      const eligible = allTrials.filter(t => t.pair.difficulty <= maxDiff);
      const trial = eligible.length > 0 
        ? eligible[Math.floor(Math.random() * eligible.length)]
        : allTrials[Math.floor(Math.random() * allTrials.length)];
      
      if (trial) {
        const currentTopic = orchestratorStateRef.current.currentTopic;
        const intros = currentTopic ? [
          `Hey — let's try something quick while we're talking about ${currentTopic}.`,
          `Here's a fun one for you.`,
          `Let me test your ears for a second.`,
        ] : [
          "Okay, here's a quick listening one.",
          "Let me try something different — listen carefully.",
          "Here's a fun one for your ears.",
        ];
        const intro = intros[Math.floor(Math.random() * intros.length)];
        addMessage({ type: 'ai', text: intro, id: generateId() });
        aiWordsRef.current += countWords(intro);
        
        const pairMessageId = generateId();
        addMessage({
          type: 'inline_minimal_pair',
          image1Url: trial.trial1.imageUrl,
          image2Url: trial.trial2.imageUrl,
          word1: trial.pair.word1,
          word2: trial.pair.word2,
          targetIndex: trial.targetIndex,
          id: pairMessageId,
          answered: false,
          selectedIndex: null,
          wasCorrect: null,
        });
        
        const prompt = `I'm going to say a word: "${trial.targetWord}." Which picture matches?`;
        addMessage({ type: 'ai', text: prompt, id: generateId() });
        aiWordsRef.current += countWords(prompt);
        
        activeInlineMinimalPairRef.current = {
          trial,
          messageId: pairMessageId,
          startTime: Date.now(),
        };
        
        aiResponseText = intro;
        setCurrentPhase('user_turn');
        
        orchestratorStateRef.current = updateState(
          orchestratorStateRef.current, stuckType, false
        );
      } else {
        aiResponseText = getSmartFallback(undefined, transcript);
        addMessage({ type: 'ai', text: aiResponseText, id: generateId() });
      }
    } else if (action.type === 'suggest_scenario') {
      // ═══════════════════════════════════════════════════════════
      // REAL-WORLD SCENARIO — Suggest a functional roleplay
      // ═══════════════════════════════════════════════════════════
      const scenarioIntros = [
        "Hey — you're doing great. Want to try something real-world?",
        "You know what? Let's practice something you'd actually use.",
        "I've got a fun challenge — want to try a real-life scenario?",
        "You're flowing really well. Want to test that in a real situation?",
      ];
      const intro = scenarioIntros[Math.floor(Math.random() * scenarioIntros.length)];
      addMessage({ type: 'ai', text: intro, id: generateId() });
      aiWordsRef.current += countWords(intro);
      aiResponseText = intro;
      
      // Insert scenario card
      addMessage({
        type: 'scenario',
        scenarioId: action.scenarioId,
        id: generateId(),
        completed: false,
      });
      
      // Update state
      orchestratorStateRef.current = {
        ...orchestratorStateRef.current,
        scenariosOfferedThisSession: orchestratorStateRef.current.scenariosOfferedThisSession + 1,
      };
      orchestratorStateRef.current = updateState(
        orchestratorStateRef.current, stuckType, true
      );
    } else if (action.type === 'insert_card') {
      pendingVisualActionRef.current = true; // Gate: allow card transition language
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
      
      // FLOW ENGINE: Use context-aware bridge instead of canned intro
      const intro = generateContextBridge(
        {
          phase: orchestratorStateRef.current.sessionPhase === 'warmup' ? 'warmup' : 'explore',
          turnCount: orchestratorStateRef.current.turnNumber,
          turnsSinceLastProbe: orchestratorStateRef.current.turnsSinceLastCard,
          turnsOnCurrentTopic: orchestratorStateRef.current.turnsOnCurrentTopic,
          consecutiveStruggles: 0,
          consecutiveFlowTurns: 0,
          fatigueLevel: orchestratorStateRef.current.fatigueState,
          lastActionType: 'conversation',
          probeCountThisSession: orchestratorStateRef.current.cardsInsertedThisSession,
          conversationTurnsBeforeFirstProbe: 0,
          currentTopic: topic,
          lastUserTranscript: transcript,
        },
        stuckType,
        action.cardType,
        topic,
      );
      addMessage({ type: 'ai', text: intro, id: generateId() });
      aiWordsRef.current += countWords(intro);
      aiResponseText = intro;
      
      // Store card as pending — ConversationCoachGame will handle insertion
      // and mode transition to card_listening atomically after TTS completes
      pendingCardTypeRef.current = action.cardType;
      pendingCardDifficultyRef.current = action.config.difficulty;
      setHasPendingCard(true);
      console.log('[CoachSession] Card queued as pending:', action.cardType, '— Game component will insert + switch to card_listening');
      
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

        // Build anchor context for mandatory context anchoring
        const anchorCtx = buildAnchorContext(transcript, {
          circumlocutionDetected: analysis.circumlocutionDetected,
          completionConfidence: analysis.completionConfidence,
        });

        // Build hallucination guard allowlist from conversation context
        const entityAllowlist = buildEntityAllowlist(
          transcript,
          conversationHistory,
          rollingMemoryRef.current,
          activeInlinePhotoRef.current ? { targets: [activeInlinePhotoRef.current.trial.target] } : null,
        );
        const hallucinationGuardBlock = getHallucinationGuardPromptBlock(entityAllowlist);

        // Determine therapeutic response level (TRL)
        const trlResult = determineResponseLevel({
          fluencyScore: analysis.fluencyScore,
          effortfulSpeech: analysis.effortfulSpeech,
          circumlocutionDetected: analysis.circumlocutionDetected,
          completionConfidence: analysis.completionConfidence,
          wordCount: analysis.wordCount,
          consecutiveStruggles: trlTrackerRef.current.consecutiveStruggles,
          consecutiveSuccesses: trlTrackerRef.current.consecutiveSuccesses,
          frustrationLevel: currentEngagement?.frustration === 'high' ? 'high'
            : currentEngagement?.frustration === 'medium' ? 'medium' : 'none',
          fatigueLevel: currentEngagement?.fatigue === 'high' ? 'high'
            : currentEngagement?.fatigue === 'medium' ? 'medium' : 'none',
          turnNumber: orchestratorStateRef.current.turnNumber,
        });

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
            // In-conversation circumlocution detection — tell AI to help find the word
            circumlocutionDetected: analysis.circumlocutionDetected,
            // Difficulty narration to prepend
            difficultyNarration,
            // SESSION INTELLIGENCE: Within-session memory for Maya
            sessionIntelligence: sessionIntelRef.current.formatForPrompt() || undefined,
            // Prior session memory for continuity
            // Maya intelligence context for continuity
            priorSessionMemory: mayaState
              ? formatMayaStateForCoachPrompt(mayaState)
              : fallbackSummary
                ? `PRIOR SESSION: ${fallbackSummary.maya_summary || 'No summary'}`
                : undefined,
            // Rolling semantic memory from previous turns
            rollingMemory: rollingMemoryRef.current || undefined,
            // Cross-session patient intelligence for longitudinal awareness
            crossSessionIntelligence: patientIntelligence
              ? formatPatientIntelligenceForPrompt(patientIntelligence)
              : undefined,
            // Therapy strategy context for goal-driven behavior
            therapyStrategy: activeStrategyRef.current
              ? formatStrategyForPrompt(activeStrategyRef.current)
              : undefined,
            // Therapy intent for purposeful conversation
            therapyIntent: action.type === 'chat_followup' && 'therapyIntent' in action
              ? (action as any).therapyIntent
              : undefined,
            // Anchor context for mandatory context anchoring
            anchorContext: anchorCtx,
            // Therapeutic Response Ladder
            therapeuticLevel: {
              level: trlResult.level,
              label: trlResult.label,
              promptBlock: trlResult.promptBlock,
              anchorUsageType: trlResult.anchorUsageType,
            },
            // Hallucination guard — entity allowlist
            hallucinationGuard: {
              promptBlock: hallucinationGuardBlock,
              allowedEntities: [...entityAllowlist.all].slice(0, 20),
            },
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
          
          // Store AI-generated conversation memory for next turn
          if (data.memoryUpdate) {
            rollingMemoryRef.current = data.memoryUpdate;
          }
          
          // Track anchor metrics for session-level analytics
          if (data.anchorMetrics) {
            anchorMetricsRef.current.push(data.anchorMetrics as AnchorMetrics);
          }
          
          // Track TRL level for session analytics
          const wasStruggle = analysis.wordCount <= 2 || (analysis.effortfulSpeech && analysis.fluencyScore < 50) || trlResult.level >= 3;
          trlTrackerRef.current.recordTurn(trlResult.level, trlResult.anchorUsageType, wasStruggle);
          
          // Track repair attempts
          repairTrackerRef.current.recordAnchorUsage(trlResult.anchorUsageType);
          if (RepairSuccessTracker.isRepairAttempt(cueRec.cueLevel, analysis.effortfulSpeech, wordCount)) {
            repairTrackerRef.current.recordRepairAttempt({
              turnNumber: orchestratorStateRef.current.turnNumber,
              trlLevel: trlResult.level,
              cueType: cueRec.cueLevel >= 3 ? 'phonemic' : cueRec.cueLevel >= 2 ? 'semantic' : null,
              wasSuccessful: RepairSuccessTracker.wasRepairSuccessful(wordCount),
              wordCountBefore: wordCount,
              wordCountAfter: wordCount, // will be updated on next turn
              latencyMs: latencyMs,
            });
          }
          
          // TRL Game Triggers — launch mini-games when levels persist
          // SESSION PHASE: Only allow game triggers when phase permits
          const phaseBiases = getPhaseBiases(sessionPhaseStateRef.current);
          const { result: gameTrigger, newState: newTriggerState } = evaluateGameTrigger(
            gameTriggerStateRef.current,
            trlResult.level,
            orchestratorStateRef.current.turnNumber,
            trlTrackerRef.current.consecutiveStruggles,
          );
          gameTriggerStateRef.current = newTriggerState;
          
          let gameTriggerFired = false;
          const isEmergencyTrigger = gameTrigger.reason?.includes('emergency');
          if (gameTrigger.trigger && gameTrigger.slug && (phaseBiases.allowGameTrigger || isEmergencyTrigger)) {
            const popup = triggerToPopupExercise(gameTrigger);
            if (popup) {
              gameTriggerFired = true;
              console.log('[trl-game-trigger]', gameTrigger.trigger, '→', gameTrigger.slug, '|', gameTrigger.reason);
              
              // Use contextual game intro instead of generic popup intro
              const gameIntro = generateGameIntro({
                currentTopic: orchestratorStateRef.current.currentTopic,
                triggerType: gameTrigger.trigger,
                gameSlug: gameTrigger.slug,
                userLastWords: transcript.slice(0, 50),
                trlLevel: trlResult.level,
              });
              
              // Replace AI response with the game intro
              aiResponseText = gameIntro;
              
              setPendingPopupExercise({
                slug: popup.slug,
                reason: popup.reason,
                difficultyHint: popup.difficultyHint,
              });
            }
          }
          
          // SESSION PHASE: Evaluate phase transition
          const phaseTransition = evaluatePhaseTransition(
            sessionPhaseStateRef.current,
            {
              fluencyScore: analysis.fluencyScore,
              effortfulSpeech: analysis.effortfulSpeech,
              wordCount,
              consecutiveSuccesses: trlTrackerRef.current.consecutiveSuccesses,
              consecutiveStruggles: trlTrackerRef.current.consecutiveStruggles,
              gameTriggerFired,
              gameJustCompleted: false,
            }
          );
          sessionPhaseStateRef.current = applyPhaseTransition(
            sessionPhaseStateRef.current,
            phaseTransition,
            analysis.fluencyScore,
          );
          if (phaseTransition.transitioned) {
            console.log('[session-phase]', phaseTransition.newPhase, '|', phaseTransition.reason);
          }
          
          // MICRO-FEEDBACK: Check if we should surface a progress moment
          const wasRepairSuccessful = RepairSuccessTracker.isRepairAttempt(cueRec.cueLevel, analysis.effortfulSpeech, wordCount) 
            && RepairSuccessTracker.wasRepairSuccessful(wordCount);
          const { tracker: updatedFeedbackTracker, feedback: microFeedback } = recordTurnForFeedback(
            feedbackTrackerRef.current,
            {
              turnNumber: orchestratorStateRef.current.turnNumber,
              latencyMs: latencyMs,
              wordCount,
              cueLevel: cueRec.cueLevel,
              fluencyScore: analysis.fluencyScore,
              wasRepairSuccessful,
              gameJustCompleted: false,
            }
          );
          feedbackTrackerRef.current = updatedFeedbackTracker;
          
          // Prepend micro-feedback to AI response if earned
          if (microFeedback.text && microFeedback.delivery === 'prepend' && aiResponseText && !gameTriggerFired) {
            aiResponseText = `${microFeedback.text} ${aiResponseText}`;
            console.log('[micro-feedback]', microFeedback.type, '|', microFeedback.text);
          }
          
          // Dead-end recovery — anchor to something the user said
          const deadEnds = ['i see', 'nice.', 'okay.', 'got it.', 'makes sense.', 'tell me more.', 'interesting.'];
          const lowerResponse = aiResponseText.toLowerCase().trim().replace(/[.!]+$/, '');
          if (deadEnds.some(de => lowerResponse === de.replace(/[.!]+$/, ''))) {
            // Extract meaningful word from user's message for anchoring
            const meaningfulFillers = new Set(['the','a','an','i','my','me','you','we','it','is','was','and','but','or','so','to','um','uh','like','just','yeah','yes','no']);
            const userWords = transcript.trim().toLowerCase().split(/\s+/).filter(w => w.length > 2 && !meaningfulFillers.has(w));
            const anchor = userWords.length > 0 ? userWords[userWords.length - 1] : null;
            
            const recoveries = anchor
              ? [
                  `Oh, ${anchor}! What happened with that?`,
                  `Wait — ${anchor}? Tell me about that.`,
                  `Hmm, ${anchor}. And then what?`,
                  `${anchor.charAt(0).toUpperCase() + anchor.slice(1)} — I want to hear more about that.`,
                ]
              : [
                  'Oh interesting — and then what happened?',
                  'Hmm, tell me more about that.',
                  'Ha — and then?',
                ];
            aiResponseText = recoveries[Math.floor(Math.random() * recoveries.length)];
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

      // STRATEGY ENFORCEMENT: Validate AI response against strategy constraints
      if (activeStrategyRef.current && aiResponseText) {
        const speechState: 'struggling' | 'flowing' | 'neutral' = 
          analysis.effortfulSpeech ? 'struggling' :
          analysis.fluencyScore > 60 ? 'flowing' : 'neutral';
        const validation = validateResponse(aiResponseText, activeStrategyRef.current, speechState);
        if (!validation.valid) {
          console.warn('[enforcement] Response violations:', validation.violations);
          if (validation.sanitizedResponse) {
            aiResponseText = validation.sanitizedResponse;
          }
        }
      }

      addMessage({ type: 'ai', text: aiResponseText, id: generateId() });
      aiWordsRef.current += countWords(aiResponseText);
      
      orchestratorStateRef.current = updateState(
        orchestratorStateRef.current,
        stuckType,
        false
      );
      
      // MID-SESSION STRATEGY RE-EVALUATION
      // Check if session signals warrant a strategy switch
      // CRITICAL: Never override a clinician-locked strategy
      if (activeStrategyRef.current && patientIntelligence && !clinicianLockedRef.current) {
        const snapshot = sessionIntelRef.current.getSnapshot();
        const midSignals: MidSessionSignals = {
          successRate: snapshot.successRate,
          totalAttempts: snapshot.totalAttempts,
          circumlocutionCount: snapshot.circumlocutionCount,
          phonemeErrorCount: snapshot.phonemeErrors.length,
          avgLatencyMs: snapshot.avgLatencyMs,
          frustrationDetected: currentEngagement?.frustration === 'high' || currentEngagement?.frustration === 'medium',
        };
        const newStrategy = shouldSwitchStrategy(activeStrategyRef.current, midSignals, patientIntelligence);
        if (newStrategy) {
          activeStrategyRef.current = newStrategy;
          orchestratorStateRef.current = {
            ...orchestratorStateRef.current,
            activeStrategy: newStrategy,
          };
          console.log('[strategy-switch] Mid-session switch to:', newStrategy.id, newStrategy.sessionGoal);
        }
      }
      
      // No automatic wrap-up - user ends when ready
      setCurrentPhase('user_turn');
    }

    // ═══════════════════════════════════════════════════════════════
    // P0 TELEMETRY: Emit structured conversation turn event
    // Fire-and-forget — never blocks the UI response
    // ═══════════════════════════════════════════════════════════════
    if (sessionId) {
      const previousStuckType = orchestratorStateRef.current.lastStuckType;
      const turnOutcome = classifyTurnOutcome(
        wordCount,
        cueRec.cueLevel,
        stuckType,
        analysis.effortfulSpeech,
        previousStuckType,
      );
      
      emitConversationTurnEvent({
        sessionId,
        turnNumber: orchestratorStateRef.current.turnNumber,
        transcript,
        wordCount,
        latencyToFirstWordMs: latencyMs,
        totalDurationMs: totalDurationMs ?? null,
        speechRateWpm: analysis.speechRateWpm ?? null,
        stuckType,
        effortfulSpeech: analysis.effortfulSpeech,
        circumlocutionDetected: analysis.circumlocutionDetected,
        pausePattern: analysis.pausePattern,
        fluencyScore: analysis.fluencyScore,
        filledPauseCount: analysis.filledPauseCount || 0,
        cueLevel: cueRec.cueLevel,
        cueTypeOffered: cueRec.cueLevel >= 3 ? 'phonemic' 
          : cueRec.cueLevel >= 2 ? 'semantic' 
          : null,
        cueAccepted: cueRec.cueLevel > 0 && wordCount >= 2,
        supportLevel: difficultyStateRef.current.supportLevel,
        outcome: turnOutcome,
        pronunciationScore: analysis.pronunciationScore ?? null,
        challengingSounds: analysis.challengingSounds || [],
        asrConfidence: null,
      }).catch(() => {}); // fire-and-forget
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

    // FLOW ENGINE: Use therapist feedback for post-card return
    const outro = getPostCardReturn({
      success: !!cardSuccess,
      cardType: cardType || 'naming',
      userResponse: String(userResponse),
      topic: currentTopic,
      wasQuick: false, // TODO: track from card timing
      wasHardBefore: false, // TODO: track from historical data
    });
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

  // ═══════════════════════════════════════════════════════════════
  // INLINE MINIMAL PAIRS — Handle tap selection
  // ═══════════════════════════════════════════════════════════════
  const handleMinimalPairSelect = useCallback((messageId: string, selectedIndex: 0 | 1) => {
    const pair = activeInlineMinimalPairRef.current;
    if (!pair || pair.messageId !== messageId) return;
    
    const isCorrect = selectedIndex === pair.trial.targetIndex;
    const latency = Date.now() - pair.startTime;
    const wasQuick = latency < 3000;
    
    // SESSION INTELLIGENCE: Record minimal pair attempt
    sessionIntelRef.current.recordMinimalPairAttempt(
      pair.trial.targetWord,
      pair.trial.targetIndex === 0 ? pair.trial.pair.word2 : pair.trial.pair.word1,
      isCorrect,
      latency,
      orchestratorStateRef.current.turnNumber,
      pair.trial.pair.phoneme1,
      pair.trial.pair.phoneme2,
    );
    
    // Update the message to show result
    setMessages(prev => prev.map(msg => 
      msg.id === messageId && msg.type === 'inline_minimal_pair'
        ? { ...msg, answered: true, selectedIndex, wasCorrect: isCorrect }
        : msg
    ));
    
    // Generate natural therapist feedback
    const targetWord = pair.trial.targetWord;
    const otherWord = pair.trial.targetIndex === 0 ? pair.trial.pair.word2 : pair.trial.pair.word1;
    let feedback: string;
    
    if (isCorrect) {
      if (wasQuick) {
        const quickFeedback = [
          `Yes! "${targetWord}" — you heard that right away.`,
          `"${targetWord}" — no hesitation. Nice ear!`,
          `That's it! You caught the difference between "${targetWord}" and "${otherWord}" instantly.`,
        ];
        feedback = quickFeedback[Math.floor(Math.random() * quickFeedback.length)];
      } else {
        const normalFeedback = [
          `Yes, "${targetWord}" — good listening!`,
          `That's right! "${targetWord}" and "${otherWord}" sound similar, but you got it.`,
          `"${targetWord}" — exactly. Those two can be tricky.`,
        ];
        feedback = normalFeedback[Math.floor(Math.random() * normalFeedback.length)];
      }
    } else {
      const wrongFeedback = [
        `Close — that was actually "${targetWord}." "${targetWord}" and "${otherWord}" sound really similar, so that's a tough one.`,
        `Good try! The word was "${targetWord}." The difference between "${pair.trial.pair.phoneme1}" and "${pair.trial.pair.phoneme2}" is subtle.`,
        `Not quite — it was "${targetWord}." Those two are easy to mix up. We'll practice more.`,
      ];
      feedback = wrongFeedback[Math.floor(Math.random() * wrongFeedback.length)];
    }
    
    // Natural continuation
    const topic = orchestratorStateRef.current.currentTopic;
    let continuation = '';
    if (topic) {
      const continuations = [
        ` Anyway — back to ${topic}.`,
        ` So where were we with ${topic}?`,
        ` Okay — you were telling me about ${topic}...`,
      ];
      continuation = continuations[Math.floor(Math.random() * continuations.length)];
    } else {
      const continuations = [
        ' Okay — what else is on your mind?',
        ' Alright, keep going!',
        '',
      ];
      continuation = continuations[Math.floor(Math.random() * continuations.length)];
    }
    
    const fullResponse = feedback + continuation;
    addMessage({ type: 'ai', text: fullResponse, id: generateId() });
    aiWordsRef.current += countWords(fullResponse);
    
    // Update orchestrator
    orchestratorStateRef.current = updateState(
      orchestratorStateRef.current,
      isCorrect ? 'strong_flow' : 'word_search_stall',
      true,
      undefined,
      isCorrect,
      topic || undefined,
    );
    
    activeInlineMinimalPairRef.current = null;
    setPendingAIText(fullResponse);
    setCurrentPhase('user_turn');
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
    activeInlinePhotoRef.current = null; // Reset inline photo
    activeInlineMinimalPairRef.current = null; // Reset inline minimal pair
    rollingMemoryRef.current = ''; // Reset rolling semantic memory
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
    sessionIntelRef.current.reset(); // Reset session intelligence
    latenciesRef.current = [];
    userWordsRef.current = 0;
    aiWordsRef.current = 0;
    cardsCompletedRef.current = 0;
    anchorMetricsRef.current = [];
    trlTrackerRef.current.reset();
    repairTrackerRef.current.reset();
    sessionPhaseStateRef.current = createSessionPhaseState();
    feedbackTrackerRef.current = createFeedbackTracker();
    gameTriggerStateRef.current = createTriggerState();
    pendingCardIdRef.current = null;
    pendingCardTypeRef.current = null;
    engagementMonitorRef.current.reset();
    speechAnalysis.reset();
    analysisHistoryRef.current = [];
    cueStateRef.current = createInitialCueState();
    difficultyStateRef.current = createInitialDifficultyState();
  }, [maxTurns, speechAnalysis]);

  // User-initiated session end — also persists summary + session intelligence
  const endSession = useCallback(() => {
    setIsComplete(true);
    setCurrentPhase('complete');
    
    // Save session summary for cross-session memory
    const sessionMetrics = speechAnalysis.getSessionMetrics();
    
    // Serialize session intelligence snapshot for persistence
    const intelligenceSnapshot = sessionIntelRef.current.getSnapshot();
    const serializedIntelligence = intelligenceSnapshot.totalAttempts > 0
      ? serializeSnapshotForStorage(intelligenceSnapshot)
      : undefined;
    
    // Build conversation transcript from messages for persistence
    const conversationTranscript = messagesRef.current
      .filter(m => m.type === 'ai' || m.type === 'user')
      .map(m => ({
        role: m.type as string,
        text: m.text,
        timestamp: new Date().toISOString(),
      }));

    saveCoachSessionSummary({
      userId,
      profileId,
      sessionId,
      popupResults: popupResultsRef.current,
      turnsCompleted: orchestratorStateRef.current.turnNumber,
      avgFluency: sessionMetrics?.avgFluency,
      fluencyTrend: sessionMetrics?.fluencyTrend,
      primaryDomain: orchestratorStateRef.current.currentTopic || undefined,
      sessionIntelligence: serializedIntelligence as unknown as Record<string, unknown>,
      conversationTranscript,
    });

    // Persist Recovery Lift Score + Anchor Analytics
    if (sessionId) {
      if (sessionMetrics?.recoveryLift) {
        import('@/lib/recoveryLiftScore').then(({ persistRecoveryLift }) => {
          persistRecoveryLift(sessionId, sessionMetrics.recoveryLift!);
        });
        console.log('[session-end] Recovery Lift:', sessionMetrics.recoveryLift.liftScore,
          '(confidence:', sessionMetrics.recoveryLift.confidence + ')');
      }
      
      // Persist anchor analytics summary
      const anchorData = anchorMetricsRef.current;
      if (anchorData.length > 0) {
        const anchorRequired = anchorData.filter(m => m.anchorRequired);
        const anchorPassed = anchorRequired.filter(m => m.anchoringPass);
        const preferredHits = anchorRequired.filter(m => m.matchedAnchor === m.preferredAnchor && m.preferredAnchor !== null);
        const regenerations = anchorData.filter(m => m.regenerationNeeded);
        
        const anchorSummary = {
          total_turns: anchorData.length,
          anchor_required_turns: anchorRequired.length,
          anchor_pass_count: anchorPassed.length,
          anchor_pass_rate: anchorRequired.length > 0 ? Math.round((anchorPassed.length / anchorRequired.length) * 100) : 0,
          preferred_anchor_hits: preferredHits.length,
          preferred_anchor_rate: anchorRequired.length > 0 ? Math.round((preferredHits.length / anchorRequired.length) * 100) : 0,
          regeneration_count: regenerations.length,
          regeneration_rate: anchorData.length > 0 ? Math.round((regenerations.length / anchorData.length) * 100) : 0,
        };
        
        // Add TRL metrics + repair metrics to session summary
        const trlMetrics = trlTrackerRef.current.getMetrics();
        const repairMetrics = repairTrackerRef.current.getMetrics();
        const fullSummary = {
          ...anchorSummary,
          trl_total_turns: trlMetrics.totalTurns,
          trl_guided_rate: trlMetrics.guidedRate,
          trl_avg_level: trlMetrics.avgLevel,
          trl_level_distribution: trlMetrics.levelDistribution,
          trl_anchor_usage: trlMetrics.anchorUsageBreakdown,
          // Repair metrics
          repair_success_rate: repairMetrics.repairSuccessRate,
          repair_total_attempts: repairMetrics.totalAttempts,
          repair_successful: repairMetrics.successfulRepairs,
          repair_by_level: repairMetrics.byLevel,
          repair_by_cue_type: repairMetrics.byCueType,
          repair_first_half_rate: repairMetrics.firstHalfRate,
          repair_second_half_rate: repairMetrics.secondHalfRate,
          repair_progression_delta: repairMetrics.progressionDelta,
        };
        
        // Persist to session summary alongside recovery lift
        supabase.from('sessions').update({
          engagement_summary: fullSummary as any,
        }).eq('id', sessionId).then(() => {});
        
        console.log('[session-end] Anchor Analytics:', anchorSummary);
        console.log('[session-end] TRL Metrics:', { guidedRate: trlMetrics.guidedRate, avgLevel: trlMetrics.avgLevel, dist: trlMetrics.levelDistribution });
      }
    }
    
    console.log('[session-end] Persisted intelligence:', {
      totalAttempts: intelligenceSnapshot.totalAttempts,
      struggledWords: intelligenceSnapshot.struggledWords.length,
      phonemeErrors: intelligenceSnapshot.phonemeErrors.length,
      patterns: intelligenceSnapshot.patterns.length,
    });
  }, [userId, sessionId, speechAnalysis]);

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
    popupResultsRef.current.push(result);
    
    // Update orchestrator state
    orchestratorStateRef.current = updateStateAfterPopup(
      orchestratorStateRef.current,
      result.score >= 0.5,
      result.targetWords
    );

    // SESSION PHASE: Transition to reintegration after game completes
    const phaseTransition = evaluatePhaseTransition(
      sessionPhaseStateRef.current,
      {
        fluencyScore: 50,
        effortfulSpeech: false,
        wordCount: 0,
        consecutiveSuccesses: 0,
        consecutiveStruggles: 0,
        gameTriggerFired: false,
        gameJustCompleted: true,
      }
    );
    sessionPhaseStateRef.current = applyPhaseTransition(sessionPhaseStateRef.current, phaseTransition);
    if (phaseTransition.transitioned) {
      console.log('[session-phase] Post-game:', phaseTransition.newPhase, '|', phaseTransition.reason);
    }

    // GAME TRANSITIONS: Generate contextual return message
    const gameReturnText = generateGameReturn({
      gameSlug: result.slug,
      currentTopic: orchestratorStateRef.current.currentTopic,
      wasSuccessful: result.score >= 0.5,
      score: result.score,
      accuracy: result.accuracy ?? 0,
      successItems: result.targetWords ?? [],
    });

    // POST-GAME: Always use the deterministic game return text that anchors to the original topic.
    // Previously we let the AI override this, but it often generated responses about the game content
    // instead of returning to the conversation topic (e.g., asking about "nature photos" when we were
    // talking about movies). The gameReturnText from generateGameReturn() already handles topic anchoring.
    const followupText = gameReturnText;

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
    activeInlinePhoto: activeInlinePhotoRef.current 
      ? { target: activeInlinePhotoRef.current.trial.target, category: activeInlinePhotoRef.current.trial.category, features: activeInlinePhotoRef.current.trial.features }
      : null,
    activeInlineMinimalPair: activeInlineMinimalPairRef.current
      ? { 
          word1: activeInlineMinimalPairRef.current.trial.pair.word1,
          word2: activeInlineMinimalPairRef.current.trial.pair.word2,
          targetWord: activeInlineMinimalPairRef.current.trial.targetWord,
          targetIndex: activeInlineMinimalPairRef.current.trial.targetIndex,
          phoneme1: activeInlineMinimalPairRef.current.trial.pair.phoneme1,
          phoneme2: activeInlineMinimalPairRef.current.trial.pair.phoneme2,
        }
      : null,
    handleMinimalPairSelect,
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
    addMessage,
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
