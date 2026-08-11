/**
 * Phonological Awareness Exercise Page
 *
 * Wave 3 (Phase 2, receptive-safe variant): migrated to the unified
 * useTrialSubmission pipeline. Every submitTrial call emits
 * `trialMode: 'recognition'` (auditory metalinguistic judgment, two-
 * alternative). The slug `phonological_awareness` is INTENTIONALLY NOT
 * in ADOPTED_TRIAL_MODE_SLUGS — receptive mastery routing is deferred
 * (same precedent as MinimalPairs / MeaningMatch / DetectiveMind).
 * Progression is wired via usePhonologicalAwarenessProgression (L1–L8
 * ladder) with a load gate so the engine starts at the correct clinical
 * floor.
 */
import { ExerciseLoading } from '@/components/exercise/ExerciseLoading';
import { ExerciseLoadGate } from '@/components/ExerciseLoadGate';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PhonologicalGame, type PhonologicalTrialDetail } from '@/components/PhonologicalGame';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { CANONICAL_SLUGS } from '@/lib/exerciseSlugNormalizer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ArrowLeft, SkipForward, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DifficultyInfoBadge } from '@/components/DifficultyInfoBadge';
import { useExerciseConfig } from '@/hooks/useExerciseConfig';
import { useExerciseGating } from '@/hooks/useExerciseGating';
import { ExerciseAdaptationBanner } from '@/components/ExerciseAdaptationBanner';
import { supabase } from '@/integrations/supabase/client';
import { InlineSessionProgress } from '@/components/InlineSessionProgress';
import { SessionSidePanel } from '@/components/SessionSidePanel';
import { getTrialsByTargetWords, getMixedTrials } from '@/data/phonologicalBank';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';
import { useTrialSubmission } from '@/hooks/useTrialSubmission';
import {
  usePhonologicalAwarenessProgression,
  mapPhonologicalAwarenessSupport,
} from '@/hooks/usePhonologicalAwarenessProgression';
import { resolveEffectivePhonologicalAwarenessInitialDifficulty } from '@/lib/progression/phonologicalAwarenessDifficultyBridge';

const EXERCISE_SLUG = 'phonological_awareness';

export default function PhonologicalExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const { toast } = useToast();

  const restored = useRestoredLessonContext('phonological-awareness');
  const { fromLesson, returnTo } = restored;
  const lessonSessionId = restored.sessionId;
  const lessonAdaptations = restored.adaptations;
  const lessonFocusPhonemes = location.state?.focusPhonemes as string[] | undefined;

  const adaptation = useSessionAdaptation({
    lessonAdaptations,
    lessonFocusPhonemes,
  });
  const adaptationTelemetry = buildAdaptationTelemetry(adaptation, {
    phonemeSensitive: true,
  });

  const pivot = useExerciseMidSessionPivot({ exerciseSlug: 'phonological-awareness', domainSlug: 'phonology', fromLesson });

  const searchParams = new URLSearchParams(location.search);
  const targetedWords = searchParams.get('targets')?.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) || [];
  const practiceSource = searchParams.get('source') || null;

  const [clinicalProfile, setClinicalProfile] = useState<any>(null);
  const scoreRef = useRef(0);
  const trialsRef = useRef(0);
  const trialIndexRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  const { activeSessionId, isCreatingSession } = useStandaloneSession(user?.id, lessonSessionId, EXERCISE_SLUG);

  // Wave 3: Clinical Progression v1 — phonological-awareness L1–L8 ladder.
  // Receptive-safe: submitTrial emits trialMode:'recognition' and the
  // slug is intentionally NOT in ADOPTED_TRIAL_MODE_SLUGS.
  const progression = usePhonologicalAwarenessProgression({
    userId: user?.id,
    profileId: activeProfile?.id,
  });
  const bridge = resolveEffectivePhonologicalAwarenessInitialDifficulty({
    sessionAdaptationDifficulty: adaptation.difficultyTier,
    clinicalLevel: progression.startingLevel,
    supportBaseline: progression.state?.supportBaseline ?? 0,
  });
  if (import.meta.env.DEV && bridge.softRegressionScaffold) {
    console.log(
      `[SoftRegression] PhonologicalAwareness scaffolding active — supportBaseline=${progression.state?.supportBaseline} ` +
        `lowered floor by 1 (clinicalLevel=${progression.startingLevel}, floor=${bridge.clinicalFloor}, effective=${bridge.effective})`,
    );
  }

  const customTrials = useMemo(() => {
    if (targetedWords.length > 0) {
      return getTrialsByTargetWords(targetedWords, 10);
    }
    if (adaptation.focusPhonemes.length > 0 && !adaptation.loading) {
      return getMixedTrials(adaptation.difficultyTier, 30, { focusPhonemes: adaptation.focusPhonemes });
    }
    return undefined;
  }, [targetedWords.join(','), adaptation.focusPhonemes.join(','), adaptation.difficultyTier, adaptation.loading]);

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

  const { config, hasCapabilityAdaptations, bounds } = useExerciseConfig(
    'phonological-awareness',
    user?.id,
    clinicalProfile,
    null
  );

  const { getAdaptations } = useExerciseGating(user?.id, undefined);

  // Apply clinical-floor override on top of the engine config.
  const effectiveConfig = useMemo(() => ({
    ...config,
    startDifficulty: Math.max(config.startDifficulty || 1, bridge.effective),
  }), [config, bridge.effective]);

  const getSessionStats = useCallback(() => ({
    score: scoreRef.current,
    totalTrials: trialsRef.current,
    startTime: startTimeRef.current,
  }), []);

  const { completeSession } = useSessionLifecycle({
    sessionId: activeSessionId,
    userId: user?.id,
    profileId: activeProfile?.id,
    exerciseSlug: EXERCISE_SLUG,
    getSessionStats,
  });

  // Wave 3: unified trial submission (receptive-safe). PhonologicalGame
  // had useExerciseTelemetry.logTrial removed; this page is the single
  // writer for exercise_events + progression buffering.
  const { submitTrial, commitSession } = useTrialSubmission({
    userId: user?.id,
    profileId: activeProfile?.id,
    sessionId: activeSessionId,
    exerciseSlug: EXERCISE_SLUG,
    progression,
  });

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
          session_id: activeSessionId,
          exercise_slug: CANONICAL_SLUGS.PHONOLOGICAL,
          skip_reason: 'too_difficult',
          from_lesson: fromLesson,
          clinical_snapshot: profile?.clinical_profile
        });
      } catch (error) {
        console.error('Error logging skip:', error);
      }
    }
    toast({ title: 'Exercise skipped', description: 'Moving to next activity' });
    window.dispatchEvent(new CustomEvent('exercise-complete'));
    navigate(returnTo, { state: { resuming: true } });
  };

  const handleTrialComplete = useCallback(async (detail: PhonologicalTrialDetail) => {
    if (!activeSessionId) return;
    trialsRef.current += 1;
    trialIndexRef.current += 1;
    if (detail.correct) scoreRef.current += 1;

    pivot.recordTrialResult({
      wasCorrect: detail.correct,
      reactionTimeMs: detail.reactionTime,
    });

    await submitTrial({
      profileId: activeProfile?.id,
      sessionId: activeSessionId,
      gameId: EXERCISE_SLUG,
      level: detail.difficulty,
      stimulusId: detail.trial?.id ?? `pa_trial_${trialIndexRef.current}`,
      expectedResponse: detail.expectedAnswer,
      userResponse: detail.userAnswer,
      isCorrect: detail.correct,
      accuracyScore: detail.correct ? 1 : 0,
      cueLevel: 0,
      supportUsed: mapPhonologicalAwarenessSupport(),
      latencyMs: detail.reactionTime,
      trialMode: 'recognition',
      errorType: detail.correct ? undefined : 'phonological_error',
      taskParameters: {
        // This page owns the adaptation_trial_logs writer (game is autoLog:false).
        unified_route_adaptation_log: true,
        difficulty: detail.difficulty,
        word1: detail.trial?.word1,
        word2: detail.trial?.word2,
        relation_type: detail.relationType,
        phoneme_differences: detail.trial?.phonemeDifferences,
        pivot_pending: pivot.hasPending,
        clinical_level: progression.startingLevel,
        clinical_floor: bridge.clinicalFloor,
        ...adaptationTelemetry,
      },
    });

    if (pivot.shouldStepDown) { console.log('[PhonologicalAwareness] Pivot: step down', pivot.pivotReason); pivot.acknowledge(); }
  }, [activeSessionId, submitTrial, adaptationTelemetry, pivot, activeProfile?.id, progression.startingLevel, bridge.clinicalFloor]);

  const handleGameComplete = useCallback(async (finalScore: number, totalTrials: number) => {
    if (!activeSessionId || !user?.id) return;
    // Unified commit BEFORE session-end housekeeping — flushes the L1–L8
    // progression ladder + mastery shadow + drains adaptation rows.
    await commitSession();
    completeSession();

    const accuracy = (finalScore / totalTrials) * 100;
    toast({
      title: 'Session saved!',
      description: `You completed ${totalTrials} trials with ${accuracy.toFixed(0)}% accuracy.`,
    });

    if (fromLesson) {
      window.dispatchEvent(new CustomEvent('exercise-complete'));
      navigate(returnTo, { state: { resuming: true } });
    } else {
      setTimeout(() => navigate('/today'), 2000);
    }
  }, [activeSessionId, user?.id, commitSession, completeSession, fromLesson, navigate, returnTo, toast]);

  if (isCreatingSession || !activeSessionId) {
    return <ExerciseLoading />;
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {fromLesson && <SessionSidePanel />}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/today')}>
            <ArrowLeft className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Back</span>
          </Button>
          <h1 className="text-lg font-semibold">Phonological Awareness</h1>
          <div className="flex items-center gap-1">
            {fromLesson && (
              <Button variant="ghost" size="sm" onClick={handleSkipExercise} className="text-orange-600 text-xs">
                <SkipForward className="w-3.5 h-3.5 mr-1" />Skip
              </Button>
            )}
            <DifficultyInfoBadge level={effectiveConfig.startDifficulty || 1} floor={bounds.floor} ceiling={bounds.ceiling} />
          </div>
        </div>
        {fromLesson && <InlineSessionProgress />}
      </header>

      <main className="container px-4 py-2 flex-1 flex flex-col overflow-y-auto pb-16">
        <div className="max-w-6xl mx-auto space-y-4">
          {lessonAdaptations && Object.keys(lessonAdaptations).length > 0 && (
            <div className="hidden sm:flex flex-wrap gap-1.5 mb-2">
              {lessonAdaptations.timeoutMultiplier && lessonAdaptations.timeoutMultiplier !== 1 && (
                <Badge variant="secondary" className="text-xs">Timeout ×{lessonAdaptations.timeoutMultiplier}</Badge>
              )}
              {lessonAdaptations.startDifficulty && (
                <Badge variant="secondary" className="text-xs">Start Lv {lessonAdaptations.startDifficulty}</Badge>
              )}
              {lessonAdaptations.slowerTTS && (
                <Badge variant="secondary" className="text-xs">Slower TTS</Badge>
              )}
            </div>
          )}

          {targetedWords.length > 0 && (
            <Card className="hidden sm:block p-3 bg-primary/10 border-primary/20">
              <div className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4 text-primary" />
                <span className="font-medium">Targeted Practice:</span>
                <span className="text-muted-foreground">
                  Focusing on sounds in {targetedWords.slice(0, 3).join(', ')}{targetedWords.length > 3 ? ` +${targetedWords.length - 3} more` : ''}
                </span>
              </div>
            </Card>
          )}

          {hasCapabilityAdaptations && (
            <ExerciseAdaptationBanner
              adaptation={getAdaptations('phonological-awareness')}
              showDetails={true}
            />
          )}

          {progression.loaded ? (
            <PhonologicalGame
              totalTrials={10}
              config={effectiveConfig}
              bounds={bounds}
              adaptations={getAdaptations('phonological-awareness')}
              customTrials={customTrials}
              userId={user?.id}
              sessionId={activeSessionId}
              onGameComplete={handleGameComplete}
              onTrialComplete={handleTrialComplete}
            />
          ) : (
            <ExerciseLoadGate inline loadingLabel="Loading your progression…" />
          )}
        </div>
      </main>
    </div>
  );
}
