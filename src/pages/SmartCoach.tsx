/**
 * Smart Coach — Continuous Therapy Canvas (Simplified)
 * 
 * Architecture: Adaptive Session (body) + Smart Coach Intelligence (brain) + Maya (presence)
 * 
 * Flow: Plan → Game 1 → Transfer → Game 2 → Complete
 * Maya narrates inline via bubble/toasts, NOT full-screen cards between every step.
 * Games are full-page, identical to adaptive sessions.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle2, Target, Zap, TrendingUp, Brain, Clock, ArrowRight, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useCoachProfile } from '@/hooks/useCoachProfile';
import { useRecoveryScore } from '@/hooks/useRecoveryScore';
import { generateSessionPlan, selectReactiveGame2, type SessionPlan } from '@/lib/smartCoach/sessionPlanGenerator';
import { adaptExerciseResult } from '@/lib/smartCoach/interventionAdapter';
import { getPostDrillReview } from '@/lib/smartCoach/sessionArc';
import { saveSessionSummary } from '@/lib/smartCoach/progressNarrative';
import { scoreTransfer, TRANSFER_LABELS, type TransferTarget, type TransferCheckResult } from '@/lib/smartCoach/transferScoring';
import { getTransferFeedback, type TransferSummaryItem } from '@/lib/smartCoach/transferFeedback';
import { loadWordHistory, type WordHistory } from '@/lib/smartCoach/crossSessionRetention';
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
import { toast } from 'sonner';

// ─── Toast throttle: prevents spam by enforcing a minimum gap ────
let lastToastTime = 0;
const TOAST_MIN_GAP_MS = 4000;

function mayaToast(message: string, opts?: { type?: 'success' | 'default'; duration?: number }) {
  const now = Date.now();
  if (now - lastToastTime < TOAST_MIN_GAP_MS) return;
  lastToastTime = now;
  const duration = opts?.duration ?? 4000;
  if (opts?.type === 'success') {
    toast.success(message, { duration });
  } else {
    toast(message, { duration });
  }
}

// ─── Session Phase State Machine (Simplified) ──────────────

type SessionPhase =
  | 'loading'
  | 'plan'
  | 'game1_intro'     // merged opener + game1 setup
  | 'game1_playing'
  | 'transfer_check'  // only input card in the flow
  | 'game2_playing'
  | 'complete';

// Phase progress mapping
const PHASE_LABELS = ['Get ready', 'Practice 1', 'Transfer', 'Practice 2', 'Complete'];
const TOTAL_PHASES = PHASE_LABELS.length;

function getPhaseIndex(phase: SessionPhase): number {
  switch (phase) {
    case 'game1_intro': return 0;
    case 'game1_playing': return 1;
    case 'transfer_check': return 2;
    case 'game2_playing': return 3;
    case 'complete': return 4;
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
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Game results
  const [game1Result, setGame1Result] = useState<NormalizedExerciseResult | null>(null);
  const [game2Result, setGame2Result] = useState<NormalizedExerciseResult | null>(null);
  
  // Transfer tracking
  const [transferTargets, setTransferTargets] = useState<TransferTarget[]>([]);
  const [transferResults, setTransferResults] = useState<TransferSummaryItem[]>([]);
  
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
      setWordHistory(state.wordHistory || []);
      
      // Determine which phase to resume at
      if (state.returningFromGame === 2) {
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
        wordsProduced: 0,
        longestResponse: 0,
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
  }, [phase, user?.id, plan]);

  // ─── Create Supabase session ──────────────────────────────
  
  const createSession = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
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
      if (slot === 1) setPhase('transfer_check');
      else setPhase('complete');
      return;
    }
    
    // Save state before navigating
    sessionStorage.setItem('smartCoachState', JSON.stringify({
      plan,
      sessionId: sessionIdRef.current,
      game1Result,
      transferTargets,
      transferResults,
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
        returnTo: '/smart-coach',
        trialLimit: trials,
        adaptations: {
          startDifficulty: difficulty,
          cueLevel: cueLevel,
        },
      },
    });
  }, [plan, game1Result, transferTargets, transferResults, wordHistory, navigate]);

  // ─── Phase Handlers ───────────────────────────────────────

  const handleStartSession = useCallback(async () => {
    if (!plan) return;
    sessionSaved.current = false;
    await createSession();
    setPhase('game1_intro');
  }, [plan, createSession]);

  const handleLaunchGame1 = useCallback(() => {
    if (!plan) return;
    setPhase('game1_playing');
    navigateToExercise(plan.game1, 1);
  }, [plan, navigateToExercise]);

  const handleGame1Complete = useCallback((result: NormalizedExerciseResult) => {
    if (!plan) return;
    setGame1Result(result);
    setHintLevel(0);
    
    // Show review as a throttled toast
    const score = result.score;
    const pct = Math.round(score * 100);
    if (score >= 0.85) {
      mayaToast(`${pct}% — words came out quickly. Now let's use them.`, { type: 'success' });
    } else if (score >= 0.6) {
      mayaToast(`${pct}% — building momentum. Let's reinforce.`);
    } else if (score >= 0.4) {
      mayaToast(`${pct}% — some were tough. We'll approach it differently.`);
    } else {
      mayaToast(`${pct}% — hard round. Let's adjust and try another angle.`);
    }
    
    microEncouragement.trackGameComplete({
      score: result.score,
      targetWords: result.targetWords,
      gameSlot: 1,
    });
    
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
    
    setPhase('transfer_check');
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
      
      // Show transfer feedback as throttled toast
      if (transferResult.transferScore >= 4) {
        mayaToast(feedback.combined.split('.')[0] + '.', { type: 'success' });
      } else {
        mayaToast(feedback.combined.split('.')[0] + '.');
      }
      
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
    
    // Auto-launch game 2 after brief delay (no setup card)
    setTimeout(() => {
      setPhase('game2_playing');
      // navigateToExercise will be called via effect
    }, 800);
  }, [plan, transferTargets, game1Result, coachProfile, transferResults]);

  // Auto-launch game 2 when phase transitions
  useEffect(() => {
    if (phase === 'game2_playing' && plan && !game2Result) {
      const saved = sessionStorage.getItem('smartCoachState');
      // Only navigate if we haven't saved state yet (i.e., not returning from exercise)
      if (!saved) {
        const gameName = plan.game2.label;
        mayaToast(`Next: ${gameName} — different angle, same skills.`, { duration: 3000 });
        navigateToExercise(plan.game2, 2);
      }
    }
  }, [phase, plan, game2Result, navigateToExercise]);

  const handleGame2Complete = useCallback((result: NormalizedExerciseResult) => {
    setGame2Result(result);
    setHintLevel(0);
    
    // Show cross-game comparison as throttled toast
    if (game1Result) {
      const s1 = Math.round(game1Result.score * 100);
      const s2 = Math.round(result.score * 100);
      const delta = s2 - s1;
      if (delta >= 10) {
        mayaToast(`${s1}% → ${s2}% — real improvement.`, { type: 'success' });
      } else if (delta >= 0) {
        mayaToast(`Steady at ${s2}% — building reliable retrieval.`);
      } else {
        mayaToast(`${s2}% on a harder exercise — that's progress.`);
      }
    }
    
    microEncouragement.trackGameComplete({
      score: result.score,
      targetWords: result.targetWords,
      gameSlot: 2,
    });
    
    setPhase('complete');
  }, [game1Result, microEncouragement]);

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
    setGame1Result(null);
    setGame2Result(null);
    setTransferTargets([]);
    setTransferResults([]);
    setWordHistory([]);
    sessionSaved.current = false;
    sessionIdRef.current = null;
    hasRestoredRef.current = false;
  }, []);

  // ─── Transfer prompt text ────────────────────────────────

  const transferPromptText = useMemo(() => {
    if (!plan) return '';
    const drilledWords = (game1Result?.targetWords || []).slice(0, 3);
    if (drilledWords.length > 0) {
      const word = drilledWords[0];
      return `Quick check — use "${word}" in a sentence.`;
    }
    return `Quick check — use one of those words in a sentence.`;
  }, [plan, game1Result]);

  // ─── Maya help text by phase ──────────────────────────────
  const getMayaHelpText = useCallback((action: MayaHelpAction): string | null => {
    if (!plan) return null;

    switch (action) {
      case 'repeat_instructions': {
        if (phase === 'game1_intro') return `${plan.game1Setup}\n\n${plan.game1Trials} items · ~${Math.ceil(plan.game1.durationSec / 60)} min`;
        if (phase === 'transfer_check') return transferPromptText;
        return `Today's focus: ${plan.topic.label} — ${plan.topic.purpose.skillTarget}.`;
      }
      case 'give_hint': {
        const nextLevel = hintLevel + 1;
        setHintLevel(nextLevel);
        
        if (phase === 'transfer_check') {
          const word = (game1Result?.targetWords || [])[0];
          if (!word) return "Try building a short sentence using one of the words you just practiced.";
          if (nextLevel <= 1) return `Take your time — think about when you'd use "${word}".`;
          if (nextLevel <= 2) return `Try starting with "${word}" — like "I want ${word}" or "The ${word} is..."`;
          if (nextLevel <= 3) return `Here's an example: "I'd like the ${word}, please." Now try your own version.`;
          return `You could say: "Can I have the ${word}?" — any sentence with "${word}" in it works.`;
        }
        
        const activeGame = phase === 'game1_intro' || phase === 'game1_playing' ? plan.game1 : plan.game2;
        const slug = activeGame?.exerciseSlug || '';
        
        if (slug.includes('naming') || slug.includes('photo')) {
          if (nextLevel <= 1) return "Take your time — picture it in your mind first.";
          if (nextLevel <= 2) return "Think about what category it belongs to.";
          if (nextLevel <= 3) return "Focus on the first sound. What does the word start with?";
          return "It's okay — we'll come back to this one.";
        }
        if (slug.includes('semantic') || slug.includes('meaning') || slug.includes('synonym') || slug.includes('category')) {
          if (nextLevel <= 1) return "Think about words that go together with this one.";
          if (nextLevel <= 2) return "What would you use it for? Where would you see it?";
          if (nextLevel <= 3) return "Try describing what it means in your own words.";
          return "That's a hard one. Let's move on — you'll see it again.";
        }
        if (slug.includes('sentence') || slug.includes('narrative') || slug.includes('retell') || slug.includes('describe')) {
          if (nextLevel <= 1) return "Start simple — just get the main idea out first.";
          if (nextLevel <= 2) return "Try: who or what... did what... where or when.";
          if (nextLevel <= 3) return "Just say the most important word first, then build around it.";
          return "That's okay — even one word is a good start.";
        }
        if (nextLevel <= 1) return "Take your time. There's no rush.";
        if (nextLevel <= 2) return "Think about what category it belongs to.";
        if (nextLevel <= 3) return "Focus on the first sound.";
        return "It's okay to move on. We'll come back to this.";
      }
      case 'explain_this': {
        if (phase === 'game1_intro' || phase === 'game1_playing')
          return `${plan.game1.label} helps strengthen ${plan.topic.purpose.skillTarget}.`;
        if (phase === 'game2_playing')
          return `${plan.game2.label} reinforces the same skills from a different angle.`;
        if (phase === 'transfer_check')
          return "Using the words in a real sentence proves your brain can find them when it matters.";
        return `Today: ${plan.topic.purpose.skillTarget} — helps with ${plan.topic.purpose.transferTarget}.`;
      }
      case 'what_are_we_doing':
        return `Focus: ${plan.topic.label}. Working on ${plan.topic.purpose.skillTarget} so you can ${plan.topic.purpose.transferTarget}.`;
      case 'help_me':
        return "Take a breath. Try again when you're ready — no time limit.";
      default:
        return null;
    }
  }, [phase, plan, game1Result, transferPromptText, hintLevel]);

  const lastSpokenRef = useRef<string | null>(null);

  const handleMayaHelp = useCallback((action: MayaHelpAction) => {
    const text = getMayaHelpText(action);
    if (text) {
      lastSpokenRef.current = text;
      tts.speak(text);
    }
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

  // ─── Plan Screen (Simplified) ────────────────────────────

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

              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                ~10 min · {plan.game1.label} + {plan.game2.label}
              </p>
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

    // Emotionally grounded closing message
    const closingMessage = (() => {
      if (game1Result && game2Result) {
        const s1 = Math.round(game1Result.score * 100);
        const s2 = Math.round(game2Result.score * 100);
        const delta = s2 - s1;
        if (delta >= 10) return `You improved from ${s1}% to ${s2}%. That's your brain rebuilding pathways — real, measurable progress.`;
        if (s2 >= 80) return `${s2}% accuracy — those words are becoming reliable again. Keep this up.`;
        if (delta >= 0) return `Steady at ${s2}%. Consistency is how recovery works — you're doing it right.`;
        return `${s2}% on a harder exercise. Stretching into harder territory is exactly how you get stronger.`;
      }
      if (game1Result) {
        const s = Math.round(game1Result.score * 100);
        if (s >= 80) return `${s}% — strong session. Your word retrieval is getting faster.`;
        return `${s}% — every session builds on the last. You showed up, and that matters.`;
      }
      return 'Good work today. Every session strengthens your recovery.';
    })();

    // Personalized "what improved" insight
    const improvementInsight = (() => {
      const words = [
        ...(game1Result?.targetWords || []).slice(0, 2),
        ...(game2Result?.targetWords || []).slice(0, 1),
      ];
      if (words.length > 0) {
        return `Words practiced: ${words.map(w => `"${w}"`).join(', ')}`;
      }
      return null;
    })();

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
            {/* Hero closing */}
            <div className="bg-card border rounded-2xl p-6 space-y-5">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Great session 💪</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{closingMessage}</p>
              </div>

              {/* Stats row */}
              <div className="flex justify-around py-3 border-y border-border/50">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{drillsCompleted}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Practices</p>
                </div>
                {game1Result && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{Math.round(game1Result.score * 100)}%</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Best score</p>
                  </div>
                )}
                {completionStats.transferred > 0 && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{completionStats.transferred}</p>
                    <p className="text-[10px] text-primary/70 uppercase tracking-wide font-medium">Transferred</p>
                  </div>
                )}
              </div>

              {/* Game breakdown */}
              {game1Result && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <span className="text-lg">{plan.game1.icon}</span>
                  <div>
                    <p className="text-xs font-medium text-foreground">{plan.game1.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {Math.round(game1Result.score * 100)}%
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
                      {Math.round(game2Result.score * 100)}%
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

              {/* Improvement insight */}
              {improvementInsight && (
                <p className="text-xs text-muted-foreground text-center">{improvementInsight}</p>
              )}
            </div>

            {/* Recovery score */}
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

            {/* Actions */}
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

  // ─── Active Session Phases ────────────────────────────────

  const showBubble = !['loading', 'plan', 'complete'].includes(phase);

  const renderPhaseContent = () => {
    // Merged opener + game1 setup (single card)
    if (phase === 'game1_intro') {
      const topicIntro = `Today: ${plan.topic.label} — ${plan.topic.purpose.skillTarget}.`;
      const gameIntro = plan.game1Setup;
      return (
        <MayaNarrationCard
          narration={`${topicIntro}\n\n${gameIntro}`}
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

    // Transfer Check — lightweight, skippable
    if (phase === 'transfer_check') {
      return (
        <MayaNarrationCard
          narration={transferPromptText}
          onContinue={() => setPhase('game2_playing')}
          showInput
          inputPlaceholder="Type a short sentence..."
          onSubmit={handleTransferSubmit}
          actionLabel="Skip to next practice"
          isProcessing={isProcessing}
          phaseIndex={phaseIndex}
          totalPhases={TOTAL_PHASES}
          phaseLabels={PHASE_LABELS}
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

    return null;
  };

  return (
    <>
      {renderPhaseContent()}
      {showBubble && (
        <MayaAssistantBubble
          isSpeaking={tts.isSpeaking}
          onAction={handleMayaHelp}
          hintLevel={hintLevel}
          lastSpokenText={lastSpokenRef.current || undefined}
        />
      )}
    </>
  );
}
