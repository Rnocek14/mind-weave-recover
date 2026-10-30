import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PatternMatchGame } from '@/components/PatternMatchGame';
import { useAuth } from '@/hooks/useAuth';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useTrialSubmission } from '@/hooks/useTrialSubmission';
import { useVerifiedExerciseCompletion } from '@/hooks/useVerifiedExerciseCompletion';
import { ExerciseSaveFeedback } from '@/components/exercise/ExerciseSaveFeedback';
import { ExerciseLoading } from '@/components/exercise/ExerciseLoading';
import { CANONICAL_SLUGS } from '@/lib/exerciseSlugNormalizer';
import { Button } from '@/components/ui/button';
import { ArrowLeft, SkipForward } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LevelBadge } from '@/components/exercise/LevelBadge';
import { describeLevel } from '@/lib/gameLevels';
import { useExerciseConfig } from '@/hooks/useExerciseConfig';
import { useExerciseGating } from '@/hooks/useExerciseGating';
import { ExerciseAdaptationBanner } from '@/components/ExerciseAdaptationBanner';
import { supabase } from '@/integrations/supabase/client';
import { InlineSessionProgress } from '@/components/InlineSessionProgress';
import { SessionSidePanel } from '@/components/SessionSidePanel';
import { useProfile } from '@/hooks/useProfile';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';


export default function PatternMatchExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const { toast } = useToast();
  
  // Extract lesson flow state
  const restored = useRestoredLessonContext('pattern-match');
  const { fromLesson, returnTo } = restored;
  const lessonSessionId = restored.sessionId;
  const lessonAdaptations = restored.adaptations;
  const [clinicalProfile, setClinicalProfile] = useState<any>(null);
  const {
    activeSessionId: sessionId, isCreatingSession, sessionError, retrySession,
  } = useStandaloneSession(user?.id, lessonSessionId, 'pattern_match');
  const scoreRef = useRef(0);
  const trialsRef = useRef(0);
  const trialIndexRef = useRef(0);
  const sessionStartRef = useRef(Date.now());
  const lessonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (lessonTimerRef.current !== null) clearTimeout(lessonTimerRef.current);
  }, []);

  // UX1B: presentation-only "Today's Challenge" state. Mirrors the live
  // difficulty emitted by PatternMatchGame and a rolling success rate derived
  // from observed trial correctness. Does NOT feed adaptation/scoring/telemetry.
  const [currentChallenge, setCurrentChallenge] = useState<number>(3);
  const [recentResults, setRecentResults] = useState<boolean[]>([]);
  const challengeSuccessRate =
    recentResults.length >= 2
      ? recentResults.filter(Boolean).length / recentResults.length
      : null;

  // Shared adaptation contract
  const adaptation = useSessionAdaptation({
    lessonAdaptations,
    defaultErrorType: 'no_response',
  });
  const adaptationTelemetry = buildAdaptationTelemetry(adaptation);

  // A named attempt ID and the unified clinical pipeline preserve retries,
  // task accuracy and adaptation evidence without duplicate score rows.
  const { submitTrial, commitSession, retryFailedSubmissions } = useTrialSubmission({
    userId: user?.id, profileId: activeProfile?.id, sessionId,
    exerciseSlug: 'pattern_match', progression: null,
  });

  const pivot = useExerciseMidSessionPivot({ exerciseSlug: 'pattern-match', domainSlug: 'executive_function', fromLesson });
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
    'pattern-match',
    user?.id,
    activeProfile?.id,
    clinicalProfile,
    null
  );
  
  const { getAdaptations } = useExerciseGating(user?.id, activeProfile?.id);

  // Seed the displayed challenge from config until the first trial reports live difficulty.
  useEffect(() => {
    if (config?.startDifficulty) setCurrentChallenge(config.startDifficulty);
  }, [config?.startDifficulty]);

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
          exercise_slug: CANONICAL_SLUGS.PATTERN_MATCH,
          skip_reason: 'too_difficult',
          from_lesson: fromLesson,
          clinical_snapshot: profile?.clinical_profile
        });
      } catch (error) {
        console.error('Error logging skip:', error);
      }
    }

    toast({
      title: "Exercise skipped",
      description: "Moving to next activity",
    });
    
    window.dispatchEvent(new CustomEvent('exercise-complete'));
    navigate(returnTo, { state: { resuming: true } });
  };

  const getSessionStats = useCallback(() => ({
    score: scoreRef.current,
    totalTrials: trialsRef.current,
    startTime: sessionStartRef.current,
  }), []);
  const { completeSession } = useSessionLifecycle({
    sessionId, userId: user?.id, profileId: activeProfile?.id,
    exerciseSlug: 'pattern_match', getSessionStats,
  });

  const onConfirmed = useCallback((finalScore: number) => {
    if (!fromLesson) return;
    lessonTimerRef.current = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('exercise-complete', {
        detail: { exerciseSlug: 'pattern_match', finalScore },
      }));
      navigate(returnTo, { state: { resuming: true }, replace: true });
    }, 400);
  }, [fromLesson, navigate, returnTo]);

  const { saveState, finish, retry } = useVerifiedExerciseCompletion<number>({
    scope: user?.id && activeProfile?.id && sessionId
      ? JSON.stringify([user.id, activeProfile.id, sessionId, 'pattern_match'])
      : null,
    commitSession,
    completeSession,
    retryFailedSubmissions,
    onConfirmed,
  });

  const handleGameComplete = (finalScore: number) => {
    void finish(finalScore);
  };

  const handleTrialComplete = (data: {
    correct: boolean;
    difficultyLevel: number;
    reactionTimeMs: number;
    patternSize: number;
  }) => {
    if (!sessionId) return;
    trialIndexRef.current++;
    trialsRef.current++;
    scoreRef.current += data.correct ? 100 : 0;
    setCurrentChallenge(data.difficultyLevel);
    setRecentResults(previous => [...previous, data.correct].slice(-5));
    void submitTrial({
      profileId: activeProfile?.id,
      sessionId,
      gameId: 'pattern_match',
      level: data.difficultyLevel,
      stimulusId: `pattern_trial_${trialIndexRef.current}`,
      trialIndex: trialIndexRef.current,
      isCorrect: data.correct,
      accuracyScore: data.correct ? 1 : 0,
      cueLevel: 0,
      supportUsed: 'recognition_only',
      latencyMs: data.reactionTimeMs,
      trialMode: 'recognition',
      errorType: data.correct ? undefined : 'pattern_mismatch',
      taskParameters: {
        unified_route_adaptation_log: true,
        difficulty_level: data.difficultyLevel,
        pattern_size: data.patternSize,
        ...adaptationTelemetry,
      },
    });
  };

  if (isCreatingSession || !sessionId) {
    return <ExerciseLoading error={sessionError} onRetry={sessionError ? retrySession : undefined} />;
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {fromLesson && <SessionSidePanel />}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/today')}>
            <ArrowLeft className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Back</span>
          </Button>
          <h1 className="text-lg font-semibold">Pattern Match</h1>
          <div className="flex items-center gap-1">
            {fromLesson && (
              <Button variant="ghost" size="sm" onClick={handleSkipExercise} className="text-orange-600 text-xs">
                <SkipForward className="w-3.5 h-3.5 mr-1" />Skip
              </Button>
            )}
            <LevelBadge descriptor={describeLevel(currentChallenge)} compact successRate={challengeSuccessRate} />
          </div>
        </div>
        {fromLesson && <InlineSessionProgress />}
      </header>

      <main className="container px-4 py-2 flex-1 flex flex-col overflow-y-auto pb-16">
        {saveState === 'saving' || saveState === 'error' ? (
          <ExerciseSaveFeedback state={saveState} onRetry={() => void retry()} onExit={() => navigate('/today')} />
        ) : saveState === 'complete' ? (
          <div className="my-auto mx-auto w-full max-w-md space-y-5 px-4 text-center">
            <h2 className="text-2xl font-bold">Practice saved</h2>
            <Button size="lg" className="min-h-14 w-full text-lg" onClick={() => navigate('/today')}>Go to Today</Button>
          </div>
        ) : (
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-center space-y-4">

        {/* Capability Adaptation Banner */}
        {hasCapabilityAdaptations && (
          <ExerciseAdaptationBanner 
            adaptation={getAdaptations('pattern-match')} 
            showDetails={true}
          />
        )}

        {/* Game */}
        <PatternMatchGame
          key={JSON.stringify([user?.id, activeProfile?.id, sessionId])}
          totalTrials={10}
          initialDifficulty={config.startDifficulty || 3}
          bounds={bounds}
          slowMode={true}
          onGameComplete={handleGameComplete}
          onTrialComplete={handleTrialComplete}
          userId={user?.id}
          sessionId={sessionId}
        />
        </div>
        )}
      </main>
    </div>
  );
}
