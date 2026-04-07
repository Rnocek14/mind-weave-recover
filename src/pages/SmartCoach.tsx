/**
 * Smart Coach — Games-First, Maya-Orchestrated
 * 
 * Session flow:
 *   Plan → Opener → Game 1 → Review → Transfer → Game 2 → Review → Wrap
 * 
 * Games = Treatment. Maya = Therapist brain.
 * 80% structured game practice, 20% Maya intelligence.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle2, Target, Zap, TrendingUp, Brain, Clock, Gamepad2, ArrowRight, Volume2, RefreshCw, RotateCcw, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useCoachProfile } from '@/hooks/useCoachProfile';
import { useRecoveryScore } from '@/hooks/useRecoveryScore';
import { generateSessionPlan, type SessionPlan } from '@/lib/smartCoach/sessionPlanGenerator';
import { GAME_CATALOG } from '@/lib/smartCoach/gameTrigger';
import { adaptExerciseResult } from '@/lib/smartCoach/interventionAdapter';
import { getPostDrillReview, getPostDrillBridge } from '@/lib/smartCoach/sessionArc';
import { saveSessionSummary } from '@/lib/smartCoach/progressNarrative';
import { scoreTransfer, TRANSFER_LABELS, type TransferTarget, type TransferCheckResult } from '@/lib/smartCoach/transferScoring';
import { getTransferFeedback, type TransferSummaryItem } from '@/lib/smartCoach/transferFeedback';
import { persistTransferCheck } from '@/lib/smartCoach/transferPersistence';
import { loadWordHistory, checkRetention, buildProgressDelta, getRetentionFeedback, getRetainedWords, buildCueFadeSummary, type WordHistory, type ProgressDelta } from '@/lib/smartCoach/crossSessionRetention';
import type { GameDefinition } from '@/lib/smartCoach/gameTrigger';
import type { NormalizedExerciseResult } from '@/lib/normalizedExerciseResult';
import type { SessionMetrics } from '@/lib/smartCoach/types';
import { ExerciseModalHost } from '@/components/coach/ExerciseModalHost';
import { useExerciseModal } from '@/hooks/useExerciseModal';
import { VoiceInputBar } from '@/components/coach/VoiceInputBar';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { cn } from '@/lib/utils';

// ─── Session Phase State Machine ────────────────────────────

type SessionPhase =
  | 'loading'          // Loading profile data
  | 'plan'             // Show today's plan
  | 'opener'           // Maya's opening message
  | 'warmup_chat'      // 1-2 turn warm-up conversation
  | 'game1_setup'      // Maya explains game 1
  | 'game1_playing'    // Game 1 active
  | 'game1_review'     // Maya reviews game 1 results
  | 'transfer_check'   // 1-2 turn transfer conversation
  | 'game2_setup'      // Maya explains game 2
  | 'game2_playing'    // Game 2 active
  | 'game2_review'     // Maya reviews game 2 results
  | 'complete';        // Session summary

interface ChatMessage {
  id: string;
  role: 'user' | 'maya';
  text: string;
  timestamp: number;
}

// ─── Phase progress steps ───────────────────────────────────

const PHASE_STEPS = [
  { key: 'opener', label: 'Warm up', icon: MessageCircle },
  { key: 'game1', label: 'Practice 1', icon: Zap },
  { key: 'transfer', label: 'Use it', icon: ArrowRight },
  { key: 'game2', label: 'Practice 2', icon: Brain },
  { key: 'review', label: 'Review', icon: CheckCircle2 },
];

function getPhaseIndex(phase: SessionPhase): number {
  if (phase === 'opener' || phase === 'warmup_chat') return 0;
  if (phase === 'game1_setup' || phase === 'game1_playing' || phase === 'game1_review') return 1;
  if (phase === 'transfer_check') return 2;
  if (phase === 'game2_setup' || phase === 'game2_playing' || phase === 'game2_review') return 3;
  if (phase === 'complete') return 4;
  return 0;
}

// ─── Component ──────────────────────────────────────────────

export default function SmartCoach() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activeProfile } = useProfile();
  const recoveryScore = useRecoveryScore(user?.id, activeProfile?.id, { enabled: true });
  const coachProfile = useCoachProfile(user?.id);
  const exerciseModal = useExerciseModal();
  const tts = useTextToSpeech();

  // Session state
  const [phase, setPhase] = useState<SessionPhase>('loading');
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [warmupTurnCount, setWarmupTurnCount] = useState(0);
  const [transferTurnCount, setTransferTurnCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoPlayVoice, setAutoPlayVoice] = useState(false);
  
  // Game results
  const [game1Result, setGame1Result] = useState<NormalizedExerciseResult | null>(null);
  const [game2Result, setGame2Result] = useState<NormalizedExerciseResult | null>(null);
  const [activeGame, setActiveGame] = useState<GameDefinition | null>(null);
  const [currentGameSlot, setCurrentGameSlot] = useState<1 | 2>(1);
  
  // Transfer tracking
  const [transferTargets, setTransferTargets] = useState<TransferTarget[]>([]);
  const [transferResults, setTransferResults] = useState<TransferSummaryItem[]>([]);
  const [sessionDrillWords, setSessionDrillWords] = useState<Set<string>>(new Set());
  
  // Cross-session
  const [wordHistory, setWordHistory] = useState<WordHistory[]>([]);
  const [progressDelta, setProgressDelta] = useState<ProgressDelta | null>(null);
  
  // Session tracking
  const sessionIdRef = useRef<string | null>(null);
  const sessionSaved = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Generate plan when profile loads
  useEffect(() => {
    if (coachProfile.loading || !user?.id) return;
    if (plan) return; // Don't regenerate
    
    const newPlan = generateSessionPlan({
      severityProfile: coachProfile.severityProfile,
      primaryDeficit: coachProfile.primaryDeficit,
      strugglingPhonemes: coachProfile.strugglingPhonemes,
      domainScores: coachProfile.domainScores,
      exerciseHistory: coachProfile.exerciseHistory,
      lastSessionGoals: coachProfile.lastSessionGoals,
    });
    
    setPlan(newPlan);
    setPhase('plan');
    sessionIdRef.current = crypto.randomUUID();
    
    // Load word history
    loadWordHistory(user.id).then(setWordHistory);
  }, [coachProfile.loading, user?.id, plan]);

  // Save session on complete
  useEffect(() => {
    if (phase === 'complete' && user?.id && plan && !sessionSaved.current) {
      sessionSaved.current = true;
      const metrics: SessionMetrics = {
        wordsProduced: messages.filter(m => m.role === 'user').reduce((sum, m) => sum + m.text.split(/\s+/).length, 0),
        longestResponse: Math.max(0, ...messages.filter(m => m.role === 'user').map(m => m.text.split(/\s+/).length)),
        hesitationCount: 0,
        independentResponses: messages.filter(m => m.role === 'user').length,
        cueAssistedCount: 0,
        semanticErrorCount: 0,
        phonemicErrorCount: 0,
        comprehensionBreaks: 0,
        strategiesThatHelped: [],
        avgLatencyEstimate: 0,
      };
      saveSessionSummary(
        user.id,
        sessionIdRef.current,
        plan.topic.id,
        metrics,
        [],
      );
    }
  }, [phase, user?.id, plan]);

  // ─── Helpers ──────────────────────────────────────────────

  const addMayaMessage = useCallback((text: string) => {
    const msg: ChatMessage = {
      id: `maya-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: 'maya',
      text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, msg]);
    if (autoPlayVoice) tts.speak(text).catch(() => {});
    return msg;
  }, [autoPlayVoice, tts]);

  const addUserMessage = useCallback((text: string) => {
    const msg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, msg]);
    return msg;
  }, []);

  // ─── Phase: Start Session ─────────────────────────────────

  const handleStartSession = useCallback(() => {
    if (!plan) return;
    sessionSaved.current = false;
    
    // Maya's opener
    addMayaMessage(plan.opener);
    setPhase('opener');
    
    // After a brief pause, ask warm-up question
    setTimeout(() => {
      const warmupQ = buildWarmupQuestion(plan);
      addMayaMessage(warmupQ);
      setPhase('warmup_chat');
    }, 2000);
  }, [plan, addMayaMessage]);

  // ─── Phase: Warm-up Chat (1-2 turns max) ──────────────────

  const handleWarmupResponse = useCallback((text: string) => {
    if (!plan) return;
    addUserMessage(text);
    setWarmupTurnCount(prev => prev + 1);
    
    setIsProcessing(true);
    // Brief acknowledgment, then move to game 1
    setTimeout(() => {
      if (warmupTurnCount >= 1) {
        // After 1-2 turns, transition to game 1
        addMayaMessage(plan.game1Setup);
        setPhase('game1_setup');
      } else {
        // One more warm-up turn
        const followUp = getWarmupFollowUp(text, plan);
        addMayaMessage(followUp);
      }
      setIsProcessing(false);
    }, 1000);
  }, [plan, warmupTurnCount, addUserMessage, addMayaMessage]);

  // ─── Phase: Launch Game ───────────────────────────────────

  const handleLaunchGame = useCallback((slot: 1 | 2) => {
    if (!plan) return;
    const game = slot === 1 ? plan.game1 : plan.game2;
    const trials = slot === 1 ? plan.game1Trials : plan.game2Trials;
    
    setActiveGame(game);
    setCurrentGameSlot(slot);
    setPhase(slot === 1 ? 'game1_playing' : 'game2_playing');
    
    exerciseModal.launchExerciseModal(game.exerciseSlug, {
      totalTrials: trials,
      difficultyTier: game.defaultConfig.difficultyTier,
      cueLevel: game.defaultConfig.cueLevel,
      source: 'maya_chat',
    });
  }, [plan, exerciseModal]);

  // ─── Phase: Game Complete ─────────────────────────────────

  const handleExerciseComplete = useCallback((normalized: NormalizedExerciseResult) => {
    if (!activeGame || !plan) {
      setActiveGame(null);
      return;
    }

    const result = adaptExerciseResult(normalized, activeGame, plan.topic.id);
    const drilledWords = (normalized.targetWords || []).slice(0, 3);
    
    if (currentGameSlot === 1) {
      setGame1Result(normalized);
      
      // Build transfer targets from drill results
      const targets: TransferTarget[] = drilledWords.map(word => ({
        value: word,
        type: 'word' as const,
        functionalContext: plan.topic.purpose.transferTarget,
      }));
      if (targets.length === 0 && plan.topic.keywords.length > 0) {
        targets.push({
          value: plan.topic.keywords[0],
          type: 'word',
          functionalContext: plan.topic.purpose.transferTarget,
        });
      }
      setTransferTargets(targets);
      setSessionDrillWords(prev => {
        const next = new Set(prev);
        drilledWords.forEach(w => next.add(w.toLowerCase()));
        return next;
      });
      
      // Post-game review
      const reviewText = getPostDrillReview(normalized.score, drilledWords, 1);
      addMayaMessage(reviewText);
      setPhase('game1_review');
      
      // After review, prompt transfer
      setTimeout(() => {
        const bridgeText = buildTransferPrompt(drilledWords, plan);
        addMayaMessage(bridgeText);
        setPhase('transfer_check');
      }, 2000);
    } else {
      setGame2Result(normalized);
      
      // Track additional drilled words
      setSessionDrillWords(prev => {
        const next = new Set(prev);
        drilledWords.forEach(w => next.add(w.toLowerCase()));
        return next;
      });
      
      // Post-game 2 review
      const reviewText = getPostDrillReview(normalized.score, drilledWords, 2);
      addMayaMessage(reviewText);
      setPhase('game2_review');
      
      // Compare to game 1 if relevant
      if (game1Result) {
        setTimeout(() => {
          const comparison = buildGameComparison(game1Result, normalized, plan);
          addMayaMessage(comparison);
          // Move to complete
          setTimeout(() => setPhase('complete'), 2000);
        }, 2000);
      } else {
        setTimeout(() => setPhase('complete'), 2500);
      }
    }
    
    setActiveGame(null);
  }, [activeGame, plan, currentGameSlot, game1Result, addMayaMessage]);

  // ─── Phase: Transfer Check (1-2 turns) ────────────────────

  const handleTransferResponse = useCallback((text: string) => {
    if (!plan) return;
    addUserMessage(text);
    setTransferTurnCount(prev => prev + 1);
    
    setIsProcessing(true);
    setTimeout(() => {
      // Score transfer
      if (transferTargets.length > 0) {
        const transferResult = scoreTransfer({
          targets: transferTargets,
          userResponse: text,
          cueLevelNeeded: 0,
          latencyMs: null,
          baselineLatencyMs: null,
          breakdownSignals: {
            longPause: false,
            fillerCount: 0,
            restart: false,
            abandonment: text.trim().length === 0,
          },
          usedAfterModel: false,
        });
        
        const feedback = getTransferFeedback(transferResult, transferTargets);
        
        // Track results
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
        
        addMayaMessage(feedback.combined);
      }
      
      // After transfer, move to game 2
      setTimeout(() => {
        const game2Intro = buildGame2Setup(plan, game1Result);
        addMayaMessage(game2Intro);
        setPhase('game2_setup');
      }, 2000);
      
      setIsProcessing(false);
    }, 1000);
  }, [plan, transferTargets, game1Result, addUserMessage, addMayaMessage]);

  // ─── Handle modal close (without completion) ──────────────

  const handleExerciseModalClose = useCallback(() => {
    exerciseModal.closeExerciseModal();
    if (activeGame) {
      // Game was closed without completing — skip to next phase
      if (currentGameSlot === 1) {
        addMayaMessage("No problem — let's move on.");
        setTimeout(() => {
          const game2Intro = buildGame2Setup(plan!, null);
          addMayaMessage(game2Intro);
          setPhase('game2_setup');
        }, 1500);
      } else {
        addMayaMessage("That's okay. Let's wrap up.");
        setTimeout(() => setPhase('complete'), 1500);
      }
      setActiveGame(null);
    }
  }, [exerciseModal, activeGame, currentGameSlot, plan, addMayaMessage]);

  // ─── Handle send (routes to correct phase handler) ────────

  const handleSend = useCallback((text: string) => {
    if (!text.trim() || isProcessing) return;
    
    if (phase === 'warmup_chat' || phase === 'opener') {
      handleWarmupResponse(text.trim());
    } else if (phase === 'transfer_check') {
      handleTransferResponse(text.trim());
    }
  }, [phase, isProcessing, handleWarmupResponse, handleTransferResponse]);

  // ─── Change focus (regenerate plan with different topic) ──

  const handleChangeFocus = useCallback(() => {
    // Regenerate plan (random factor will pick different topic)
    const newPlan = generateSessionPlan({
      severityProfile: coachProfile.severityProfile,
      primaryDeficit: coachProfile.primaryDeficit,
      strugglingPhonemes: coachProfile.strugglingPhonemes,
      domainScores: coachProfile.domainScores,
      exerciseHistory: coachProfile.exerciseHistory,
      lastSessionGoals: coachProfile.lastSessionGoals,
    });
    setPlan(newPlan);
  }, [coachProfile]);

  // ─── New session ──────────────────────────────────────────

  const handleNewSession = useCallback(() => {
    setPlan(null);
    setPhase('loading');
    setMessages([]);
    setWarmupTurnCount(0);
    setTransferTurnCount(0);
    setGame1Result(null);
    setGame2Result(null);
    setActiveGame(null);
    setTransferTargets([]);
    setTransferResults([]);
    setSessionDrillWords(new Set());
    setProgressDelta(null);
    sessionSaved.current = false;
    sessionIdRef.current = null;
    exerciseModal.closeExerciseModal();
  }, [exerciseModal]);

  // ─── Derived values ───────────────────────────────────────

  const currentPhaseIndex = getPhaseIndex(phase);
  const drillsCompleted = (game1Result ? 1 : 0) + (game2Result ? 1 : 0);

  // ─── Render ───────────────────────────────────────────────

  if (authLoading || phase === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            {coachProfile.loading ? 'Reading your profile...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // ─── Plan Screen (auto-generated) ─────────────────────────

  if (phase === 'plan' && plan) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="p-4 flex items-center gap-3 border-b">
          <Button variant="ghost" size="icon" onClick={() => navigate('/today')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Today's Session</h1>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-5">
            {/* Continuity context */}
            {plan.continuityNote && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-1">
                <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Building on progress
                </p>
                <p className="text-xs text-muted-foreground">{plan.continuityNote}</p>
              </div>
            )}

            {/* Plan card */}
            <div className="bg-card border rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{plan.topic.emoji}</span>
                <div>
                  <h2 className="text-lg font-semibold">{plan.topic.label}</h2>
                  <p className="text-xs text-muted-foreground">{plan.focusDescription}</p>
                </div>
              </div>

              {/* Session structure */}
              <div className="space-y-3 pt-2">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  Session plan (~10 min)
                </p>
                <div className="space-y-2.5">
                  {[
                    { step: 1, label: 'Warm up', desc: 'Quick check-in about the topic', icon: MessageCircle },
                    { step: 2, label: plan.game1.label, desc: `${plan.game1Trials} items — ${plan.game1.rationale.split('—')[0].trim()}`, icon: Zap },
                    { step: 3, label: 'Use it', desc: 'Try using those words in a real sentence', icon: ArrowRight },
                    { step: 4, label: plan.game2.label, desc: `${plan.game2Trials} items — adaptive follow-up`, icon: Brain },
                    { step: 5, label: 'Review', desc: 'See what improved', icon: CheckCircle2 },
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
            </div>

            <div className="flex flex-col gap-2">
              <Button size="lg" className="w-full gap-2" onClick={handleStartSession}>
                <Zap className="w-5 h-5" />
                Start session
              </Button>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1" onClick={handleChangeFocus}>
                <RefreshCw className="w-3 h-3" />
                Change focus
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Session Complete ─────────────────────────────────────

  if (phase === 'complete' && plan) {
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
          <h1 className="text-lg font-semibold">Session Complete</h1>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="w-full max-w-sm mx-auto space-y-5">
            <div className="bg-card border rounded-2xl p-6 space-y-5">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Session Review</h2>
                <p className="text-xs text-muted-foreground">{plan.topic.purpose.skillTarget}</p>
              </div>

              {/* Quick stats */}
              <div className="flex justify-around py-2 border-y border-border/50">
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{drillsCompleted}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Practices</p>
                </div>
                {totalAchievements > 0 && completionStats.transferred > 0 && (
                  <div className="text-center">
                    <p className="text-lg font-bold text-primary">{completionStats.transferred}</p>
                    <p className="text-[10px] text-primary/70 uppercase tracking-wide font-medium">Transferred</p>
                  </div>
                )}
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">
                    {messages.filter(m => m.role === 'user').reduce((sum, m) => sum + m.text.split(/\s+/).length, 0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Words</p>
                </div>
              </div>

              {/* Game results */}
              {game1Result && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <span className="text-lg">{plan.game1.icon}</span>
                  <div>
                    <p className="text-xs font-medium text-foreground">{plan.game1.label}</p>
                    <p className="text-sm text-muted-foreground">
                      Score: {Math.round(game1Result.score * 100)}%
                      {game1Result.targetWords?.length ? ` · ${game1Result.targetWords.slice(0, 3).map(w => `"${w}"`).join(', ')}` : ''}
                    </p>
                  </div>
                </div>
              )}
              {game2Result && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <span className="text-lg">{plan.game2.icon}</span>
                  <div>
                    <p className="text-xs font-medium text-foreground">{plan.game2.label}</p>
                    <p className="text-sm text-muted-foreground">
                      Score: {Math.round(game2Result.score * 100)}%
                      {game2Result.targetWords?.length ? ` · ${game2Result.targetWords.slice(0, 3).map(w => `"${w}"`).join(', ')}` : ''}
                    </p>
                  </div>
                </div>
              )}

              {/* Transfer results */}
              {transferResults.length > 0 && (
                <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-primary shrink-0" />
                    <p className="text-xs font-medium text-foreground">Transfer check</p>
                  </div>
                  <div className="space-y-1.5 pl-6">
                    {transferResults.slice(0, 3).map((tr, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">"{tr.target}"</span>
                        <span className={cn(
                          'text-xs font-medium',
                          tr.score >= 4 ? 'text-green-600 dark:text-green-400' :
                          tr.score >= 3 ? 'text-primary' : 'text-muted-foreground'
                        )}>
                          {tr.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Try this next */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Target className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Try this next</p>
                  <p className="text-sm text-muted-foreground">
                    {plan.topic.purpose.transferTarget.charAt(0).toUpperCase() + plan.topic.purpose.transferTarget.slice(1)} — use the words you practiced today.
                  </p>
                </div>
              </div>
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
                    </div>
                  </div>
                  <div className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center',
                    recoveryScore.trend === 'improving' ? 'bg-primary/10' : 'bg-muted'
                  )}>
                    <TrendingUp className={cn(
                      'w-5 h-5',
                      recoveryScore.trend === 'improving' ? 'text-primary' :
                      recoveryScore.trend === 'declining' ? 'text-destructive rotate-180' : 'text-muted-foreground'
                    )} />
                  </div>
                </div>
              </div>
            )}

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

  // ─── Active Session (all interactive phases) ──────────────

  // Determine if input should be enabled
  const inputEnabled = (phase === 'warmup_chat' || phase === 'opener' || phase === 'transfer_check') && !isProcessing;
  
  // Determine if a game launch button should show
  const showGameLaunch = phase === 'game1_setup' || phase === 'game2_setup';
  const gameLaunchSlot = phase === 'game1_setup' ? 1 : 2;

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
              {plan?.topic.emoji} {plan?.topic.label}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {phase === 'warmup_chat' || phase === 'opener' ? 'Warming up' :
               phase === 'game1_setup' || phase === 'game1_playing' ? `Practice: ${plan?.game1.label}` :
               phase === 'game1_review' ? 'Reviewing practice' :
               phase === 'transfer_check' ? 'Using it in context' :
               phase === 'game2_setup' || phase === 'game2_playing' ? `Practice: ${plan?.game2.label}` :
               phase === 'game2_review' ? 'Final review' : 'Session'}
            </p>
          </div>
        </div>

        {/* Phase progress */}
        <div className="flex items-center gap-0.5">
          {PHASE_STEPS.map((step, i) => (
            <React.Fragment key={step.key}>
              <div className={cn(
                'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-colors',
                i <= currentPhaseIndex
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground/40'
              )}>
                <step.icon className="w-3 h-3" />
                <span className="hidden sm:inline">{step.label}</span>
              </div>
              {i < PHASE_STEPS.length - 1 && (
                <div className={cn(
                  'w-3 h-px flex-shrink-0',
                  i < currentPhaseIndex ? 'bg-primary/30' : 'bg-border'
                )} />
              )}
            </React.Fragment>
          ))}
        </div>
      </header>

      {/* Chat + game area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Today's goal card */}
        {plan && messages.length <= 3 && (
          <div className="bg-primary/5 border border-primary/15 rounded-xl px-4 py-3 mb-2">
            <p className="text-xs font-medium text-primary flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              Today's goal
            </p>
            <p className="text-sm text-foreground mt-1">{plan.focusDescription}</p>
          </div>
        )}

        {/* Messages */}
        {messages.map(msg => (
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
                  onClick={() => tts.speak(msg.text)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                  title="Listen to Maya"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {msg.text}
          </div>
        ))}

        {/* Game launch card */}
        {showGameLaunch && plan && (
          <div className="max-w-[90%] mx-auto my-2">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg shrink-0">
                  {gameLaunchSlot === 1 ? plan.game1.icon : plan.game2.icon}
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    {gameLaunchSlot === 1 ? plan.game1.label : plan.game2.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {gameLaunchSlot === 1 ? plan.game1Trials : plan.game2Trials} items · ~{Math.ceil(((gameLaunchSlot === 1 ? plan.game1 : plan.game2).durationSec) / 60)} min
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={() => handleLaunchGame(gameLaunchSlot as 1 | 2)} className="gap-1.5 text-xs w-full">
                <Zap className="w-3.5 h-3.5" />
                Start practice
              </Button>
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

      {/* Input bar */}
      <VoiceInputBar
        onSend={handleSend}
        disabled={!inputEnabled}
        placeholder={
          phase === 'transfer_check' 
            ? "Use those words in a sentence..."
            : phase === 'game1_setup' || phase === 'game2_setup'
            ? "Tap 'Start practice' above..."
            : "Type or speak your response..."
        }
        topicKeywords={plan?.topic.keywords ?? []}
        autoPlayVoice={autoPlayVoice}
        onToggleAutoPlay={() => setAutoPlayVoice(prev => !prev)}
        turnNumber={warmupTurnCount + transferTurnCount}
      />

      {/* Exercise modal */}
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

// ─── Helper Functions ───────────────────────────────────────

function buildWarmupQuestion(plan: SessionPlan): string {
  const topicQuestions: Record<string, string[]> = {
    food: [
      "Before we practice — what's something you ate recently that you enjoyed?",
      "Quick warm-up — what's your favorite thing to cook or eat?",
    ],
    family: [
      "Before we start — tell me about one person in your family.",
      "Quick warm-up — who did you see or talk to recently?",
    ],
    hobbies: [
      "Before we start — what's something you enjoy doing?",
      "Quick warm-up — what did you do for fun recently?",
    ],
    daily_routine: [
      "Before we start — walk me through what you did this morning.",
      "Quick warm-up — what does a typical morning look like for you?",
    ],
    travel: [
      "Before we start — what's a place you've been that you liked?",
      "Quick warm-up — where would you go if you could travel anywhere?",
    ],
    pets: [
      "Before we start — do you have a pet? Tell me about them.",
      "Quick warm-up — what's your favorite animal?",
    ],
  };

  const questions = topicQuestions[plan.topic.id] || ["Tell me something about yourself to warm up."];
  return questions[Math.floor(Math.random() * questions.length)];
}

function getWarmupFollowUp(userResponse: string, plan: SessionPlan): string {
  // Short acknowledgment + transition
  const transitions = [
    `Good — that's exactly the kind of thing we'll practice. ${plan.game1Setup}`,
    `Nice. Let's build on that. ${plan.game1Setup}`,
    `Great start. Now let's do some focused practice. ${plan.game1Setup}`,
  ];
  return transitions[Math.floor(Math.random() * transitions.length)];
}

function buildTransferPrompt(drilledWords: string[], plan: SessionPlan): string {
  if (drilledWords.length > 0) {
    const word = drilledWords[0];
    const context = plan.topic.purpose.transferTarget.split(',')[0].trim();
    return `Now try using "${word}" in a real sentence — like you would when ${context}.`;
  }
  return `Now tell me — how would you use what you just practiced in real life?`;
}

function buildGame2Setup(plan: SessionPlan, game1Result: NormalizedExerciseResult | null): string {
  if (game1Result && game1Result.score < 0.5) {
    return `Let's try a different approach to strengthen those words. ${plan.game2.rationale.split('—')[0].trim()}.`;
  }
  if (game1Result && game1Result.score >= 0.8) {
    return `You did well on that — let's push further. ${plan.game2.rationale.split('—')[0].trim()}.`;
  }
  return `One more practice round. ${plan.game2.rationale.split('—')[0].trim()}.`;
}

function buildGameComparison(
  game1: NormalizedExerciseResult,
  game2: NormalizedExerciseResult,
  plan: SessionPlan,
): string {
  const score1 = Math.round(game1.score * 100);
  const score2 = Math.round(game2.score * 100);
  
  if (score2 > score1 + 10) {
    return `Good improvement — you went from ${score1}% to ${score2}%. The words are coming faster now.`;
  }
  if (score2 >= score1 - 5) {
    return `Consistent performance at ${score2}%. You're building solid retrieval.`;
  }
  return `That second round was harder, but that's normal — you're pushing into new territory.`;
}
