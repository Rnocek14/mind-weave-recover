/**
 * Smart Coach — Production Page
 * 
 * Purpose-driven clinical session engine with:
 * - Cross-session progress narrative
 * - Visible intervention loop (observation → rationale → action)
 * - Game trigger overlay
 * - Deficit-aware behavior
 * 
 * Flow: Topic Select → Orientation → Readiness → Conversation → Complete
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, RotateCcw, Heart, MessageCircle, CheckCircle2, Target, Zap, TrendingUp, Brain, Clock, AlertTriangle, Gamepad2, ArrowRight, X, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useAuth } from '@/hooks/useAuth';
import { createInitialCoachState } from '@/lib/smartCoach/coachState';
import { runCoachTurn } from '@/lib/smartCoach/runCoachTurn';
import { getAllTopics, getTopicDefinition } from '@/lib/smartCoach/topicPurposeMap';
import { loadLastSessionSummary, buildProgressComparison, saveSessionSummary } from '@/lib/smartCoach/progressNarrative';
import { GAME_CATALOG } from '@/lib/smartCoach/gameTrigger';
import { adaptExerciseResult } from '@/lib/smartCoach/interventionAdapter';
import { selectDrill, selectPracticeBlock } from '@/lib/smartCoach/drillSelector';
import type { CoachState, CoachMode, CoachTurnResult, SessionMetrics, InterventionEvent, CoachUtteranceAnalysis } from '@/lib/smartCoach/types';
import type { TopicDefinition } from '@/lib/smartCoach/topicPurposeMap';
import type { ProgressComparison } from '@/lib/smartCoach/progressNarrative';
import type { GameDefinition } from '@/lib/smartCoach/gameTrigger';
import type { DrillSelection } from '@/lib/smartCoach/drillSelector';
import type { NormalizedExerciseResult } from '@/lib/normalizedExerciseResult';
import { ExerciseModalHost } from '@/components/coach/ExerciseModalHost';
import { useExerciseModal } from '@/hooks/useExerciseModal';
import { cn } from '@/lib/utils';
import { VoiceInputBar } from '@/components/coach/VoiceInputBar';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { trackVoiceEvent, clearVoiceEvents, getVoiceSessionSummary, persistVoiceSessionSummary } from '@/lib/voiceInteractionTelemetry';

// ─── Chat message type ───────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'maya' | 'intervention';
  text: string;
  timestamp: number;
  /** Intervention metadata */
  interventionData?: InterventionEvent;
}

// ─── User-friendly mode labels ──────────────────────────────

const MODE_LABELS: Record<CoachMode, string> = {
  warmup: 'Warming up',
  expand: 'Building on your words',
  scaffold: 'Helping you find it',
  support: 'Making it easier',
  wrapup: 'Wrapping up',
};

// ─── Phase steps for visual indicator ───────────────────────

const PHASE_STEPS = [
  { key: 'warmup', label: 'Warm up', icon: MessageCircle },
  { key: 'expand', label: 'Practice', icon: Brain },
  { key: 'support', label: 'Drills', icon: Zap },
  { key: 'wrapup', label: 'Review', icon: CheckCircle2 },
];

function getPhaseIndex(mode: CoachMode): number {
  if (mode === 'warmup') return 0;
  if (mode === 'expand') return 1;
  if (mode === 'scaffold' || mode === 'support') return 2;
  return 3;
}

// ─── Openers with purpose framing ──────────────────────────

function buildPurposeOpener(topic: TopicDefinition): string {
  // Gold-standard openers: low pressure, concrete, topic obvious, easy retrieval
  const openers: Record<string, string[]> = {
    food: [
      "Let's start easy — what's something you like to eat?",
      "What did you have for your last meal?",
      "What's your favorite thing to cook or eat?",
    ],
    family: [
      "Let's start simple — who's someone special to you?",
      "Tell me about one person in your family.",
      "Who would you like to tell me about?",
    ],
    hobbies: [
      "Let's start easy — what's something you enjoy doing?",
      "What do you like to do in your free time?",
      "What's a hobby you enjoy?",
    ],
    daily_routine: [
      "Let's start simple — what have you been up to today?",
      "What does a typical morning look like for you?",
      "What did you do when you woke up today?",
    ],
    travel: [
      "Let's start easy — where's somewhere you've visited?",
      "What's your favorite place you've been?",
      "Think of a place you liked visiting — where was it?",
    ],
    pets: [
      "Let's start simple — do you have any pets?",
      "Tell me about a pet you know.",
      "What animals do you like?",
    ],
  };

  const topicOpeners = openers[topic.id] || [`Let's start easy — tell me the first thing that comes to mind about ${topic.label.toLowerCase()}.`];
  return topicOpeners[Math.floor(Math.random() * topicOpeners.length)];
}

// ─── Session tracking ───────────────────────────────────────

interface SessionStats {
  topicLabel: string;
  topicId: string;
  turnCount: number;
  scaffoldUsed: boolean;
  supportUsed: boolean;
  forcedChoiceUsed: boolean;
  sentenceStarterUsed: boolean;
  maxSupportLevel: number;
  metrics: SessionMetrics;
  strategiesUsed: string[];
}

// ─── Strategy name mapping ──────────────────────────────────

const STRATEGY_NAMES: Record<string, string> = {
  semantic_hint: 'Category hints',
  phonemic_hint: 'First-sound cues',
  forced_choice: 'Choice narrowing',
  sentence_starter: 'Sentence starters',
};

// ─── Component ───────────────────────────────────────────────

export default function SmartCoach() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [phase, setPhase] = useState<'topic_select' | 'orientation' | 'readiness' | 'chatting' | 'complete'>('topic_select');
  const [selectedTopic, setSelectedTopic] = useState<TopicDefinition | null>(null);
  const [coachState, setCoachState] = useState<CoachState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [readinessLevel, setReadinessLevel] = useState(7);
  const [progressData, setProgressData] = useState<ProgressComparison | null>(null);
  const [activeGame, setActiveGame] = useState<GameDefinition | null>(null);
  const [pendingIntervention, setPendingIntervention] = useState<InterventionEvent | null>(null);
  const [autoPlayVoice, setAutoPlayVoice] = useState(false);
  const [pendingDrill, setPendingDrill] = useState<DrillSelection | null>(null);
  const [pendingPracticeBlock, setPendingPracticeBlock] = useState<DrillSelection[] | null>(null);
  const [lastDrillTurn, setLastDrillTurn] = useState<number | undefined>(undefined);
  const [justCompletedDrill, setJustCompletedDrill] = useState(false);
  const [usedGameIds, setUsedGameIds] = useState<string[]>([]);
  const [prevAnalysis, setPrevAnalysis] = useState<CoachUtteranceAnalysis | undefined>(undefined);
  const [drillsCompletedThisSession, setDrillsCompletedThisSession] = useState(0);
  const exerciseModal = useExerciseModal();
  const tts = useTextToSpeech();
  const maxTurns = 10; // Extended from 8 for hybrid session

  // Stable session UUID — generated once when conversation starts
  const sessionIdRef = useRef<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const sessionSaved = useRef(false);

  const topics = useMemo(() => getAllTopics(), []);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  // Load cross-session progress on mount
  useEffect(() => {
    if (user?.id) {
      loadLastSessionSummary(user.id).then(lastSession => {
        if (lastSession) {
          // Store for later use when topic is selected
          setProgressData(buildProgressComparison(lastSession, '', undefined));
        }
      });
    }
  }, [user?.id]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // (Voice input bar manages its own focus)

  // Session cleanup on navigation/unload — persist summary if session is active
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (phase === 'chatting' && user?.id && sessionStats && !sessionSaved.current) {
        sessionSaved.current = true;
        const sid = sessionIdRef.current;
        saveSessionSummary(user.id, sid, sessionStats.topicId, sessionStats.metrics, sessionStats.strategiesUsed);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also save on unmount (route change)
      handleBeforeUnload();
    };
  }, [phase, user?.id, sessionStats]);

  // Save session on complete
  useEffect(() => {
    if (phase === 'complete' && user?.id && sessionStats && !sessionSaved.current) {
      sessionSaved.current = true;
      const sid = sessionIdRef.current;
      saveSessionSummary(
        user.id,
        sid,
        sessionStats.topicId,
        sessionStats.metrics,
        sessionStats.strategiesUsed,
      );
      persistVoiceSessionSummary(user.id, sid, sessionStats.topicId);
    }
  }, [phase, user?.id, sessionStats]);

  // ─── Topic select → orientation ────────────────────────────

  const handleTopicSelect = useCallback(async (topic: TopicDefinition) => {
    setSelectedTopic(topic);
    // Rebuild progress comparison with selected topic
    if (user?.id) {
      const lastSession = await loadLastSessionSummary(user.id);
      setProgressData(buildProgressComparison(lastSession, topic.id, undefined));
    }
    setPhase('orientation');
  }, [user?.id]);

  // ─── Orientation → readiness ───────────────────────────────

  const handleStartReadiness = useCallback(() => {
    setPhase('readiness');
  }, []);

  // ─── Readiness → chatting ─────────────────────────────────

  const handleStartConversation = useCallback(() => {
    if (!selectedTopic) return;

    // Generate a stable session UUID for this conversation
    sessionIdRef.current = crypto.randomUUID();

    const opener = buildPurposeOpener(selectedTopic);

    const state = createInitialCoachState({
      topic: selectedTopic.id,
      topicKeywords: selectedTopic.keywords,
      readinessLevel,
    });
    state.conversationHistory = [{ role: 'maya', text: opener }];

    setCoachState(state);
    setPhase('chatting');
    setTurnCount(0);
    sessionSaved.current = false;
    setSessionStats({
      topicLabel: `${selectedTopic.emoji} ${selectedTopic.label}`,
      topicId: selectedTopic.id,
      turnCount: 0,
      scaffoldUsed: false,
      supportUsed: false,
      forcedChoiceUsed: false,
      sentenceStarterUsed: false,
      maxSupportLevel: 0,
      metrics: state.sessionMetrics,
      strategiesUsed: [],
    });

    setMessages([{
      id: 'opener',
      role: 'maya',
      text: opener,
      timestamp: Date.now(),
    }]);
  }, [selectedTopic, readinessLevel]);

  // ─── Send a turn ────────────────────────────────────────────

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || !coachState || isProcessing) return;

    const userText = text.trim();
    setIsProcessing(true);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: userText,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const isReturningFromDrill = justCompletedDrill;
      if (isReturningFromDrill) {
        setJustCompletedDrill(false);
      }

      const result: CoachTurnResult = await runCoachTurn({
        state: coachState,
        userUtterance: userText,
        maxTurns,
        lastSessionContext: progressData?.lastSessionContext ?? undefined,
        lastDrillCompletedAtTurn: lastDrillTurn,
        prevAnalysis,
        returningFromIntervention: isReturningFromDrill,
      });

      // Save analysis for next turn's consecutive detection
      setPrevAnalysis(result.analysis);

      setCoachState(result.nextState);
      setTurnCount(result.nextState.turnCount);

      setSessionStats(prev => prev ? {
        ...prev,
        turnCount: result.nextState.turnCount,
        scaffoldUsed: prev.scaffoldUsed || result.nextState.mode === 'scaffold',
        supportUsed: prev.supportUsed || result.nextState.mode === 'support',
        forcedChoiceUsed: prev.forcedChoiceUsed || result.cueDecision.cueType === 'forced_choice',
        sentenceStarterUsed: prev.sentenceStarterUsed || result.cueDecision.cueType === 'sentence_starter',
        maxSupportLevel: Math.max(prev.maxSupportLevel, result.nextState.supportLevel),
        metrics: result.nextState.sessionMetrics,
        strategiesUsed: result.nextState.sessionMetrics.strategiesThatHelped,
      } : null);

      // Add Maya's response
      const mayaMsg: ChatMessage = {
        id: `maya-${Date.now()}`,
        role: 'maya',
        text: result.output,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, mayaMsg]);

      // Auto-play Maya's voice if enabled
      if (autoPlayVoice && result.output) {
        tts.speak(result.output).catch(() => {});
      }

      // Check for legacy intervention trigger
      if (result.intervention) {
        setPendingIntervention(result.intervention);
        setMessages(prev => [...prev, {
          id: `intervention-${Date.now()}`,
          role: 'intervention',
          text: result.intervention!.observation,
          timestamp: Date.now(),
          interventionData: result.intervention,
        }]);
      }
      // Check for hybrid drill recommendation (takes priority over legacy)
      else if (result.drillRecommendation && !result.intervention) {
        const rec = result.drillRecommendation;
        if (rec.kind === 'micro_drill') {
          const selection = selectDrill({
            state: result.nextState,
            reason: rec.reason as any,
            signals: rec.signals,
            usedGameIds,
            kind: 'micro_drill',
          });
          setPendingDrill(selection);
          setMessages(prev => [...prev, {
            id: `drill-offer-${Date.now()}`,
            role: 'maya',
            text: rec.observation,
            timestamp: Date.now(),
          }]);
        } else if (rec.kind === 'targeted_practice') {
          const block = selectPracticeBlock({
            state: result.nextState,
            reason: rec.reason as any,
            signals: rec.signals,
            usedGameIds,
          });
          setPendingPracticeBlock(block);
          setMessages(prev => [...prev, {
            id: `practice-offer-${Date.now()}`,
            role: 'maya',
            text: "Let's do one more quick practice to lock that in.",
            timestamp: Date.now(),
          }]);
        }
      }

      if (result.nextState.mode === 'wrapup' && !result.drillRecommendation) {
        setPhase('complete');
      }
    } catch (err) {
      console.error('[SmartCoach] Turn failed:', err);
      setMessages(prev => [...prev, {
        id: `maya-err-${Date.now()}`,
        role: 'maya',
        text: "Take your time — I'm right here.",
        timestamp: Date.now(),
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [coachState, isProcessing, maxTurns, progressData, autoPlayVoice, tts, lastDrillTurn, prevAnalysis, usedGameIds]);

  // ─── Drill handlers (hybrid session) ──────────────────────

  const handleAcceptDrill = useCallback(() => {
    const drill = pendingDrill || (pendingPracticeBlock && pendingPracticeBlock[0]);
    if (!drill) return;
    setActiveGame(drill.drill);
    exerciseModal.launchExerciseModal(drill.drill.exerciseSlug, {
      totalTrials: drill.configOverrides.totalTrials,
      difficultyTier: drill.configOverrides.difficultyTier,
      cueLevel: drill.configOverrides.cueLevel,
      source: 'maya_chat',
    });
    setUsedGameIds(prev => [...prev, drill.drill.id]);
    setPendingDrill(null);
    // If practice block, keep remaining drills
    if (pendingPracticeBlock && pendingPracticeBlock.length > 1) {
      setPendingPracticeBlock(pendingPracticeBlock.slice(1));
    } else {
      setPendingPracticeBlock(null);
    }
  }, [pendingDrill, pendingPracticeBlock, exerciseModal]);

  const handleDeclineDrill = useCallback(() => {
    setPendingDrill(null);
    if (pendingPracticeBlock) {
      // Declining targeted practice → go to wrapup
      setPendingPracticeBlock(null);
      setPhase('complete');
    }
    setMessages(prev => [...prev, {
      id: `maya-skip-${Date.now()}`,
      role: 'maya',
      text: "No problem — let's keep going.",
      timestamp: Date.now(),
    }]);
  }, [pendingPracticeBlock]);

  // ─── Intervention handlers ─────────────────────────────────

  const handleAcceptIntervention = useCallback(() => {
    if (!pendingIntervention?.gameId) return;
    const game = GAME_CATALOG[pendingIntervention.gameId];
    if (game) {
      setActiveGame(game);
      // Launch real exercise in modal
      exerciseModal.launchExerciseModal(game.exerciseSlug, {
        totalTrials: game.defaultConfig.totalTrials,
        difficultyTier: game.defaultConfig.difficultyTier,
        cueLevel: game.defaultConfig.cueLevel,
        source: 'maya_chat',
      });
    }
    setPendingIntervention(null);
  }, [pendingIntervention, exerciseModal]);

  const handleDeclineIntervention = useCallback(() => {
    setPendingIntervention(null);
    setMessages(prev => [...prev, {
      id: `maya-decline-${Date.now()}`,
      role: 'maya',
      text: "No problem — let's keep talking.",
      timestamp: Date.now(),
    }]);
  }, []);

  /** Called when a real exercise completes inside ExerciseModalHost */
  const handleExerciseComplete = useCallback((normalized: NormalizedExerciseResult) => {
    if (!activeGame || !selectedTopic) {
      setActiveGame(null);
      return;
    }

    const result = adaptExerciseResult(normalized, activeGame, selectedTopic.id);

    // Track drill completion
    setLastDrillTurn(turnCount);
    setDrillsCompletedThisSession(prev => prev + 1);
    setJustCompletedDrill(true);

    // Set post-intervention dampening on coach state so next turn is gentler
    setCoachState(prev => prev ? { ...prev, postInterventionDampening: true } : prev);

    // Add return-to-conversation message
    setMessages(prev => [...prev, {
      id: `maya-return-${Date.now()}`,
      role: 'maya',
      text: result.returnText,
      timestamp: Date.now(),
    }]);

    // Update session metrics with exercise result
    setSessionStats(prev => prev ? {
      ...prev,
      metrics: {
        ...prev.metrics,
        independentResponses: prev.metrics.independentResponses + (result.success ? 1 : 0),
      },
    } : null);

    setActiveGame(null);

    // If there are more drills in the practice block, prompt next
    if (pendingPracticeBlock && pendingPracticeBlock.length > 0) {
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `maya-next-drill-${Date.now()}`,
          role: 'maya',
          text: "One more quick round — ready?",
          timestamp: Date.now(),
        }]);
      }, 1000);
    } else if (coachState?.mode === 'wrapup' || turnCount >= maxTurns - 1) {
      // Practice block done → complete
      setTimeout(() => setPhase('complete'), 1500);
    }
  }, [activeGame, selectedTopic, turnCount, pendingPracticeBlock, coachState, maxTurns]);

  const handleExerciseModalClose = useCallback(() => {
    exerciseModal.closeExerciseModal();
    if (activeGame) {
      // If closed without completing, add a soft return message
      setMessages(prev => [...prev, {
        id: `maya-return-${Date.now()}`,
        role: 'maya',
        text: "No worries — let's keep talking. Where were we?",
        timestamp: Date.now(),
      }]);
      setActiveGame(null);
    }
  }, [exerciseModal, activeGame]);

  // (handleKeyDown moved into VoiceInputBar)

  const handleNewSession = () => {
    // Log voice telemetry summary before clearing
    const voiceSummary = getVoiceSessionSummary();
    if (voiceSummary.totalTurns > 0) {
      console.log('[SmartCoach] Voice session summary:', voiceSummary);
    }
    clearVoiceEvents();
    sessionIdRef.current = null;
    setMessages([]);
    setCoachState(null);
    setSelectedTopic(null);
    setTurnCount(0);
    setSessionStats(null);
    setReadinessLevel(7);
    setActiveGame(null);
    setPendingIntervention(null);
    setPendingDrill(null);
    setPendingPracticeBlock(null);
    setLastDrillTurn(undefined);
    setUsedGameIds([]);
    setPrevAnalysis(undefined);
    setDrillsCompletedThisSession(0);
    exerciseModal.closeExerciseModal();
  };

  // ─── Derived values ────────────────────────────────────────

  const currentPhaseIndex = coachState ? getPhaseIndex(coachState.mode) : 0;
  const showSupportBadge = coachState && coachState.supportLevel >= 2;

  const topicDisplayName = useMemo(() => {
    if (!selectedTopic) return coachState?.topic || '';
    return selectedTopic.label;
  }, [selectedTopic, coachState]);

  // ─── 3-part wrapup summary ────────────────────────────────

  const wrapupSummary = useMemo(() => {
    if (!sessionStats) return null;
    const m = sessionStats.metrics;

    const improvements: string[] = [];
    if (m.independentResponses > 0) {
      improvements.push(`You gave ${m.independentResponses} response${m.independentResponses > 1 ? 's' : ''} independently`);
    }
    if (m.longestResponse > 0) {
      improvements.push(`Your longest response was ${m.longestResponse} word${m.longestResponse > 1 ? 's' : ''}`);
    }
    if (m.wordsProduced > 0) {
      improvements.push(`You produced ${m.wordsProduced} words total`);
    }
    if (drillsCompletedThisSession > 0) {
      improvements.push(`You completed ${drillsCompletedThisSession} quick practice${drillsCompletedThisSession > 1 ? 's' : ''}`);
    }
    const whatImproved = improvements.length > 0 
      ? improvements[0] + (improvements.length > 1 ? `. ${improvements[1]}.` : '.')
      : 'You practiced retrieving words in conversation.';

    const strategies = sessionStats.strategiesUsed
      .map(s => STRATEGY_NAMES[s])
      .filter(Boolean);
    const whatHelped = strategies.length > 0
      ? `${strategies.join(' and ')} helped you find words.`
      : sessionStats.maxSupportLevel === 0
        ? 'You did this without needing extra support.'
        : 'The guided support helped keep you going.';

    const purposeDef = selectedTopic?.purpose;
    const whatsNext = purposeDef
      ? `Next time, try using these same words when ${purposeDef.transferTarget.split(',')[0]}.`
      : 'Try using these words in a real conversation today.';

    // Cross-session comparison
    const crossSession = progressData?.wrapupComparison 
      ? buildProgressComparison(null, selectedTopic?.id || '', m).wrapupComparison
      : null;

    return { whatImproved, whatHelped, whatsNext, crossSession: progressData?.wrapupComparison };
  }, [sessionStats, selectedTopic, progressData]);

  // ─── Render ────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  // ─── Topic Selection ────────────────────────────────────────

  if (phase === 'topic_select') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="p-4 flex items-center gap-3 border-b">
          <Button variant="ghost" size="icon" onClick={() => navigate('/today')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Smart Coach</h1>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="space-y-3">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Choose your practice focus</h2>
              <p className="text-muted-foreground text-sm">
                Each topic targets specific skills you use in real life.
              </p>
            </div>

            {/* Cross-session progress banner */}
            {progressData?.hasPriorSession && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-left">
                <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Welcome back
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {progressData.orientationText}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {topics.map(topic => (
                <button
                  key={topic.id}
                  onClick={() => handleTopicSelect(topic)}
                  className="p-4 rounded-xl border bg-card hover:bg-accent transition-colors text-left space-y-1.5"
                >
                  <span className="text-base font-medium block">{topic.emoji} {topic.label}</span>
                  <span className="text-xs text-muted-foreground block">{topic.description}</span>
                  <span className="text-[10px] text-primary/70 font-medium block mt-1">
                    {topic.purpose.skillTarget.split(' ').slice(0, 4).join(' ')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Orientation (Purpose Card) ─────────────────────────────

  if (phase === 'orientation' && selectedTopic) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="p-4 flex items-center gap-3 border-b">
          <Button variant="ghost" size="icon" onClick={() => setPhase('topic_select')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Today's Practice</h1>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-5">
            {/* Cross-session context */}
            {progressData?.hasPriorSession && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-1">
                <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Building on progress
                </p>
                <p className="text-xs text-muted-foreground">{progressData.orientationText}</p>
              </div>
            )}

            {/* Purpose card */}
            <div className="bg-card border rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedTopic.emoji}</span>
                <div>
                  <h2 className="text-lg font-semibold">{selectedTopic.label}</h2>
                  <p className="text-xs text-muted-foreground">{selectedTopic.purpose.skillTarget}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <Target className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-foreground">Why this matters</p>
                    <p className="text-xs text-muted-foreground">{selectedTopic.purpose.rationale}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2.5">
                  <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-foreground">Real-world use</p>
                    <p className="text-xs text-muted-foreground capitalize">{selectedTopic.purpose.transferTarget}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <TrendingUp className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-foreground">How we measure</p>
                    <p className="text-xs text-muted-foreground">{selectedTopic.purpose.measure}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Session arc preview */}
            <div className="bg-muted/30 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>~10 minutes</span>
              </div>
              <div className="flex items-center gap-1.5">
                {PHASE_STEPS.map((step, i) => (
                  <React.Fragment key={step.key}>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <step.icon className="w-3 h-3" />
                      <span>{step.label}</span>
                    </div>
                    {i < PHASE_STEPS.length - 1 && (
                      <span className="text-muted-foreground/30">→</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <Button size="lg" className="w-full" onClick={handleStartReadiness}>
              Continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Readiness Check ────────────────────────────────────────

  if (phase === 'readiness') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="p-4 flex items-center gap-3 border-b">
          <Button variant="ghost" size="icon" onClick={() => setPhase('orientation')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Quick Check</h1>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">How are you feeling?</h2>
              <p className="text-sm text-muted-foreground">
                This helps me adjust the pace and support level.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tired</span>
                <span className="font-medium text-lg">{readinessLevel}/10</span>
                <span className="text-muted-foreground">Energized</span>
              </div>
              <Slider
                value={[readinessLevel]}
                onValueChange={([v]) => setReadinessLevel(v)}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground text-center">
                {readinessLevel <= 3
                  ? "We'll keep it short and well-supported today."
                  : readinessLevel <= 6
                  ? "We'll pace things comfortably."
                  : "Great — we can push a little further today."}
              </p>
            </div>

            <Button size="lg" className="w-full" onClick={handleStartConversation}>
              Start practice
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Session Complete (3-Part Summary) ──────────────────────

  if (phase === 'complete') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="p-4 flex items-center gap-3 border-b">
          <Button variant="ghost" size="icon" onClick={() => navigate('/today')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Practice Complete</h1>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-5">
            <div className="bg-card border rounded-2xl p-6 space-y-5">
              <div className="text-center space-y-1">
                <span className="text-3xl">✨</span>
                <h2 className="text-xl font-bold">Session Review</h2>
                <p className="text-xs text-muted-foreground">
                  {selectedTopic?.purpose.skillTarget}
                </p>
                {selectedTopic && (
                  <p className="text-[11px] text-primary/70 mt-1">
                    Real-world use: {selectedTopic.purpose.transferTarget}
                  </p>
                )}
              </div>

              {wrapupSummary && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <TrendingUp className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-foreground">What improved</p>
                      <p className="text-sm text-muted-foreground">{wrapupSummary.whatImproved}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Brain className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-foreground">What helped</p>
                      <p className="text-sm text-muted-foreground">{wrapupSummary.whatHelped}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Target className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-foreground">Try this next</p>
                      <p className="text-sm text-muted-foreground">{wrapupSummary.whatsNext}</p>
                    </div>
                  </div>

                  {/* Cross-session comparison */}
                  {wrapupSummary.crossSession && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                      <TrendingUp className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-primary">Compared to last time</p>
                        <p className="text-sm text-muted-foreground">{wrapupSummary.crossSession}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* See you tomorrow + home practice */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-primary">See you tomorrow 👋</p>
              <p className="text-sm text-foreground">
                {selectedTopic?.id === 'food'
                  ? 'Before your next meal, name 5 items you see on the table. Quick practice — no pressure.'
                  : selectedTopic?.id === 'family'
                  ? 'Next time you see a family member, describe one thing about your day in 2-3 sentences.'
                  : selectedTopic?.id === 'pets'
                  ? 'When you see your pet next, describe out loud what they\'re doing. Practice naming actions.'
                  : 'Pick one moment today and describe it out loud in 2-3 sentences. Quick, no pressure.'}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button size="lg" onClick={() => navigate('/today')} className="w-full gap-2">
                Done for today
              </Button>
              <Button variant="outline" size="lg" onClick={handleNewSession} className="w-full gap-2">
                <RotateCcw className="w-4 h-4" />
                Practice again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Exercise Modal (replaces placeholder game overlay) ────

  // ExerciseModalHost renders as a modal/sheet, no full-page overlay needed

  // ─── Active Chat ────────────────────────────────────────────

  return (
    <div className="h-dvh bg-background flex flex-col">
      {/* Header */}
      <header className="p-3 border-b shrink-0 space-y-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/today')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate">
              {topicDisplayName}
            </h1>
            {coachState && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {MODE_LABELS[coachState.mode]}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {showSupportBadge && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium whitespace-nowrap">
                Extra support on
              </span>
            )}
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {turnCount}/{maxTurns}
            </span>
          </div>
        </div>

        {/* "Now working on" purpose chip + phase steps */}
        <div className="flex items-center justify-between gap-2">
          {coachState && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium truncate max-w-[180px]">
              {coachState.purposeContext.skillTarget.split(' ').slice(0, 5).join(' ')}
            </span>
          )}

          <div className="flex items-center gap-0.5 shrink-0">
            {PHASE_STEPS.map((step, i) => (
              <React.Fragment key={step.key}>
                <div className={cn(
                  'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-colors',
                  i <= currentPhaseIndex
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground/40'
                )}>
                  <step.icon className="w-3 h-3" />
                </div>
                {i < PHASE_STEPS.length - 1 && (
                  <div className={cn(
                    'w-3 h-px',
                    i < currentPhaseIndex ? 'bg-primary/30' : 'bg-border'
                  )} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Inline goal card — visible at session start */}
        {selectedTopic && messages.length <= 2 && (
          <div className="bg-primary/5 border border-primary/15 rounded-xl px-4 py-3 mb-2">
            <p className="text-xs font-medium text-primary flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              Today's goal
            </p>
            <p className="text-sm text-foreground mt-1">
              {selectedTopic.purpose.skillTarget} — like {selectedTopic.purpose.transferTarget}.
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">~10 minutes</p>
          </div>
        )}

        {messages.map(msg => {
          // Intervention card
          if (msg.role === 'intervention' && msg.interventionData) {
            return (
              <div key={msg.id} className="max-w-[90%] mx-auto my-2">
                <div className="bg-accent/50 border border-accent rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-foreground">{msg.interventionData.observation}</p>
                      <p className="text-xs text-muted-foreground">{msg.interventionData.rationale}</p>
                    </div>
                  </div>
                  {pendingIntervention && msg.interventionData.timestamp === pendingIntervention.timestamp && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="default" onClick={handleAcceptIntervention} className="gap-1.5 text-xs">
                        <Gamepad2 className="w-3.5 h-3.5" />
                        Try it
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleDeclineIntervention} className="text-xs">
                        Keep talking
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // Normal chat bubble
          return (
            <div
              key={msg.id}
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'maya'
                  ? 'bg-muted text-foreground self-start mr-auto'
                  : 'bg-primary text-primary-foreground self-end ml-auto'
              )}
            >
              {msg.role === 'maya' && (
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Maya</span>
                   <button
                    onClick={() => {
                      trackVoiceEvent('tts_played', { turnNumber: turnCount });
                      tts.speak(msg.text);
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                    title="Listen to Maya"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {msg.text}
            </div>
          );
        })}

        {/* Inline drill card */}
        {(pendingDrill || pendingPracticeBlock) && (
          <div className="max-w-[90%] mx-auto my-2">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg shrink-0">
                  {(pendingDrill || pendingPracticeBlock?.[0])?.drill.icon}
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    {pendingPracticeBlock ? 'Quick practice round' : 'Quick practice'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(pendingDrill || pendingPracticeBlock?.[0])?.drill.label} — {
                      (pendingDrill || pendingPracticeBlock?.[0])?.configOverrides.totalTrials || 5
                    } items, ~{Math.ceil(((pendingDrill || pendingPracticeBlock?.[0])?.drill.durationSec || 60) / 60)} min
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAcceptDrill} className="gap-1.5 text-xs">
                  <Zap className="w-3.5 h-3.5" />
                  Start
                </Button>
                <Button size="sm" variant="outline" onClick={handleDeclineDrill} className="text-xs">
                  Skip
                </Button>
              </div>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-muted mr-auto">
            <span className="text-xs font-medium text-muted-foreground block mb-1">Maya</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Voice-enabled input bar */}
      <VoiceInputBar
        onSend={handleSend}
        disabled={isProcessing || !!pendingIntervention || !!pendingDrill || !!pendingPracticeBlock}
        placeholder={
          pendingIntervention ? "Accept or decline the suggestion above..." 
          : (pendingDrill || pendingPracticeBlock) ? "Start the quick practice above..."
          : "Type or speak your response..."
        }
        topicKeywords={selectedTopic?.keywords ?? []}
        autoPlayVoice={autoPlayVoice}
        onToggleAutoPlay={() => setAutoPlayVoice(prev => !prev)}
        turnNumber={turnCount}
      />

      {/* Real exercise modal — launched by intervention acceptance */}
      <ExerciseModalHost
        activeExercise={exerciseModal.activeExercise}
        isOpen={exerciseModal.isOpen}
        onClose={handleExerciseModalClose}
        onComplete={handleExerciseComplete}
        userId={user.id}
        sessionId={null}
      />
    </div>
  );
}
