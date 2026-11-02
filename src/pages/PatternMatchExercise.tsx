import { useState, useEffect, useRef } from 'react';
import { awaitPatternMatchWrites } from '@/lib/patternMatch/awaitPatternMatchWrites';
import { useNavigate, useLocation } from 'react-router-dom';
import { PatternMatchGame } from '@/components/PatternMatchGame';
import { useAuth } from '@/hooks/useAuth';
import { startSession, endSession } from '@/lib/sessionTracking';
import { CANONICAL_SLUGS } from '@/lib/exerciseSlugNormalizer';
import { Button } from '@/components/ui/button';
import { ArrowLeft, SkipForward, AlertCircle } from 'lucide-react';
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
import { useExerciseTelemetry } from '@/hooks/useExerciseTelemetry';

const PATTERN_TRIAL_COUNT = 10;

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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartTime] = useState(Date.now());
  const [clinicalProfile, setClinicalProfile] = useState<any>(null);
  // Guards handleGameStart so exactly one session is created per play start.
  const sessionStartedRef = useRef(false);
  const [sessionError, setSessionError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const finalizationStartedRef = useRef(false);
  const pendingTrialWritesRef = useRef<Promise<boolean>[]>([]);

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

  // Per-trial clinical telemetry (exercise_events). pattern-match was previously
  // "dark" — its onTrialComplete only console.logged, so no per-trial rows were
  // ever written. Wire the shared telemetry hook so each trial is persisted.
  const { logTrial: logPatternTrial } = useExerciseTelemetry(sessionId, 'pattern-match');

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

  const handleGameStart = async () => {
    if (!user?.id) return;
    // Idempotency guard: startSession is async, so the previous render-body
    // call pattern could fire repeatedly before sessionId state settled,
    // creating ~8 empty duplicate sessions in <1s. Latch on first invocation.
    if (sessionStartedRef.current) return;
    sessionStartedRef.current = true;
    setSessionError(false);

    try {
      if (fromLesson && lessonSessionId) {
        setSessionId(lessonSessionId);
      } else {
        const session = await startSession(user.id, {
          blocks: [{ exercise: 'pattern-match', duration: 8 }],
        });
        setSessionId(session.id);
      }
    } catch (error) {
      // Preserve a patient-visible recovery route instead of a stuck spinner.
      sessionStartedRef.current = false;
      setSessionError(true);
      console.error('Error starting pattern-match session:', error);
    }
  };

  const handleGameComplete = async (finalScore: number) => {
    if (finalizationStartedRef.current) return;
    finalizationStartedRef.current = true;
    setSaving(true);
    setSaveError(false);

    try {
      if (!sessionId || !user?.id) throw new Error('Missing session identity');

      // The old flow closed the session while raw exercise_events writes
      // were still pending. A green-looking completion could have no trials.
      const saveCheck = await awaitPatternMatchWrites(
        pendingTrialWritesRef.current,
        PATTERN_TRIAL_COUNT,
      );
      if (!saveCheck.ok) throw new Error('reason' in saveCheck ? saveCheck.reason : 'Raw attempt save failed');

      const accuracy = (finalScore / PATTERN_TRIAL_COUNT) * 100;
      // Guided sessions belong to the lesson: do not close the parent's
      // session mid-lesson. The overall lesson owns its final summary.
      if (!(fromLesson && lessonSessionId === sessionId)) {
        await endSession(sessionId, {
          durationSec: Math.floor((Date.now() - sessionStartTime) / 1000),
          scores: { 'pattern-match': accuracy },
          reps: PATTERN_TRIAL_COUNT,
        });
      }

      toast({
        title: 'Practice recorded',
        description: `You matched ${finalScore}/${PATTERN_TRIAL_COUNT} patterns (${accuracy.toFixed(0)}% practice accuracy).`,
      });

      if (fromLesson) {
        window.dispatchEvent(new CustomEvent('exercise-complete'));
        navigate(returnTo, { state: { resuming: true } });
      } else {
        setTimeout(() => navigate('/today'), 2000);
      }
    } catch (error) {
      setSaveError(true);
      // A failed raw write must not trigger a false "session saved" message.
      console.error('Pattern Match completion could not be verified:', error);
      toast({
        variant: 'destructive',
        title: 'Practice was not fully saved',
        description: 'Please ask your care partner for help. This attempt is not recorded as complete.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Start session on mount (guarded so only one session is ever created)
  useEffect(() => {
    if (!sessionId && user?.id) {
      handleGameStart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-center space-y-4">

        {/* Capability Adaptation Banner */}
        {hasCapabilityAdaptations && (
          <ExerciseAdaptationBanner 
            adaptation={getAdaptations('pattern-match')} 
            showDetails={true}
          />
        )}

        {/* Game: never start trials before an owned session is ready. */}
        {!user?.id || !activeProfile?.id ? (
          <div role="status" className="p-6 text-center">Sign in and select a patient profile before practicing.</div>
        ) : sessionError ? (
          <div role="alert" className="p-6 text-center space-y-3">
            <AlertCircle className="mx-auto" aria-hidden="true" />
            <p>We could not start your practice session.</p>
            <Button onClick={() => void handleGameStart()}>Try again</Button>
          </div>
        ) : !sessionId ? (
          <div role="status" className="p-6 text-center">Preparing your practice session…</div>
        ) : saving ? (
          <div role="status" className="p-6 text-center">Saving your practice…</div>
        ) : saveError ? (
          <div role="alert" className="p-6 text-center">Your practice could not be fully saved. Please ask a care partner for help.</div>
        ) : (
        <PatternMatchGame
          totalTrials={PATTERN_TRIAL_COUNT}
          initialDifficulty={config.startDifficulty || 3}
          bounds={bounds}
          slowMode={true}
          onGameComplete={handleGameComplete}
          onTrialComplete={(data) => {
            // UX1B presentation-only: mirror live difficulty + rolling success.
            setCurrentChallenge(data.difficultyLevel);
            setRecentResults((prev) => [...prev, data.correct].slice(-5));
            const pendingWrite = logPatternTrial({
              correct: data.correct,
              reactionTimeMs: data.reactionTimeMs,
              cueLevel: 0,
              errorType: data.correct ? undefined : 'pattern_mismatch',
              taskParameters: {
                difficulty_level: data.difficultyLevel,
                pattern_size: data.patternSize,
                trial_mode: 'recognition',
                ...adaptationTelemetry,
              },
            });
            pendingTrialWritesRef.current.push(pendingWrite);
          }}
          userId={user?.id}
          sessionId={sessionId}
        />
        )}
        </div>
      </main>
    </div>
  );
}
