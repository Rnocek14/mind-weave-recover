/**
 * Smart Coach — Continuous Therapy Canvas
 * 
 * Architecture: Adaptive Session (body) + Smart Coach Intelligence (brain) + Maya (presence)
 * 
 * NO chat UI. NO modals. Full-screen card flow with LessonFlow-style exercise navigation.
 * Maya narrates between games. Games are full-page, identical to adaptive sessions.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle2, Target, Zap, TrendingUp, Brain, Clock, ArrowRight, RefreshCw, RotateCcw, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useCoachProfile } from '@/hooks/useCoachProfile';
import { useRecoveryScore } from '@/hooks/useRecoveryScore';
import { generateSessionPlan, selectReactiveGame2, type SessionPlan } from '@/lib/smartCoach/sessionPlanGenerator';
import { GAME_CATALOG } from '@/lib/smartCoach/gameTrigger';
import { adaptExerciseResult } from '@/lib/smartCoach/interventionAdapter';
import { getPostDrillReview } from '@/lib/smartCoach/sessionArc';
import { saveSessionSummary } from '@/lib/smartCoach/progressNarrative';
import { scoreTransfer, TRANSFER_LABELS, type TransferTarget, type TransferCheckResult } from '@/lib/smartCoach/transferScoring';
import { getTransferFeedback, type TransferSummaryItem } from '@/lib/smartCoach/transferFeedback';
import { loadWordHistory, type WordHistory, type ProgressDelta } from '@/lib/smartCoach/crossSessionRetention';
import type { GameDefinition } from '@/lib/smartCoach/gameTrigger';
import type { NormalizedExerciseResult } from '@/lib/normalizedExerciseResult';
import type { SessionMetrics } from '@/lib/smartCoach/types';
import { MayaNarrationCard } from '@/components/coach/MayaNarrationCard';
import { MayaAssistantBubble, type MayaHelpAction } from '@/components/coach/MayaAssistantBubble';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useMicroEncouragement } from '@/hooks/useMicroEncouragement';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { humanizeSlug } from '@/lib/performanceAwareFeedback';
import { getFeedbackTone } from '@/lib/performanceAwareFeedback';

// ─── Session Phase State Machine ────────────────────────────

type SessionPhase =
  | 'loading'
  | 'plan'
  | 'opener'
  | 'warmup'
  | 'game1_setup'
  | 'game1_playing'
  | 'game1_review'
  | 'transfer_check'
  | 'game2_setup'
  | 'game2_playing'
  | 'game2_review'
  | 'complete';

// Phase progress mapping
const PHASE_LABELS = ['Welcome', 'Warm up', 'Practice 1', 'Review', 'Transfer', 'Practice 2', 'Review', 'Complete'];
const TOTAL_PHASES = PHASE_LABELS.length;

function getPhaseIndex(phase: SessionPhase): number {
  switch (phase) {
    case 'opener': return 0;
    case 'warmup': return 1;
    case 'game1_setup': case 'game1_playing': return 2;
    case 'game1_review': return 3;
    case 'transfer_check': return 4;
    case 'game2_setup': case 'game2_playing': return 5;
    case 'game2_review': return 6;
    case 'complete': return 7;
    default: return 0;
  }
}

// ─── Route map (same as LessonFlow) ────────────────────────

const EXERCISE_ROUTE_MAP: Record<string, string> = {
  'photo-naming': '/exercise/photo-naming',
  'minimal-pairs': '/exercise/minimal-pairs',
  'meaning-match': '/exercise/meaning-match',
  'semantic-features': '/exercise/semantic-features',
  'sentence-construction': '/exercise/sentence-construction',
  'category-fluency': '/exercise/category-fluency',
  'yes-no-comprehension': '/exercise/yes-no-comprehension',
  'describe-guess': '/exercise/describe-guess',
  'narrative-retell': '/exercise/narrative-retell',
  'synonym-generator': '/exercise/synonym-generator',
};

// ─── Component ──────────────────────────────────────────────

export default function SmartCoach() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activeProfile } = useProfile();
  const recoveryScore = useRecoveryScore(user?.id, activeProfile?.id, { enabled: true });
  const coachProfile = useCoachProfile(user?.id);

  // Session state
  const [phase, setPhase] = useState<SessionPhase>('loading');
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [warmupResponse, setWarmupResponse] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Game results
  const [game1Result, setGame1Result] = useState<NormalizedExerciseResult | null>(null);
  const [game2Result, setGame2Result] = useState<NormalizedExerciseResult | null>(null);
  
  // Transfer tracking
  const [transferTargets, setTransferTargets] = useState<TransferTarget[]>([]);
  const [transferResults, setTransferResults] = useState<TransferSummaryItem[]>([]);
  const [transferFeedbackText, setTransferFeedbackText] = useState<string | null>(null);
  
  // Cross-session
  const [wordHistory, setWordHistory] = useState<WordHistory[]>([]);
  
  // Session tracking
  const sessionIdRef = useRef<string | null>(null);
  const sessionSaved = useRef(false);
  const hasRestoredRef = useRef(false);

  // TTS + Micro-feedback + Hint state
  const tts = useTextToSpeech();
  const microEncouragement = useMicroEncouragement();
  const [hintLevel, setHintLevel] = useState(0);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  // ─── Restore from exercise navigation ─────────────────────
  
  useEffect(() => {
    if (hasRestoredRef.current) return;
    
    const saved = sessionStorage.getItem('smartCoachState');
    if (!saved) return;
    
    hasRestoredRef.current = true;
    
    try {
      const state = JSON.parse(saved);
      sessionStorage.removeItem('smartCoachState');
      
      setPlan(state.plan);
      sessionIdRef.current = state.sessionId;
      setGame1Result(state.game1Result);
      setTransferTargets(state.transferTargets || []);
      setTransferResults(state.transferResults || []);
      setWarmupResponse(state.warmupResponse);
      setWordHistory(state.wordHistory || []);
      
      // Determine which phase to resume at based on which game just completed
      if (state.returningFromGame === 2) {
        // Game 2 just finished — we need the result from the exercise-complete event
        setPhase('game2_playing');
      } else if (state.returningFromGame === 1) {
        setPhase('game1_playing');
      }
    } catch (e) {
      console.warn('[SmartCoach] Failed to restore state:', e);
    }
  }, []);

  // ─── Listen for exercise-complete event ───────────────────
  
  useEffect(() => {
    const handleExerciseComplete = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || !plan) return;
      
      const normalized: NormalizedExerciseResult = {
        slug: detail.exerciseSlug || '',
        completed: true,
        score: detail.score ?? 0,
        successBand: (detail.score ?? 0) >= 0.85 ? 'high' : (detail.score ?? 0) >= 0.5 ? 'target' : 'low',
        accuracy: detail.accuracy ?? detail.score ?? 0,
        targetWords: detail.targetWords || [],
        difficultyTier: detail.difficultyReached ?? 1,
        summary: `Score: ${Math.round((detail.score ?? 0) * 100)}%`,
      };
      
      if (phase === 'game1_playing') {
        handleGame1Complete(normalized);
      } else if (phase === 'game2_playing') {
        handleGame2Complete(normalized);
      }
    };
    
    window.addEventListener('exercise-complete', handleExerciseComplete);
    return () => window.removeEventListener('exercise-complete', handleExerciseComplete);
  }, [phase, plan]);

  // Generate plan when profile loads
  useEffect(() => {
    if (coachProfile.loading || !user?.id) return;
    if (plan) return;
    if (hasRestoredRef.current) return;
    
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
    
    loadWordHistory(user.id).then(setWordHistory);
  }, [coachProfile.loading, user?.id, plan]);

  // Save session on complete
  useEffect(() => {
    if (phase === 'complete' && user?.id && plan && !sessionSaved.current) {
      sessionSaved.current = true;
      const metrics: SessionMetrics = {
        wordsProduced: warmupResponse ? warmupResponse.split(/\s+/).length : 0,
        longestResponse: warmupResponse ? warmupResponse.split(/\s+/).length : 0,
        hesitationCount: 0,
        independentResponses: 1,
        cueAssistedCount: 0,
        semanticErrorCount: 0,
        phonemicErrorCount: 0,
        comprehensionBreaks: 0,
        strategiesThatHelped: [],
        avgLatencyEstimate: 0,
      };
      saveSessionSummary(user.id, sessionIdRef.current, plan.topic.id, metrics, []);
    }
  }, [phase, user?.id, plan, warmupResponse]);

  // ─── Create Supabase session ──────────────────────────────
  
  const createSession = useCallback(async () => {
    if (!user || sessionIdRef.current?.includes('-')) {
      // Already have a real session or no user
    }
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        user_id: user!.id,
        profile_id: activeProfile?.id,
        started_at: new Date().toISOString(),
        plan: plan as any,
      })
      .select()
      .single();
    
    if (!error && data) {
      sessionIdRef.current = data.id;
    }
    return data?.id || sessionIdRef.current;
  }, [user, activeProfile, plan]);

  // ─── Navigate to exercise (LessonFlow pattern) ───────────
  
  const navigateToExercise = useCallback((game: GameDefinition, slot: 1 | 2) => {
    const route = EXERCISE_ROUTE_MAP[game.exerciseSlug];
    if (!route) {
      console.error('[SmartCoach] No route for:', game.exerciseSlug);
      // Skip to next phase
      if (slot === 1) setPhase('game1_review');
      else setPhase('game2_review');
      return;
    }
    
    // Save state before navigating
    sessionStorage.setItem('smartCoachState', JSON.stringify({
      plan,
      sessionId: sessionIdRef.current,
      game1Result,
      transferTargets,
      transferResults,
      warmupResponse,
      wordHistory,
      returningFromGame: slot,
    }));
    
    const trials = slot === 1 ? plan!.game1Trials : plan!.game2Trials;
    const difficulty = slot === 1 ? plan!.game1Difficulty : plan!.game2Difficulty;
    const cueLevel = slot === 1 ? plan!.game1CueLevel : plan!.game2CueLevel;
    
    navigate(route, {
      state: {
        sessionId: sessionIdRef.current,
        fromLesson: true,
        trialLimit: trials,
        adaptations: {
          startDifficulty: difficulty,
          cueLevel: cueLevel,
        },
      },
    });
  }, [plan, game1Result, transferTargets, transferResults, warmupResponse, wordHistory, navigate]);

  // ─── Phase Handlers ───────────────────────────────────────

  const handleStartSession = useCallback(async () => {
    if (!plan) return;
    sessionSaved.current = false;
    await createSession();
    setPhase('opener');
  }, [plan, createSession]);

  const handleWarmupSubmit = useCallback((text: string) => {
    setWarmupResponse(text);
    setPhase('game1_setup');
  }, []);

  const handleLaunchGame1 = useCallback(() => {
    if (!plan) return;
    setPhase('game1_playing');
    navigateToExercise(plan.game1, 1);
  }, [plan, navigateToExercise]);

  const handleGame1Complete = useCallback((result: NormalizedExerciseResult) => {
    if (!plan) return;
    setGame1Result(result);
    setHintLevel(0); // Reset hint ladder for next phase
    
    // Feed micro-encouragement with aggregate result
    if (result.score >= 0.7) {
      microEncouragement.trackTrial(true, null, 0);
    }
    
    // Build transfer targets
    const drilledWords = (result.targetWords || []).slice(0, 3);
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
    
    setPhase('game1_review');
  }, [plan, microEncouragement]);

  const handleTransferSubmit = useCallback((text: string) => {
    if (!plan) return;
    setIsProcessing(true);
    
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
      setTransferFeedbackText(feedback.combined);
      
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
    }
    
    // Reactively select Game 2
    if (game1Result) {
      const lastTransferScore = transferResults.length > 0 ? transferResults[transferResults.length - 1]?.score ?? null : null;
      const reactive = selectReactiveGame2(
        plan.rankedGames,
        plan.game1.id,
        game1Result.score,
        game1Result.targetWords || [],
        lastTransferScore,
        {
          severityProfile: coachProfile.severityProfile,
          primaryDeficit: coachProfile.primaryDeficit,
          strugglingPhonemes: coachProfile.strugglingPhonemes,
          domainScores: coachProfile.domainScores,
          exerciseHistory: coachProfile.exerciseHistory,
          lastSessionGoals: coachProfile.lastSessionGoals,
        },
      );
      
      setPlan(prev => prev ? {
        ...prev,
        game2: reactive.game,
        game2Trials: reactive.trials,
        game2Difficulty: reactive.difficulty,
        game2CueLevel: reactive.cueLevel,
      } : prev);
    }
    
    setIsProcessing(false);
    setPhase('game2_setup');
  }, [plan, transferTargets, game1Result, coachProfile, transferResults]);

  const handleLaunchGame2 = useCallback(() => {
    if (!plan) return;
    setPhase('game2_playing');
    navigateToExercise(plan.game2, 2);
  }, [plan, navigateToExercise]);

  const handleGame2Complete = useCallback((result: NormalizedExerciseResult) => {
    setGame2Result(result);
    setHintLevel(0);
    
    // Feed micro-encouragement
    if (result.score >= 0.7) {
      microEncouragement.trackTrial(true, null, 0);
    }
    
    setPhase('game2_review');
  }, [microEncouragement]);

  const handleChangeFocus = useCallback(() => {
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

  const handleNewSession = useCallback(() => {
    setPlan(null);
    setPhase('loading');
    setWarmupResponse(null);
    setGame1Result(null);
    setGame2Result(null);
    setTransferTargets([]);
    setTransferResults([]);
    setTransferFeedbackText(null);
    setWordHistory([]);
    sessionSaved.current = false;
    sessionIdRef.current = null;
    hasRestoredRef.current = false;
  }, []);




  // ─── Derived narration text ───────────────────────────────

  const game1ReviewText = useMemo(() => {
    if (!game1Result || !plan) return '';
    const drilledWords = (game1Result.targetWords || []).slice(0, 3);
    const base = getPostDrillReview(game1Result.score, drilledWords, 1);
    
    // Emotional reinforcement — add felt-experience lines
    const score = game1Result.score;
    if (score >= 0.85) return `${base}\n\nThat was smooth — the words came out quickly. That's exactly the kind of retrieval that helps in conversation.`;
    if (score >= 0.6) return `${base}\n\nYou're building momentum. Each round makes the next one easier.`;
    if (score >= 0.4) return `${base}\n\nSome of those were harder, and that's expected. The fact that you kept going is what builds the pathway.`;
    return `${base}\n\nThat was a tough round. We're going to approach it differently next — the goal is to make it feel easier, not harder.`;
  }, [game1Result, plan]);

  const game2ReviewText = useMemo(() => {
    if (!game2Result || !plan) return '';
    const drilledWords = (game2Result.targetWords || []).slice(0, 3);
    const review = getPostDrillReview(game2Result.score, drilledWords, 2);
    
    // Add comparison if we have game 1
    if (game1Result) {
      const s1 = Math.round(game1Result.score * 100);
      const s2 = Math.round(game2Result.score * 100);
      if (s2 > s1 + 10) return `${review}\n\nGood improvement — you went from ${s1}% to ${s2}%. The words are coming faster.`;
      if (s2 >= s1 - 5) return `${review}\n\nConsistent at ${s2}%. You're building solid retrieval.`;
      return `${review}\n\nThat round was harder, but that's normal — you're pushing into new territory.`;
    }
    return review;
  }, [game2Result, game1Result, plan]);

  const transferPromptText = useMemo(() => {
    if (!plan) return '';
    const drilledWords = (game1Result?.targetWords || []).slice(0, 3);
    if (drilledWords.length > 0) {
      const word = drilledWords[0];
      const context = plan.topic.purpose.transferTarget.split(',')[0].trim();
      return `This is the important part — using it in real life.\n\nTry using "${word}" in a sentence, like you would when ${context}.`;
    }
    return `This is the important part — how would you use what you just practiced in real life?`;
  }, [plan, game1Result]);

  const game2SetupText = useMemo(() => {
    if (!plan) return '';
    const gameName = plan.game2.label;
    if (game1Result && game1Result.score < 0.5) {
      const hardWords = (game1Result.targetWords || []).slice(0, 2).map(w => `"${w}"`).join(' and ');
      return `${hardWords ? `${hardWords} were tough` : 'That was challenging'} — so we're going to approach it differently.\n\n${gameName} works on the same skills from a different angle. This should feel a bit easier.`;
    }
    if (game1Result && game1Result.score >= 0.8) {
      return `You were strong there — let's push further.\n\n${gameName} will build on that speed and add a new layer.`;
    }
    return `Now let's reinforce what you just practiced.\n\n${gameName} targets the same area from a different angle — the repetition is what builds real retrieval.`;
  }, [plan, game1Result]);

  // ─── Maya help text by phase ──────────────────────────────
  const getMayaHelpText = useCallback((action: MayaHelpAction): string | null => {
    if (!plan) return null;

    switch (action) {
      case 'repeat_instructions': {
        if (phase === 'warmup') return buildWarmupQuestion(plan);
        if (phase === 'game1_setup') return plan.game1Setup;
        if (phase === 'game2_setup') return game2SetupText;
        if (phase === 'transfer_check') return transferPromptText;
        if (phase === 'game1_review') return game1ReviewText;
        if (phase === 'game2_review') return game2ReviewText;
        if (phase === 'opener') return plan.opener;
        return "We're working through today's session together.";
      }
      case 'give_hint': {
        // Progressive hint ladder: encouragement → semantic → phonemic → model
        const nextLevel = hintLevel + 1;
        setHintLevel(nextLevel);
        
        if (phase === 'warmup') return "Just say the first thing that comes to mind — there's no wrong answer.";
        if (phase === 'transfer_check') {
          const word = (game1Result?.targetWords || [])[0];
          if (!word) return "Try building a short sentence using one of the words you just practiced.";
          
          if (nextLevel <= 1) return `Take your time — think about when you'd use "${word}".`;
          if (nextLevel <= 2) return `Try starting with "${word}" — like "I want ${word}" or "The ${word} is..."`;
          if (nextLevel <= 3) return `Here's an example: "I'd like the ${word}, please." Now try your own version.`;
          return `You could say: "Can I have the ${word}?" — any sentence with "${word}" in it works.`;
        }
        if (nextLevel <= 1) return "Take your time. There's no rush — just try your best.";
        if (nextLevel <= 2) return "Think about what category it belongs to. What group does it fit in?";
        if (nextLevel <= 3) {
          const phonemes = coachProfile.strugglingPhonemes || [];
          if (phonemes.length > 0) return `Focus on the first sound. Start with the beginning of the word.`;
          return "Try saying the first sound that comes to mind.";
        }
        return "It's okay to move on. We'll come back to this.";
      }
      case 'explain_this': {
        if (phase === 'game1_setup' || phase === 'game1_playing')
          return `${plan.game1.label} helps strengthen ${plan.topic.purpose.skillTarget}. The more you practice, the faster the words come.`;
        if (phase === 'game2_setup' || phase === 'game2_playing')
          return `${plan.game2.label} reinforces the same skills from a different angle. This builds stronger retrieval pathways.`;
        if (phase === 'transfer_check')
          return "This is the most important part — using the words in a real sentence proves your brain can find them when it matters.";
        return `Today we're working on ${plan.topic.purpose.skillTarget} because it helps with ${plan.topic.purpose.transferTarget}.`;
      }
      case 'what_are_we_doing':
        return `Today's focus: ${plan.topic.label}. We're working on ${plan.topic.purpose.skillTarget} so you can ${plan.topic.purpose.transferTarget}.`;
      case 'help_me':
        return "You're doing well. Take a breath, and try again when you're ready. There's no time limit.";
      default:
        return null;
    }
  }, [phase, plan, game1Result, game2SetupText, transferPromptText, game1ReviewText, game2ReviewText]);

  const handleMayaHelp = useCallback((action: MayaHelpAction) => {
    const text = getMayaHelpText(action);
    if (text) tts.speak(text);
  }, [getMayaHelpText, tts]);

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

  if (!user || !plan) return null;

  const phaseIndex = getPhaseIndex(phase);
  const drillsCompleted = (game1Result ? 1 : 0) + (game2Result ? 1 : 0);

  // ─── Plan Screen ──────────────────────────────────────────

  if (phase === 'plan') {
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
            {plan.continuityNote && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-1">
                <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Building on progress
                </p>
                <p className="text-xs text-muted-foreground">{plan.continuityNote}</p>
              </div>
            )}

            <div className="bg-card border rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{plan.topic.emoji}</span>
                <div>
                  <h2 className="text-lg font-semibold">{plan.topic.label}</h2>
                  <p className="text-xs text-muted-foreground">{plan.focusDescription}</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  Session plan (~10 min)
                </p>
                <div className="space-y-2.5">
                  {[
                    { step: 1, label: 'Warm up', desc: 'Quick check-in', icon: MessageCircle },
                    { step: 2, label: plan.game1.label, desc: `${plan.game1Trials} items`, icon: Zap },
                    { step: 3, label: 'Use it', desc: 'Try in a real sentence', icon: ArrowRight },
                    { step: 4, label: plan.game2.label, desc: `${plan.game2Trials} items — adaptive`, icon: Brain },
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

  if (phase === 'complete') {
    const completionStats = {
      practiced: transferResults.length,
      transferred: transferResults.filter(r => r.score >= 3).length,
    };

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

              <div className="flex justify-around py-2 border-y border-border/50">
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{drillsCompleted}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Practices</p>
                </div>
                {completionStats.transferred > 0 && (
                  <div className="text-center">
                    <p className="text-lg font-bold text-primary">{completionStats.transferred}</p>
                    <p className="text-[10px] text-primary/70 uppercase tracking-wide font-medium">Transferred</p>
                  </div>
                )}
              </div>

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
                          tr.score >= 4 ? 'text-primary font-semibold' :
                          tr.score >= 3 ? 'text-primary' : 'text-muted-foreground'
                        )}>
                          {tr.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

  // ─── Active Session Phases (Narration Cards) ──────────────
  // Wrap all active phases with the Maya bubble for persistent presence

  const showBubble = !['loading', 'plan', 'complete'].includes(phase);

  const renderPhaseContent = () => {
    // Opener
    if (phase === 'opener') {
      return (
        <MayaNarrationCard
          narration={plan.opener}
          actionLabel="Let's warm up"
          onContinue={() => setPhase('warmup')}
          phaseIndex={phaseIndex}
          totalPhases={TOTAL_PHASES}
          phaseLabels={PHASE_LABELS}
          icon={plan.topic.emoji}
        />
      );
    }

    // Warmup (with input)
    if (phase === 'warmup') {
      const warmupQ = buildWarmupQuestion(plan);
      return (
        <MayaNarrationCard
          narration={warmupQ}
          onContinue={() => setPhase('game1_setup')}
          showInput
          inputPlaceholder="Type or speak your response..."
          onSubmit={handleWarmupSubmit}
          phaseIndex={phaseIndex}
          totalPhases={TOTAL_PHASES}
          phaseLabels={PHASE_LABELS}
        />
      );
    }

    // Game 1 Setup
    if (phase === 'game1_setup') {
      return (
        <MayaNarrationCard
          narration={plan.game1Setup}
          subtitle={`${plan.game1Trials} items · ~${Math.ceil(plan.game1.durationSec / 60)} min`}
          actionLabel="Start practice"
          onContinue={handleLaunchGame1}
          phaseIndex={phaseIndex}
          totalPhases={TOTAL_PHASES}
          phaseLabels={PHASE_LABELS}
          icon={plan.game1.icon}
        />
      );
    }

    // Game 1 Playing (shouldn't render — we navigated away)
    if (phase === 'game1_playing') {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    // Game 1 Review
    if (phase === 'game1_review') {
      return (
        <MayaNarrationCard
          narration={game1ReviewText}
          actionLabel="Continue"
          onContinue={() => setPhase('transfer_check')}
          phaseIndex={phaseIndex}
          totalPhases={TOTAL_PHASES}
          phaseLabels={PHASE_LABELS}
        />
      );
    }

    // Transfer Check (with input)
    if (phase === 'transfer_check') {
      return (
        <MayaNarrationCard
          narration={transferPromptText}
          onContinue={() => setPhase('game2_setup')}
          showInput
          inputPlaceholder="Use those words in a sentence..."
          onSubmit={handleTransferSubmit}
          isProcessing={isProcessing}
          phaseIndex={phaseIndex}
          totalPhases={TOTAL_PHASES}
          phaseLabels={PHASE_LABELS}
        />
      );
    }

    // Game 2 Setup
    if (phase === 'game2_setup') {
      return (
        <MayaNarrationCard
          narration={game2SetupText}
          subtitle={`${plan.game2Trials} items · ~${Math.ceil(plan.game2.durationSec / 60)} min`}
          actionLabel="Start practice"
          onContinue={handleLaunchGame2}
          phaseIndex={phaseIndex}
          totalPhases={TOTAL_PHASES}
          phaseLabels={PHASE_LABELS}
          icon={plan.game2.icon}
        />
      );
    }

    // Game 2 Playing
    if (phase === 'game2_playing') {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    // Game 2 Review
    if (phase === 'game2_review') {
      return (
        <MayaNarrationCard
          narration={game2ReviewText}
          actionLabel="See summary"
          onContinue={() => setPhase('complete')}
          phaseIndex={phaseIndex}
          totalPhases={TOTAL_PHASES}
          phaseLabels={PHASE_LABELS}
        />
      );
    }

    return null;
  };

  return (
    <>
      {renderPhaseContent()}
      {showBubble && (
        <MayaAssistantBubble
          isSpeaking={tts.isSpeaking}
          onAction={handleMayaHelp}
        />
      )}
    </>
  );
}

// ─── Helper Functions ───────────────────────────────────────

function buildWarmupQuestion(plan: SessionPlan): string {
  const topicQuestions: Record<string, string[]> = {
    food: [
      "Before we practice — tell me something you ate recently. I want to hear how easily the words come out.",
      "Quick warm-up — describe your favorite meal. Don't worry about being perfect, just talk.",
    ],
    family: [
      "Before we start — tell me about someone in your family. I want to hear how the words flow.",
      "Quick warm-up — who did you spend time with recently? Just a sentence or two.",
    ],
    hobbies: [
      "Before we start — what's something you enjoy doing? I want to hear how easily you describe it.",
      "Quick warm-up — tell me what you did for fun recently. Just talk naturally.",
    ],
    daily_routine: [
      "Before we start — walk me through this morning. I want to hear how the sequence comes out.",
      "Quick warm-up — describe what you did when you woke up today.",
    ],
    travel: [
      "Before we start — tell me about a place you've visited. I want to hear how the details come out.",
      "Quick warm-up — where would you go if you could travel anywhere? Describe it briefly.",
    ],
    pets: [
      "Before we start — tell me about a pet or animal you like. I want to hear how you describe them.",
      "Quick warm-up — what's your favorite animal? Tell me why.",
    ],
  };

  const questions = topicQuestions[plan.topic.id] || ["Tell me about your day so far — I want to hear how the words come out."];
  return questions[Math.floor(Math.random() * questions.length)];
}
