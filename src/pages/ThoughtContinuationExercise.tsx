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
  
  const [gameStarted, setGameStarted] = useState(fromLesson);
  const [sessionSummary, setSessionSummary] = useState<{
    totalPrompts: number;
    promptsSpoken: number;
    avgMomentumScore: number;
    completedThoughts: number;
  } | null>(null);

  const pivot = useExerciseMidSessionPivot({ exerciseSlug: EXERCISE_SLUG, domainSlug: 'discourse_organization', fromLesson });

  const handleStart = () => {
    setGameStarted(true);
  };

  const handleComplete = (summary: {
    totalPrompts: number;
    promptsSpoken: number;
    avgMomentumScore: number;
    completedThoughts: number;
  }) => {
    setSessionSummary(summary);
    setGameStarted(false);
    promptsRef.current = summary.promptsSpoken;
    void completeSession();

    // Auto-return to lesson flow
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
    setSessionSummary(null);
    setGameStarted(true);
  };

  // Not logged in
  if (!user?.id || !activeProfile?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
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

  // Show summary after completion
  if (sessionSummary) {
    const percentSpoken = sessionSummary.totalPrompts > 0
      ? Math.round((sessionSummary.promptsSpoken / sessionSummary.totalPrompts) * 100)
      : 0;
    
    return (
      <div className="min-h-screen bg-background p-4">
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
            userId={user.id}
            profileId={activeProfile.id}
            sessionId={activeSessionId}
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
    <div className="min-h-screen bg-background p-4">
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
              Practice completing thoughts at your own pace.
              There are no wrong answers — just keep it moving.
            </p>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-primary">1</span>
                </div>
                <p className="text-muted-foreground">You'll see a prompt like "Talk about the last thing you ate"</p>
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
            
            <Button onClick={handleStart} className="w-full" size="lg">
              Start Practice
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
