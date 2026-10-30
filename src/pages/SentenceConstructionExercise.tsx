import { useState, useEffect, useRef, useCallback } from "react";
import { ExerciseLoadGate } from '@/components/ExerciseLoadGate';
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Settings, SkipForward } from "lucide-react";
import { SentenceConstructionGame } from "@/components/SentenceConstructionGame";
import { useAuth } from "@/hooks/useAuth";
import { useExerciseConfig } from "@/hooks/useExerciseConfig";
import { useExerciseGating } from "@/hooks/useExerciseGating";
import { useSessionAdaptation } from "@/hooks/useSessionAdaptation";
import { buildAdaptationTelemetry } from "@/lib/adaptationTelemetry";
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useVerifiedExerciseCompletion } from '@/hooks/useVerifiedExerciseCompletion';
import { ExerciseSaveFeedback } from '@/components/exercise/ExerciseSaveFeedback';
import { ExerciseLoading } from '@/components/exercise/ExerciseLoading';
import { CANONICAL_SLUGS } from "@/lib/exerciseSlugNormalizer";
import { toast } from "sonner";
import { useRestoredLessonContext } from "@/hooks/useRestoredLessonContext";
import { useDynamicTier } from "@/hooks/useDynamicTier";
import { useProfile } from "@/hooks/useProfile";
import { useTrialSubmission } from "@/hooks/useTrialSubmission";
import {
  useSentenceConstructionProgression,
  mapSentenceConstructionSupport,
} from "@/hooks/useSentenceConstructionProgression";
import { resolveEffectiveSentenceConstructionInitialDifficulty } from "@/lib/progression/sentenceConstructionDifficultyBridge";

import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { DifficultyInfoBadge } from "@/components/DifficultyInfoBadge";
import { InlineSessionProgress } from "@/components/InlineSessionProgress";
import { SessionSidePanel } from "@/components/SessionSidePanel";

const SentenceConstructionExercise = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Extract lesson flow state
  const restored = useRestoredLessonContext('sentence-construction');
  const { fromLesson, returnTo } = restored;
  const lessonSessionId = restored.sessionId;
  
  // Shared adaptation contract
  const adaptation = useSessionAdaptation({
    lessonAdaptations: location.state?.adaptations,
    lessonFocusPhonemes: location.state?.focusPhonemes,
    defaultErrorType: 'semantic_paraphasia',
  });

  const adaptationTelemetry = buildAdaptationTelemetry(adaptation, {
    phonemeSensitive: false,
    cueSensitive: false,  // grammar-focused, not cue-driven
  });
  
  const sessionStartRef = useRef(Date.now());
  const scoreRef = useRef(0);
  const trialsRef = useRef(0);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (advanceTimeoutRef.current !== null) clearTimeout(advanceTimeoutRef.current);
  }, []);
  const [showSettings, setShowSettings] = useState(false);
  const [clinicalProfile, setClinicalProfile] = useState<any>(null);
  const [manualDifficulty, setManualDifficulty] = useState<number | null>(null);

  // Fetch clinical profile
  useEffect(() => {
    if (!user?.id) return;
    
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('clinical_profile')
        .eq('user_id', user.id)
        .single();
      
      setClinicalProfile(data?.clinical_profile);
    };
    
    fetchProfile();
  }, [user?.id]);

  // Get merged exercise config with capability adaptations
  const { config, hasCapabilityAdaptations, bounds } = useExerciseConfig(
    'sentence-construction',
    user?.id,
    clinicalProfile,
    null
  );
  
  const { getAdaptations } = useExerciseGating(user?.id, undefined);
  const { activeProfile } = useProfile();
  const {
    activeSessionId: sessionId, isCreatingSession, sessionError, retrySession,
  } = useStandaloneSession(user?.id, lessonSessionId, 'sentence_construction');

  // Wave 2: Clinical Progression v1 — sentence-construction now has an
  // L1–L8 structural ladder. Persistent Clinical Level supplies a FLOOR
  // for the in-session engine tier (1–10); session adaptation can still
  // escalate above the floor. Mirrors the SemanticFeatures/TwoClues
  // Wave-1 wiring; load gate mirrors the MinimalPairs gate from Wave 0.
  const progression = useSentenceConstructionProgression({
    userId: user?.id,
    profileId: activeProfile?.id,
  });
  const bridge = resolveEffectiveSentenceConstructionInitialDifficulty({
    sessionAdaptationDifficulty: adaptation.difficultyTier,
    clinicalLevel: progression.startingLevel,
    supportBaseline: progression.state?.supportBaseline ?? 0,
  });
  if (import.meta.env.DEV && bridge.softRegressionScaffold) {
    console.log(
      `[SoftRegression] SentenceConstruction scaffolding active — supportBaseline=${progression.state?.supportBaseline} ` +
        `lowered floor by 1 (clinicalLevel=${progression.startingLevel}, floor=${bridge.clinicalFloor}, effective=${bridge.effective})`,
    );
  }
  const effectiveStartDifficulty = bridge.effective;

  // Per-trial dynamic tier controller (1..10). Seeded by clinical floor.
  const dynamicTier = useDynamicTier({
    exerciseSlug: 'sentence-construction',
    sessionId,
    userId: user?.id,
    profileId: activeProfile?.id,
    initialTier: effectiveStartDifficulty,
    minTier: 1,
    maxTier: 10,
    targetSuccessRate: 0.75,
  });

  const level = manualDifficulty ?? dynamicTier.currentTier;
  const trialIndexRef = useRef(0);

  // Wave 2: unified trial submission (executive axis). Progression is wired
  // through useSentenceConstructionProgression so every submitTrial buffers a
  // clinical trial (correct + support), and commitSession flushes the L1–L8
  // ladder. adaptation_trial_logs come from the page (trialMode='production');
  // SentenceConstructionGame's useInGameAdaptation is autoLog:false.
  const { submitTrial, commitSession, retryFailedSubmissions } = useTrialSubmission({
    userId: user?.id,
    profileId: activeProfile?.id,
    sessionId,
    exerciseSlug: 'sentence_construction',
    progression,
  });

  const handleTrialComplete = async (data: {
    correct: boolean;
    reactionTime: number;
    errorType: string | null;
    grammarFocus: string;
    trialSource: 'graded_sentence_bank' | 'standard_sentence_bank';
    hintUsed: boolean;
    difficulty: number;
  }) => {
    trialIndexRef.current += 1;
    trialsRef.current++;
    scoreRef.current += data.correct ? 100 : 0;

    // Feed adaptive controller (skip when manual override active)
    if (manualDifficulty === null) {
      dynamicTier.recordTrial({
        correct: data.correct,
        reactionTimeMs: data.reactionTime,
        errorType: data.errorType ?? undefined,
      });
    }

    // NOTE: previously also called trackRound() here, which inserted a SECOND
    // exercise_events row per trial on a 0/1 score scale — submitTrial below
    // writes the canonical 0–100 row. That double-write doubled the rep count
    // and corrupted session accuracy, so submitTrial is now the single writer.

    await submitTrial({
      profileId: activeProfile?.id,
      sessionId,
      gameId: 'sentence_construction',
      level: data.difficulty ?? level,
      stimulusId: `sc_trial_${trialIndexRef.current}_${data.grammarFocus}`,
      expectedResponse: null,
      userResponse: null,
      isCorrect: data.correct,
      accuracyScore: data.correct ? 1 : 0,
      cueLevel: data.hintUsed ? 1 : 0,
      supportUsed: mapSentenceConstructionSupport(data.hintUsed),
      latencyMs: data.reactionTime,
      trialMode: 'production',
      errorType: data.correct ? undefined : (data.errorType ?? 'grammar_error'),
      taskParameters: {
        // This page owns the adaptation_trial_logs writer (game is autoLog:false).
        unified_route_adaptation_log: true,
        difficulty: data.difficulty,
        grammarFocus: data.grammarFocus,
        trial_source: data.trialSource,
        hint_used: data.hintUsed,
        manual_override: manualDifficulty !== null,
        clinical_level: progression.startingLevel,
        clinical_floor: bridge.clinicalFloor,
        adaptations_active: dynamicTier.getAdaptationsActive(),
        ...adaptationTelemetry,
      },
    });
  };

  const getSessionStats = useCallback(() => ({
    score: scoreRef.current,
    totalTrials: trialsRef.current,
    startTime: sessionStartRef.current,
  }), []);
  const { completeSession } = useSessionLifecycle({
    sessionId, userId: user?.id, profileId: activeProfile?.id,
    exerciseSlug: 'sentence_construction', getSessionStats,
  });

  const onConfirmed = useCallback((results: { finalScore: number; totalTrials: number }) => {
    if (!fromLesson) return;
    advanceTimeoutRef.current = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('exercise-complete', {
        detail: { exerciseSlug: 'sentence_construction', results },
      }));
      navigate(returnTo, { state: { resuming: true }, replace: true });
    }, 400);
  }, [fromLesson, navigate, returnTo]);

  const { saveState, finish, retry } = useVerifiedExerciseCompletion<{
    finalScore: number; totalTrials: number;
  }>({
    scope: user?.id && activeProfile?.id && sessionId
      ? JSON.stringify([user.id, activeProfile.id, sessionId, 'sentence_construction'])
      : null,
    commitSession,
    completeSession,
    retryFailedSubmissions,
    onConfirmed,
  });

  const handleGameComplete = (finalScore: number, totalTrials: number) => {
    void finish({ finalScore, totalTrials });
  };

  const handleSkipExercise = async () => {
    if (user?.id) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, clinical_profile')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        await supabase.from('exercise_skips').insert({
          user_id: user.id,
          profile_id: profile?.id,
          session_id: sessionId,
          exercise_slug: CANONICAL_SLUGS.SENTENCE_CONSTRUCTION,
          skip_reason: 'too_difficult',
          from_lesson: fromLesson,
          clinical_snapshot: profile?.clinical_profile
        });
      } catch (error) {
        console.error('Error logging skip:', error);
      }
    }
    
    toast.info("Exercise skipped - moving to next activity");
    
    window.dispatchEvent(new CustomEvent('exercise-complete'));
    navigate(returnTo, { state: { resuming: true } });
  };

  const handleDifficultyChange = (newLevel: number) => {
    setManualDifficulty(newLevel);
    setShowSettings(false);
    toast.success(`Difficulty set to Level ${newLevel}`);
  };

  if (isCreatingSession || !sessionId) {
    return <ExerciseLoading error={sessionError} onRetry={sessionError ? retrySession : undefined} />;
  }
  if (saveState === 'saving' || saveState === 'error') {
    return <ExerciseSaveFeedback state={saveState} onRetry={() => void retry()} onExit={() => navigate('/today')} />;
  }
  if (saveState === 'complete') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-5 p-6 text-center">
        <h2 className="text-2xl font-bold">Practice saved</h2>
        <Button className="min-h-14 w-full max-w-md text-lg" size="lg" onClick={() => navigate('/today')}>
          Go to Today
        </Button>
      </div>
    );
  }

  if (fromLesson) {
    return (
      <div className="h-dvh flex flex-col bg-background overflow-hidden">
        <SessionSidePanel />
        <InlineSessionProgress />
        {/* Compact header */}
        <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => {
              navigate(returnTo, { state: { resuming: true } });
            }}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <span className="text-sm font-medium">Sentence Construction</span>
            <Badge variant="outline" className="text-xs">Lv {level}</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkipExercise}
            className="text-orange-600"
          >
            <SkipForward className="w-4 h-4 mr-1" />
            Skip
          </Button>
        </div>
        {/* Game fills remaining space — no scroll. Load gate mirrors
            MinimalPairs / SemanticFeatures: don't mount until the clinical
            floor is resolved so the engine starts at the right tier. */}
        <div className="flex-1 min-h-0 flex flex-col px-3 py-2">
          {progression.loaded && !adaptation.loading ? (
            <SentenceConstructionGame key={JSON.stringify([user?.id, activeProfile?.id, sessionId])}
              config={config}
              bounds={bounds}
              difficultyLevel={level}
              focusPhonemes={adaptation.focusPhonemes}
              adaptations={getAdaptations('sentence-construction')}
              sessionId={sessionId}
              clinicalLevel={progression.startingLevel}
              onTrialComplete={handleTrialComplete}
              onGameComplete={handleGameComplete}
            />
          ) : (
            <ExerciseLoadGate inline loadingLabel="Loading your progression…" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      {/* Compact header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Back to home" className="h-8 w-8" onClick={() => navigate('/today')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium hidden sm:inline">Sentence Construction</span>
          <DifficultyInfoBadge level={level} floor={bounds.floor} ceiling={bounds.ceiling} />
        </div>
        <div className="flex items-center gap-1.5">
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Settings" className="h-8 w-8">
                <Settings className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Difficulty Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Difficulty Level: {level}</Label>
                  <Slider
                    value={[level]}
                    onValueChange={([val]) => handleDifficultyChange(val)}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Level 1: Basic SVO</span>
                    <span>Level 10: Advanced</span>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Game fills remaining space — load gate on clinical progression. */}
      <div className="flex-1 min-h-0 flex flex-col px-3 py-2">
        {progression.loaded && !adaptation.loading ? (
          <SentenceConstructionGame key={JSON.stringify([user?.id, activeProfile?.id, sessionId])}
            config={config}
            bounds={bounds}
            difficultyLevel={level}
            focusPhonemes={adaptation.focusPhonemes}
            adaptations={getAdaptations('sentence-construction')}
            sessionId={sessionId}
            clinicalLevel={progression.startingLevel}
            onTrialComplete={handleTrialComplete}
            onGameComplete={handleGameComplete}
          />
        ) : (
          <ExerciseLoadGate inline loadingLabel="Loading your progression…" />
        )}
      </div>
    </div>
  );
};

export default SentenceConstructionExercise;
