/**
 * Thought Continuation Exercise Page
 * 
 * A flow-based exercise for practicing finishing thoughts.
 * No right or wrong answers - only momentum and continuation.
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { ThoughtContinuationGame } from '@/components/ThoughtContinuationGame';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, MessageSquare, TrendingUp, CheckCircle2, Sparkles } from 'lucide-react';
import { InlineSessionProgress } from '@/components/InlineSessionProgress';
import { SessionSidePanel } from '@/components/SessionSidePanel';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';
import { useThoughtContinuationTrainingStage } from '@/hooks/useThoughtContinuationTrainingStage';
import { getThoughtTrainingStage, type ThoughtTrainingStageLevel } from '@/lib/thoughtContinuation/trainingStages';
import { confirmRawEventWrites } from '@/lib/trial/confirmRawEventWrites';
import { UnverifiedPracticeBanner } from '@/components/exercise/UnverifiedPracticeBanner';

const EXERCISE_SLUG = 'thought_continuation';

export default function ThoughtContinuationExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  
  // Lesson flow integration with sessionStorage fallback
  const restored = useRestoredLessonContext(EXERCISE_SLUG);
  const { fromLesson, returnTo } = restored;
  const providedSessionId = restored.sessionId;
  const lessonAdaptations = restored.adaptations;
  const exerciseCompleteSentRef = useRef(false);
  
  const { activeSessionId, isCreatingSession } = useStandaloneSession(user?.id, providedSessionId, EXERCISE_SLUG);

  const isOfflineMode = typeof window !== 'undefined' && localStorage.getItem('offlineMode') === 'true';
  const training = useThoughtContinuationTrainingStage({
    userId: user?.id,
    profileId: activeProfile?.id,
    offline: isOfflineMode,
  });
  // Practice override is deliberately local to the patient and THIS session;
  // selecting another stage must not write the saved clinical level.
  const scope = JSON.stringify([user?.id ?? null, activeProfile?.id ?? null, activeSessionId ?? null]);
  const [stageChoice, setStageChoice] = useState<{ scope: string; level: ThoughtTrainingStageLevel } | null>(null);
  const caregiverSelected = stageChoice?.scope === scope;
  const activeStage = caregiverSelected
    ? getThoughtTrainingStage(stageChoice.level)
    : training.stage;
  const practiceStageSource = caregiverSelected ? 'care_partner_selection' as const :
    activeStage ? 'saved_level' as const : 'general_practice' as const;
  const pendingEventWritesRef = useRef<Promise<boolean>[]>([]);
  const completionRequestedRef = useRef(false);
  const [saveWarning, setSaveWarning] = useState(false);
  const handleRawEventWrite = useCallback((pending: Promise<boolean>) => {
    pendingEventWritesRef.current.push(pending);
  }, []);

  // Close the session we open (was only ever ended by the stale-session
  // sweeper). Parent-owned lesson sessions are auto-detected and left alone.
  const sessionStartRef = useRef(Date.now());
  const promptsRef = useRef(0);
  const getSessionStats = useCallback(() => ({
    score: 0, // open-ended discourse task — prompts spoken are the dose signal
    totalTrials: promptsRef.current,
    startTime: sessionStartRef.current,
  }), []);
  const { completeSession } = useSessionLifecycle({
    sessionId: activeSessionId,
    userId: user?.id,
    profileId: activeProfile?.id,
    exerciseSlug: EXERCISE_SLUG,
    getSessionStats,
  });

  // Shared adaptation contract
  const adaptation = useSessionAdaptation({
    exerciseSlug: EXERCISE_SLUG,
    lessonAdaptations,
    defaultErrorType: 'no_response',
  });
  const adaptationTelemetry = buildAdaptationTelemetry(adaptation);
  
  // Scope both UI state and completed summaries so changing the selected
  // patient never reuses an old patient's in-progress gameplay or results.
  const [gameState, setGameState] = useState<{ scope: string; started: boolean }>({
    scope: '', started: fromLesson,
  });
  const gameStarted = gameState.scope === scope ? gameState.started : fromLesson;
  type Summary = { totalPrompts: number; promptsSpoken: number;
    avgMomentumScore: number; completedThoughts: number };
  const [scopedSummary, setScopedSummary] = useState<{ scope: string; summary: Summary } | null>(null);
  const sessionSummary = scopedSummary?.scope === scope ? scopedSummary.summary : null;

  const pivot = useExerciseMidSessionPivot({ exerciseSlug: EXERCISE_SLUG, domainSlug: 'discourse_organization', fromLesson });

  const handleStart = () => {
    if (!training.loaded || (!isOfflineMode && !activeSessionId)) return;
    pendingEventWritesRef.current = [];
    completionRequestedRef.current = false;
    setSaveWarning(false);
    setGameState({ scope, started: true });
  };

  const handleComplete = async (summary: Summary) => {
    if (completionRequestedRef.current) return;
    completionRequestedRef.current = true;
    // The staged game registers the promise synchronously for each attempted
    // round. A successful UI celebration is NOT a confirmed database write.
    if (activeStage && !isOfflineMode) {
      const saved = await confirmRawEventWrites(
        pendingEventWritesRef.current.splice(0), summary.totalPrompts,
      );
      if (!saved.ok) {
        setSaveWarning(true);
        return; // No clinical completion or lesson handoff on missing evidence.
      }
    }
    promptsRef.current = summary.promptsSpoken;
    await completeSession();
    setScopedSummary({ scope, summary });
    setGameState({ scope, started: false });

    if (fromLesson && !exerciseCompleteSentRef.current) {
      exerciseCompleteSentRef.current = true;
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('exercise-complete', {
          detail: { exerciseSlug: 'thought-continuation', results: summary },
        }));
        navigate(returnTo, { state: { resuming: true }, replace: true });
      }, 400);
    }
  };

  const handleExit = () => {
    navigate(fromLesson ? returnTo : '/dashboard');
  };

  const handleBack = useCallback(() => {
    navigate(fromLesson ? returnTo : '/dashboard');
  }, [navigate, fromLesson]);

  const handleContinue = useCallback(() => {
    if (fromLesson && !exerciseCompleteSentRef.current) {
      exerciseCompleteSentRef.current = true;
      window.dispatchEvent(new CustomEvent('exercise-complete', {
        detail: { exerciseSlug: 'thought-continuation' },
      }));
      navigate(returnTo, { state: { resuming: true } });
    } else if (!fromLesson) {
      navigate('/today');
    }
  }, [fromLesson, navigate]);

  const handlePlayAgain = () => {
    setScopedSummary(null);
    setSaveWarning(false);
    completionRequestedRef.current = false;
    pendingEventWritesRef.current = [];
    setGameState({ scope, started: true });
  };

  // Not logged in
  if (!user?.id || !activeProfile?.id) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Please log in to continue.</p>
            <Button onClick={() => navigate('/auth')} className="mt-4">
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isOfflineMode && (isCreatingSession || !activeSessionId)) {
    return <div role="status" className="p-8 text-center">Preparing practice session…</div>;
  }
  if (!training.loaded) {
    return <div role="status" className="p-8 text-center">Loading your practice stage…</div>;
  }
  if (saveWarning) {
    return (
      <div className="mx-auto max-w-md p-8 space-y-4">
        <UnverifiedPracticeBanner />
        <Button variant="outline" onClick={handleBack}>Return home</Button>
      </div>
    );
  }

  // Show summary after completion
  if (sessionSummary) {
    const percentSpoken = sessionSummary.totalPrompts > 0
      ? Math.round((sessionSummary.promptsSpoken / sessionSummary.totalPrompts) * 100)
      : 0;
    
    return (
      <div className="min-h-dvh bg-background p-4">
        <div className="max-w-md mx-auto pt-12">
          <Card className="border-2 border-primary/20">
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <CardTitle className="text-2xl">Great Session!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-3xl font-bold text-primary">{sessionSummary.promptsSpoken}</p>
                  <p className="text-sm text-muted-foreground">Thoughts shared</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-3xl font-bold text-primary">{sessionSummary.completedThoughts}</p>
                  <p className="text-sm text-muted-foreground">Complete thoughts</p>
                </div>
              </div>
              
              {sessionSummary.avgMomentumScore > 0.6 && (
                <div className="flex items-center gap-2 justify-center text-green-600 dark:text-green-400">
                  <Sparkles className="w-5 h-5" />
                  <span className="font-medium">Smooth flow today!</span>
                </div>
              )}
              
              <p className="text-center text-muted-foreground">
                You kept {percentSpoken}% of your thoughts moving. That's what matters.
              </p>
              
              <div className="flex flex-col gap-3">
                {fromLesson ? (
                  <p className="text-sm text-muted-foreground animate-pulse">Loading next exercise…</p>
                ) : (
                  <>
                    <Button onClick={handlePlayAgain} className="w-full gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Practice More
                    </Button>
                    <Button variant="outline" onClick={() => navigate('/today')} className="w-full">
                      Back to Home
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        {fromLesson && <SessionSidePanel />}
      </div>
    );
  }

  // Game in progress
  if (gameStarted) {
    return (
      <div className="min-h-dvh bg-background flex flex-col">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4">
          <div className="flex items-center justify-between max-w-xl mx-auto h-14">
            <Button variant="ghost" size="sm" onClick={handleExit}>
              <ArrowLeft className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Exit</span>
            </Button>
            <h1 className="text-lg font-semibold">Finish the Thought</h1>
            <div className="w-16" />
          </div>
          {fromLesson && <InlineSessionProgress />}
        </header>
        
        <main className="pt-6">
          <ThoughtContinuationGame
            key={scope}
            userId={user.id}
            profileId={activeProfile.id}
            sessionId={activeSessionId}
            trainingStage={activeStage}
            practiceStageSource={practiceStageSource}
            onRawEventWrite={handleRawEventWrite}
            onComplete={handleComplete}
            onExit={handleExit}
          />
        </main>
        {fromLesson && <SessionSidePanel />}
      </div>
    );
  }

  // Start screen
  return (
    <div className="min-h-dvh bg-background p-4">
      <div className="max-w-md mx-auto pt-8">
        <Button 
          variant="ghost" 
          onClick={handleBack} 
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {fromLesson ? 'Back to Lesson' : 'Back'}
        </Button>
        
        <Card className="border-2 border-primary/20">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-10 h-10 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Finish the Thought</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-center text-muted-foreground">
              Practice continuing everyday thoughts at your own pace.
              A short answer is enough to begin.
            </p>
            <div className="rounded-md bg-muted/50 p-3 space-y-1 text-sm">
              {activeStage ? (
                <>
                  <p className="font-medium">Practice Stage {activeStage.level}: {activeStage.label}</p>
                  <p className="text-muted-foreground">{activeStage.instructions}</p>
                  <p className="text-muted-foreground">Practice format only — not a clinical level-up.</p>
                </>
              ) : training.loadUnavailable ? (
                <p role="status">
                  Your saved level could not be checked. General practice is available,
                  or a care partner can choose a stage. No saved level will be changed.
                </p>
              ) : (
                <p role="status">
                  Your saved clinical level {training.persistedLevel ?? 'is unavailable'} does not
                  yet have a dedicated practice stage. General practice remains available;
                  stages 4–8 are still being developed.
                </p>
              )}
            </div>
            
            {!fromLesson && (
              <details className="rounded-md border p-3 text-sm">
                <summary className="cursor-pointer font-medium">
                  Care partner: choose practice stage
                </summary>
                <p className="mt-2 text-muted-foreground">
                  Changes only this practice session, not the saved clinical level.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {([1, 2, 3] as const).map(level => {
                    const choice = getThoughtTrainingStage(level);
                    return (
                      <Button
                        key={level}
                        type="button"
                        variant={activeStage?.level === level ? 'default' : 'outline'}
                        aria-pressed={activeStage?.level === level}
                        onClick={() => setStageChoice({ scope, level })}
                      >
                        Stage {level}: {choice?.label}
                      </Button>
                    );
                  })}
                </div>
              </details>
            )}

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-primary">1</span>
                </div>
                <p className="text-muted-foreground">You'll hear a sentence or a short situation to continue</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-primary">2</span>
                </div>
                <p className="text-muted-foreground">Say whatever comes to mind — there's no "right" answer</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-primary">3</span>
                </div>
                <p className="text-muted-foreground">If you get stuck, tap "Give me a hint" for a gentle nudge</p>
              </div>
            </div>
            
            <Button onClick={handleStart} className="w-full" size="lg"
              disabled={!training.loaded || (!isOfflineMode && !activeSessionId)}>
              Start Practice
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
