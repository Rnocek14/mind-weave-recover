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
import { createArcState, extractGapWords, recordGap, markDrillFired, getPreDrillNarration, getPostDrillBridge, markTransferBridgeAttempted } from '@/lib/smartCoach/sessionArc';
import type { ArcState } from '@/lib/smartCoach/sessionArc';
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
import { scoreTransfer, TRANSFER_LABELS, type TransferTarget, type TransferCheckResult } from '@/lib/smartCoach/transferScoring';
import { getTransferFeedback, type TransferSummaryItem } from '@/lib/smartCoach/transferFeedback';
import { persistTransferCheck } from '@/lib/smartCoach/transferPersistence';
import { loadWordHistory, checkRetention, buildProgressDelta, getRetentionFeedback, buildCueFadeSummary, getRetainedWords, getRetentionDifficultyHint, type WordHistory, type ProgressDelta } from '@/lib/smartCoach/crossSessionRetention';
import { useRecoveryScore } from '@/hooks/useRecoveryScore';
import { useProfile } from '@/hooks/useProfile';

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
  transfer_bridge: 'Using it in real life',
  wrapup: 'Wrapping up',
};

// ─── Phase steps for visual indicator ───────────────────────

const PHASE_STEPS = [
  { key: 'warmup', label: 'Talk', icon: MessageCircle },
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
  // Directive openers: state what we're working on, then jump in
  const openers: Record<string, string[]> = {
    food: [
      "Today we're practicing food words — the kind you'd use ordering a meal. Let's start: what's something you like to eat?",
      "We're working on naming food and putting it into phrases you'd use at a restaurant. What did you have for your last meal?",
    ],
    family: [
      "Today we're working on talking about people — names, relationships, introductions. Who's someone important to you?",
      "We're practicing describing family — the way you'd introduce someone. Tell me about one person in your family.",
    ],
    hobbies: [
      "Today we're practicing talking about activities — naming them, describing them, telling someone what you enjoy. What's something you like to do?",
      "We're working on hobby words and putting them into real sentences. What do you enjoy doing in your free time?",
    ],
    daily_routine: [
      "Today we're working on telling someone about your day — events in order, using time words. What have you been up to today?",
      "We're practicing retelling your routine — the way you'd answer 'how was your day?' Walk me through this morning.",
    ],
    travel: [
      "Today we're practicing place words and descriptions — the kind you'd use telling someone about a trip. Where's somewhere you've been?",
      "We're working on describing places and experiences. What's a place you've visited that you liked?",
    ],
    pets: [
      "Today we're working on describing animals — names, what they do, how you'd tell someone about them. Do you have any pets?",
      "We're practicing animal words and descriptions. Tell me about a pet you know.",
    ],
  };

  const topicOpeners = openers[topic.id] || [`Today we're working on ${topic.label.toLowerCase()} words. Let's start — tell me the first thing that comes to mind.`];
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
  const { activeProfile } = useProfile();
  const recoveryScore = useRecoveryScore(user?.id, activeProfile?.id, { enabled: true });

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
  const [_pendingIntervention, _setPendingIntervention] = useState<InterventionEvent | null>(null); // legacy — kept for type compat only
  const [autoPlayVoice, setAutoPlayVoice] = useState(false);
  const [pendingDrill, setPendingDrill] = useState<DrillSelection | null>(null);
  const [pendingPracticeBlock, setPendingPracticeBlock] = useState<DrillSelection[] | null>(null);
  const [lastDrillTurn, setLastDrillTurn] = useState<number | undefined>(undefined);
  const [justCompletedDrill, setJustCompletedDrill] = useState(false);
  const [usedGameIds, setUsedGameIds] = useState<string[]>([]);
  const [prevAnalysis, setPrevAnalysis] = useState<CoachUtteranceAnalysis | undefined>(undefined);
  const [drillsCompletedThisSession, setDrillsCompletedThisSession] = useState(0);
  const [transferTargets, setTransferTargets] = useState<TransferTarget[]>([]);
  const [pendingTransferCheck, setPendingTransferCheck] = useState(false);
  const [lastDrillSlug, setLastDrillSlug] = useState<string | null>(null);
  const [transferResults, setTransferResults] = useState<TransferSummaryItem[]>([]);
  const [sessionDrillWords, setSessionDrillWords] = useState<Set<string>>(new Set());
  const [wordHistory, setWordHistory] = useState<WordHistory[]>([]);
  const [progressDelta, setProgressDelta] = useState<ProgressDelta | null>(null);
  const [retentionFeedbackGiven, setRetentionFeedbackGiven] = useState<Set<string>>(new Set());
  const [arcState, setArcState] = useState<ArcState>(createArcState());
  const exerciseModal = useExerciseModal();
  const tts = useTextToSpeech();
  const maxTurns = 14; // Full hybrid session arc: chat + drills + transfer + wrapup

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

  // Save session on complete + compute progress delta
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

      // Compute progress delta from word history vs current transfer results
      if (wordHistory.length > 0 && transferResults.length > 0) {
        const delta = buildProgressDelta(
          transferResults.map(r => ({ target: r.target, score: r.score })),
          wordHistory,
        );
        if (delta.narrative) setProgressDelta(delta);
      }
    }
  }, [phase, user?.id, sessionStats, wordHistory, transferResults]);

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
    if (!selectedTopic || !user?.id) return;

    // Generate a stable session UUID for this conversation
    sessionIdRef.current = crypto.randomUUID();

    // Load cross-session word history for retention tracking
    loadWordHistory(user.id).then(history => {
      setWordHistory(history);
      if (import.meta.env.DEV && history.length > 0) {
        console.debug('[SmartCoach] Loaded word history:', history.length, 'words');
      }
    });

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
  }, [selectedTopic, readinessLevel, user?.id]);

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
      // ── Transfer scoring: if we're waiting for a post-drill response, score it ──
      if (pendingTransferCheck && transferTargets.length > 0) {
        const transferResult = scoreTransfer({
          targets: transferTargets,
          userResponse: userText,
          cueLevelNeeded: coachState.supportLevel,
          latencyMs: null, // TODO: wire latency from voice input
          baselineLatencyMs: null,
          breakdownSignals: {
            longPause: false,
            fillerCount: 0,
            restart: false,
            abandonment: userText.trim().length === 0,
          },
          usedAfterModel: false,
        });

        // Get feedback and inject into conversation
        const feedback = getTransferFeedback(transferResult, transferTargets);
        
        // Track for session summary — deduplicate, keep best score per target
        transferTargets.forEach(t => {
          setTransferResults(prev => {
            const key = t.value.toLowerCase();
            const existing = prev.find(r => r.target.toLowerCase() === key);
            if (existing && existing.score >= transferResult.transferScore) return prev;
            const filtered = prev.filter(r => r.target.toLowerCase() !== key);
            return [...filtered, {
              target: t.value,
              label: TRANSFER_LABELS[transferResult.label],
              score: transferResult.transferScore,
            }];
          });
        });

        // Persist transfer check
        if (sessionIdRef.current && lastDrillSlug) {
          persistTransferCheck({
            sessionId: sessionIdRef.current,
            drillSlug: lastDrillSlug,
            targets: transferTargets,
            result: transferResult,
            mayaTransferPrompt: messages[messages.length - 2]?.text || '',
            userResponse: userText,
            turnNumber: turnCount,
          });
        }

        // Add Maya's transfer feedback as a message
        setMessages(prev => [...prev, {
          id: `maya-transfer-${Date.now()}`,
          role: 'maya',
          text: feedback.combined,
          timestamp: Date.now(),
        }]);

        if (autoPlayVoice) {
          tts.speak(feedback.combined).catch(() => {});
        }

        setPendingTransferCheck(false);
        setTransferTargets([]);
        setIsProcessing(false);
        return; // Transfer feedback replaces normal turn processing
      }

      // ── Same-session carryover: check if user spontaneously used drill words ──
      if (sessionDrillWords.size > 0 && !pendingTransferCheck) {
        const lowerText = userText.toLowerCase();
        sessionDrillWords.forEach(word => {
          if (lowerText.includes(word)) {
            setTransferResults(prev => {
              const existing = prev.find(r => r.target.toLowerCase() === word);
              if (existing && existing.score < 4) {
                return prev.map(r => r.target.toLowerCase() === word 
                  ? { ...r, score: 4, label: TRANSFER_LABELS['used_independently'] + ' (carryover)' }
                  : r
                );
              }
              return prev;
            });
          }
        });
      }

      // ── Cross-session retention: check if user uses words from previous sessions ──
      // Instead of injecting a separate message, we store the feedback prefix
      // so it can be blended into the next Maya response.
      let retentionPrefix = '';
      if (wordHistory.length > 0 && !pendingTransferCheck) {
        const retentionChecks = checkRetention(userText, wordHistory);
        const newRetentionWords = retentionChecks.filter(c => !retentionFeedbackGiven.has(c.word.toLowerCase()));
        
        if (newRetentionWords.length > 0) {
          const feedback = getRetentionFeedback(newRetentionWords);
          if (feedback) {
            retentionPrefix = feedback;
            // Mark these words as already acknowledged
            setRetentionFeedbackGiven(prev => {
              const next = new Set(prev);
              newRetentionWords.forEach(c => next.add(c.word.toLowerCase()));
              return next;
            });
            // Update transfer results with cross-session retention
            newRetentionWords.forEach(c => {
              setTransferResults(prev => {
                const key = c.word.toLowerCase();
                const existing = prev.find(r => r.target.toLowerCase() === key);
                if (existing && existing.score >= 4) return prev;
                const filtered = prev.filter(r => r.target.toLowerCase() !== key);
                return [...filtered, {
                  target: c.word,
                  label: 'Remembered from last session',
                  score: 4,
                }];
              });
            });
          }
        }
      }

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
        arcState,
      });

      // ── Arc: extract gaps during assessment phase ──
      if (arcState.phase === 'orient_assess' && selectedTopic) {
        const gaps = extractGapWords(userText, selectedTopic.keywords, result.analysis);
        if (gaps.length > 0) {
          setArcState(prev => recordGap(prev, gaps, turnCount));
        }
      }

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

      // Add Maya's response — blend retention feedback if detected
      const mayaText = retentionPrefix
        ? `${retentionPrefix} ${result.output}`
        : result.output;
      const mayaMsg: ChatMessage = {
        id: `maya-${Date.now()}`,
        role: 'maya',
        text: mayaText,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, mayaMsg]);

      // Auto-play Maya's voice if enabled
      if (autoPlayVoice && result.output) {
        tts.speak(result.output).catch(() => {});
      }

      // Check for drill recommendation — position-based via arc + signal fallback
      const DRILL_COOLDOWN_TURNS = 2;
      const drillOnCooldown = lastDrillTurn !== undefined && (turnCount - lastDrillTurn) < DRILL_COOLDOWN_TURNS;
      
      if (result.drillRecommendation && !drillOnCooldown) {
        const rec = result.drillRecommendation;
        const slotNumber = (rec as any).slotNumber as (1 | 2 | undefined);
        
        // Fatigue gate: skip slot 2 if user is fatigued
        const userFatigued = result.nextState.readinessLevel <= 4 || 
          result.nextState.sessionMetrics.hesitationCount >= 4 ||
          result.nextState.frustrationRisk === 'high';
        const alreadyHadDrill = drillsCompletedThisSession > 0;
        
        if (slotNumber === 2 && alreadyHadDrill && userFatigued) {
          console.log('[SmartCoach] Skipping drill slot 2: fatigue gate');
        } else {
          const retentionHint = getRetentionDifficultyHint(wordHistory);
          
          if (rec.kind === 'micro_drill') {
            const selection = selectDrill({
              state: result.nextState,
              reason: rec.reason as any,
              signals: rec.signals,
              usedGameIds,
              kind: 'micro_drill',
              retentionHint,
            });
            setPendingDrill(selection);
            // Use deterministic narration from arc
            const narration = slotNumber 
              ? getPreDrillNarration(slotNumber, arcState.identifiedGaps, rec.reason || '')
              : rec.observation;
            setMessages(prev => [...prev, {
              id: `drill-offer-${Date.now()}`,
              role: 'maya',
              text: narration,
              timestamp: Date.now(),
            }]);
          } else if (rec.kind === 'targeted_practice') {
            const block = selectPracticeBlock({
              state: result.nextState,
              reason: rec.reason as any,
              signals: rec.signals,
              usedGameIds,
              retentionHint,
            });
            setPendingPracticeBlock(block);
            const narration = slotNumber
              ? getPreDrillNarration(slotNumber, arcState.identifiedGaps, rec.reason || '')
              : "Let's lock in what you practiced with a focused round.";
            setMessages(prev => [...prev, {
              id: `practice-offer-${Date.now()}`,
              role: 'maya',
              text: narration,
              timestamp: Date.now(),
            }]);
          }
        }
      } else if (result.drillRecommendation && drillOnCooldown) {
        console.log('[SmartCoach] Drill recommendation suppressed: cooldown active', {
          drillOnCooldown,
          turnCount,
          lastDrillTurn,
        });
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

  // ─── Legacy intervention handlers removed — drills are sole path now ──

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
    setLastDrillSlug(activeGame.exerciseSlug);

    // Set up transfer targets from actual drill items
    const topicTransfer = selectedTopic.purpose.transferTarget;
    const drillTargets: TransferTarget[] = [];
    
    // PRIORITY 1: Use actual targetWords from the drill result (most precise)
    if (normalized.targetWords && normalized.targetWords.length > 0) {
      normalized.targetWords.slice(0, 3).forEach(word => {
        drillTargets.push({ value: word, type: 'word', functionalContext: topicTransfer });
      });
    }
    
    // PRIORITY 2: Extract quoted words from drill summary (e.g. "broccoli")
    if (drillTargets.length === 0) {
      const quoted = normalized.summary?.match(/"([^"]+)"/g)?.map(w => w.replace(/"/g, ''));
      if (quoted && quoted.length > 0) {
        quoted.slice(0, 3).forEach(word => {
          drillTargets.push({ value: word, type: 'word', functionalContext: topicTransfer });
        });
      }
    }
    
    // PRIORITY 3: Fallback to topic keywords (least precise)
    if (drillTargets.length === 0 && selectedTopic.keywords?.length) {
      selectedTopic.keywords.slice(0, 2).forEach(kw => {
        drillTargets.push({ value: kw, type: 'word', functionalContext: topicTransfer });
      });
    }
    
    if (drillTargets.length > 0) {
      setTransferTargets(drillTargets);
      setPendingTransferCheck(true);
      // Track all drill targets for same-session carryover detection
      setSessionDrillWords(prev => {
        const newWords = new Set(prev);
        drillTargets.forEach(t => newWords.add(t.value.toLowerCase()));
        return newWords;
      });
    }

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
      // Only show "where were we" if the game was NOT completed
      // (handleExerciseComplete already adds a proper return bridge for completed games)
      // The modal's onClose fires for both X-button and completion,
      // but on completion activeGame is already null (set in handleExerciseComplete)
      setMessages(prev => [...prev, {
        id: `maya-return-${Date.now()}`,
        role: 'maya',
        text: "No problem. Let's keep talking — what were you saying?",
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
    _setPendingIntervention(null);
    setPendingDrill(null);
    setPendingPracticeBlock(null);
    setLastDrillTurn(undefined);
    setUsedGameIds([]);
    setPrevAnalysis(undefined);
    setDrillsCompletedThisSession(0);
    setTransferTargets([]);
    setPendingTransferCheck(false);
    setLastDrillSlug(null);
    setTransferResults([]);
    setSessionDrillWords(new Set());
    setWordHistory([]);
    setProgressDelta(null);
    setRetentionFeedbackGiven(new Set());
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
          <h1 className="text-lg font-semibold">Today's Session</h1>
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
              </div>
            </div>

            {/* Session plan — visible structured arc */}
            <div className="bg-card border rounded-2xl p-5 space-y-3">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                Your session plan (~12 min)
              </p>
              <div className="space-y-2.5">
                {[
                  { step: 1, label: 'Talk', desc: 'We\'ll chat about the topic to warm up', icon: MessageCircle, color: 'text-primary' },
                  { step: 2, label: 'Practice', desc: 'Targeted exercises based on what you need', icon: Zap, color: 'text-primary' },
                  { step: 3, label: 'Use it', desc: 'Try using those skills in a real scenario', icon: ArrowRight, color: 'text-primary' },
                  { step: 4, label: 'Review', desc: 'See what you achieved today', icon: CheckCircle2, color: 'text-primary' },
                ].map((s) => (
                  <div key={s.step} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">{s.step}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.label}</p>
                      <p className="text-xs text-muted-foreground">{s.desc}</p>
                    </div>
                  </div>
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
    // Compute completion stats for satisfaction display
    const completionStats = {
      practiced: transferResults.length,
      transferred: transferResults.filter(r => r.score >= 3).length,
      retained: wordHistory.filter(w => w.sessionCount >= 2 && w.bestScore >= 3).length,
    };
    const totalAchievements = completionStats.practiced + completionStats.transferred + completionStats.retained;

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
              {/* Completion header with checkmark */}
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7 text-primary" />
                </div>
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

              {/* Big Win highlight */}
              {(() => {
                const independent = transferResults.find(r => r.score >= 4);
                const retained = wordHistory.find(w => w.sessionCount >= 2 && w.bestScore >= 4);
                const bigWin = independent
                  ? `You used "${independent.target}" on your own today.`
                  : retained
                  ? `"${retained.word}" came back from a previous session.`
                  : null;
                return bigWin ? (
                  <p className="text-sm font-medium text-primary text-center bg-primary/5 rounded-lg py-2 px-3">
                    🏆 {bigWin}
                  </p>
                ) : null;
              })()}

              {/* Quick stats bar — visual hierarchy: retained > transferred > practiced */}
              {totalAchievements > 0 && (
                <div className="flex justify-around py-2 border-y border-border/50">
                  {completionStats.practiced > 0 && (
                    <div className="text-center">
                      <p className="text-lg font-bold text-muted-foreground">{completionStats.practiced}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Practiced</p>
                    </div>
                  )}
                  {completionStats.transferred > 0 && (
                    <div className="text-center">
                      <p className="text-lg font-bold text-primary">{completionStats.transferred}</p>
                      <p className="text-[10px] text-primary/70 uppercase tracking-wide font-medium">Transferred</p>
                    </div>
                  )}
                  {completionStats.retained > 0 && (
                    <div className="text-center">
                      <p className="text-xl font-bold text-primary">{completionStats.retained}</p>
                      <p className="text-[10px] text-primary uppercase tracking-wide font-semibold">Retained</p>
                    </div>
                  )}
                </div>
              )}

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

                  {/* Transfer results — top 3 highlights */}
                  {transferResults.length > 0 && (
                    <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary shrink-0" />
                        <p className="text-xs font-medium text-foreground">What transferred</p>
                      </div>
                      <div className="space-y-1.5 pl-6">
                        {transferResults
                          .sort((a, b) => b.score - a.score)
                          .slice(0, 3)
                          .map((tr, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">"{tr.target}"</span>
                            <span className={cn(
                              'text-xs font-medium',
                              tr.score >= 4 ? 'text-green-600 dark:text-green-400' :
                              tr.score >= 3 ? 'text-primary' :
                              tr.score >= 2 ? 'text-muted-foreground' :
                              'text-muted-foreground/60'
                            )}>
                              {tr.label}
                            </span>
                          </div>
                        ))}
                        {transferResults.length > 3 && (
                          <p className="text-xs text-muted-foreground/60">+{transferResults.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* What stuck from before — capped to 3 words */}
                  {wordHistory.length > 0 && (() => {
                    const retained = getRetainedWords(wordHistory).slice(0, 3);
                    const cueFade = buildCueFadeSummary(wordHistory);
                    if (retained.length === 0 && !cueFade) return null;
                    return (
                      <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                        {retained.length > 0 && (
                          <>
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                              <p className="text-xs font-medium text-foreground">What stuck from before</p>
                            </div>
                            <div className="space-y-1 pl-6">
                              {retained.map((r, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">"{r.word}"</span>
                                  <span className="text-primary font-medium">{r.level} · {r.sessions} sessions</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        {cueFade && (
                          <p className="text-xs text-muted-foreground pl-6 pt-1 border-t border-border/50">
                            {cueFade}
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Progress delta — capped to 2 improved + 2 retained + 1 cue fade */}
                  {progressDelta && progressDelta.narrative && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 space-y-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary shrink-0" />
                        <p className="text-xs font-medium text-primary">Progress since last session</p>
                      </div>
                      <p className="text-sm text-muted-foreground pl-6">{progressDelta.narrative}</p>
                      {progressDelta.improved.length > 0 && (
                        <div className="space-y-1 pl-6">
                          {progressDelta.improved.slice(0, 2).map((item, i) => (
                            <p key={i} className="text-xs text-foreground">
                              "{item.word}": {item.from} → <span className="font-medium text-primary">{item.to}</span>
                            </p>
                          ))}
                        </div>
                      )}
                      {progressDelta.retained.length > 0 && (
                        <p className="text-xs text-muted-foreground pl-6">
                          Still strong: {progressDelta.retained.slice(0, 2).map(r => `"${r.word}"`).join(', ')}
                          {progressDelta.retained.length > 2 ? ` +${progressDelta.retained.length - 2} more` : ''}
                        </p>
                      )}
                      {progressDelta.cueFades.length > 0 && (
                        <div className="space-y-1 pl-6 pt-1 border-t border-border/50">
                          <p className="text-xs font-medium text-foreground">Less support needed</p>
                          {progressDelta.cueFades.slice(0, 1).map((cf, i) => (
                            <p key={i} className="text-xs text-muted-foreground">
                              "{cf.word}": {cf.fromCue} → <span className="font-medium text-primary">{cf.toCue}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recovery Momentum — evidence-tied signal */}
                  {(() => {
                    const independentCount = transferResults.filter(r => r.score >= 4).length;
                    const retainedCount = wordHistory.filter(w => w.sessionCount >= 2 && w.bestScore >= 3).length;
                    const cueFadeCount = wordHistory.filter(w => w.sessionCount >= 2 && w.initialCueLevel > w.bestCueLevel).length;
                    const momentumScore = independentCount + retainedCount + cueFadeCount;
                    if (momentumScore === 0) return null;
                    const momentum = momentumScore >= 5
                      ? { label: 'Building momentum', desc: `You used ${independentCount} word${independentCount !== 1 ? 's' : ''} on your own today — more are coming without help.` }
                      : momentumScore >= 2
                      ? { label: 'Holding steady', desc: `${retainedCount > 0 ? `${retainedCount} word${retainedCount !== 1 ? 's' : ''} stuck from before. ` : ''}You're reinforcing what matters.` }
                      : { label: 'Getting started', desc: 'Every word you practice is building your foundation.' };
                    return (
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <TrendingUp className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-primary">{momentum.label}</p>
                          <p className="text-xs text-muted-foreground">{momentum.desc}</p>
                        </div>
                      </div>
                    );
                  })()}

                  {wrapupSummary.crossSession && !progressDelta?.narrative && (
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

            {/* Recovery Score card */}
            {recoveryScore.score != null && recoveryScore.confidence !== 'insufficient' && (
              <div className="bg-card border rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Recovery Score</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-bold text-foreground">{recoveryScore.score}</span>
                      <span className="text-sm text-muted-foreground">/100</span>
                      {recoveryScore.weeklyDelta != null && recoveryScore.weeklyDelta !== 0 && (
                        <span className={cn(
                          'text-xs font-medium',
                          recoveryScore.weeklyDelta > 0 ? 'text-primary' : 'text-muted-foreground'
                        )}>
                          {recoveryScore.weeklyDelta > 0
                            ? `+${recoveryScore.weeklyDelta} this week`
                            : 'a little more support needed this week — that\'s normal'}
                        </span>
                      )}
                    </div>
                    {/* Contextual interpretation */}
                    {recoveryScore.breakdown && (() => {
                      const bd = recoveryScore.breakdown!;
                      const components = [
                        { label: 'Independence', value: bd.cueIndependence },
                        { label: 'Word mastery', value: bd.wordMastery },
                        { label: 'Accuracy', value: bd.accuracy },
                      ];
                      const best = components.reduce((a, b) => a.value > b.value ? a : b);
                      const interp = recoveryScore.trend === 'improving'
                        ? `${best.label} improved most — you're using more words without help.`
                        : recoveryScore.trend === 'stable'
                        ? `Holding steady while you reinforce what you've practiced.`
                        : recoveryScore.trend === 'declining'
                        ? `Still building — today added more practice than carryover. That's part of the process.`
                        : `Still gathering data — keep practicing and it'll become clearer.`;
                      return <p className="text-xs text-muted-foreground mt-1">{interp}</p>;
                    })()}
                  </div>
                  <div className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center',
                    recoveryScore.trend === 'improving' ? 'bg-primary/10' :
                    recoveryScore.trend === 'stable' ? 'bg-muted' :
                    recoveryScore.trend === 'declining' ? 'bg-destructive/10' : 'bg-muted'
                  )}>
                    <TrendingUp className={cn(
                      'w-5 h-5',
                      recoveryScore.trend === 'improving' ? 'text-primary' :
                      recoveryScore.trend === 'stable' ? 'text-muted-foreground' :
                      recoveryScore.trend === 'declining' ? 'text-destructive rotate-180' : 'text-muted-foreground'
                    )} />
                  </div>
                </div>
                {/* Mini component bars */}
                {recoveryScore.breakdown && (
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { label: 'Accuracy', value: recoveryScore.breakdown.accuracy },
                      { label: 'Independence', value: recoveryScore.breakdown.cueIndependence },
                      { label: 'Word Mastery', value: recoveryScore.breakdown.wordMastery },
                    ] as const).map(comp => (
                      <div key={comp.label} className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-[10px] text-muted-foreground">{comp.label}</span>
                          <span className="text-[10px] font-medium text-foreground">{Math.round(comp.value)}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${Math.min(100, comp.value)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-primary"
                  onClick={() => navigate('/recovery-score')}
                >
                  See full breakdown →
                </Button>
              </div>
            )}

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
              <p className="text-xs text-primary/70 italic">
                {transferResults.length > 0
                  ? `Next time: we'll build longer sentences using today's words.`
                  : `Next time: we'll keep practicing and measure what sticks.`}
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
            <p className="text-[11px] text-muted-foreground mt-1">~12 min · Talk → Practice → Use it → Review</p>
          </div>
        )}

        {messages.map(msg => {
          // Legacy intervention cards — no longer generated but render old ones read-only
          if (msg.role === 'intervention' && msg.interventionData) {
            return (
              <div key={msg.id} className="max-w-[90%] mx-auto my-2">
                <div className="bg-accent/50 border border-accent rounded-xl p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-foreground">{msg.interventionData.observation}</p>
                      <p className="text-xs text-muted-foreground">{msg.interventionData.rationale}</p>
                    </div>
                  </div>
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

        {/* Inline drill card — prescriptive, not optional */}
        {(pendingDrill || pendingPracticeBlock) && (
          <div className="max-w-[90%] mx-auto my-2">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg shrink-0">
                  {(pendingDrill || pendingPracticeBlock?.[0])?.drill.icon}
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    {pendingPracticeBlock ? "Let's lock in what you practiced" : "Let's practice that now"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(pendingDrill || pendingPracticeBlock?.[0])?.drill.label} — {
                      (pendingDrill || pendingPracticeBlock?.[0])?.configOverrides.totalTrials || 5
                    } items, ~{Math.ceil(((pendingDrill || pendingPracticeBlock?.[0])?.drill.durationSec || 60) / 60)} min
                  </p>
                  <p className="text-[11px] text-primary/70 mt-1">
                    {(pendingDrill || pendingPracticeBlock?.[0])?.drill.rationale}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAcceptDrill} className="gap-1.5 text-xs flex-1">
                  <Zap className="w-3.5 h-3.5" />
                  Start practice
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDeclineDrill} className="text-xs text-muted-foreground">
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
        disabled={isProcessing || !!pendingDrill || !!pendingPracticeBlock}
        placeholder={
          (pendingDrill || pendingPracticeBlock) ? "Start the quick practice above..."
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
