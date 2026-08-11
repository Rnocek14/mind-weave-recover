import React, { useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, MessageCircle, Volume2, Mic } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { ConversationPartnerGame } from '@/components/ConversationPartnerGame';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { InlineSessionProgress } from '@/components/InlineSessionProgress';
import { SessionSidePanel } from '@/components/SessionSidePanel';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';

interface SessionSummary {
  turnsCompleted: number;
  avgLatencyMs: number;
  completionRate: number;
  userAIRatio: number;
}

export default function ConversationPartnerExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { activeProfile, loading: profileLoading } = useProfile();
  const [gameStarted, setGameStarted] = useState(false);
  const autoStartedRef = React.useRef(false);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);

  const restored = useRestoredLessonContext('conversation-partner');
  const { fromLesson, returnTo } = restored;
  const providedSessionId = restored.sessionId;
  const lessonAdaptations = restored.adaptations;
  const exerciseCompleteSentRef = useRef(false);

  const pivot = useExerciseMidSessionPivot({ exerciseSlug: 'conversation-partner', domainSlug: 'discourse_organization', fromLesson });

  const { activeSessionId, isCreatingSession } = useStandaloneSession(
    user?.id,
    providedSessionId,
    'conversation-partner'
  );

  // Close the session we open (was only ever ended by the stale-session
  // sweeper). Parent-owned lesson sessions are auto-detected and left alone.
  const sessionStartRef = useRef(Date.now());
  const turnsRef = useRef(0);
  const getSessionStats = useCallback(() => ({
    score: 0, // conversation_partner is accuracy-excluded; turns are the dose signal
    totalTrials: turnsRef.current,
    startTime: sessionStartRef.current,
  }), []);
  const { completeSession } = useSessionLifecycle({
    sessionId: activeSessionId,
    userId: user?.id,
    profileId: activeProfile?.id,
    exerciseSlug: 'conversation-partner',
    getSessionStats,
  });

  // Shared adaptation contract
  const adaptation = useSessionAdaptation({
    exerciseSlug: 'conversation-partner',
    lessonAdaptations,
    defaultErrorType: 'no_response',
  });
  const adaptationTelemetry = buildAdaptationTelemetry(adaptation, {
    cueSensitive: true,
  });

  // Auto-start when launched from lesson flow
  React.useEffect(() => {
    if (fromLesson && !autoStartedRef.current && !gameStarted && !authLoading && !profileLoading && user && activeSessionId) {
      autoStartedRef.current = true;
      setGameStarted(true);
    }
  }, [fromLesson, gameStarted, authLoading, profileLoading, user, activeSessionId]);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  const handleStart = () => {
    setGameStarted(true);
  };

  const handleComplete = (summary: SessionSummary) => {
    setSessionSummary(summary);
    turnsRef.current = summary.turnsCompleted;
    void completeSession();

    // Auto-return to lesson flow
    if (fromLesson && !exerciseCompleteSentRef.current) {
      exerciseCompleteSentRef.current = true;
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('exercise-complete', {
          detail: { exerciseSlug: 'conversation-partner', results: summary },
        }));
        navigate(returnTo, { state: { resuming: true }, replace: true });
      }, 400);
    }
  };

  const handleExit = () => {
    navigate(fromLesson ? returnTo : '/dashboard');
  };

  const handleContinue = () => {
    if (fromLesson && !exerciseCompleteSentRef.current) {
      exerciseCompleteSentRef.current = true;
      window.dispatchEvent(new CustomEvent('exercise-complete', {
        detail: { exerciseSlug: 'conversation-partner' },
      }));
      navigate(returnTo, { state: { resuming: true } });
    } else {
      navigate('/today');
    }
  };

  const handlePlayAgain = () => {
    setGameStarted(false);
    setSessionSummary(null);
  };

  // Summary screen
  if (sessionSummary) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto space-y-6 pt-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExit}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {fromLesson ? 'Back to Lesson' : 'Back'}
          </Button>

          <Card>
            <CardContent className="p-6 text-center space-y-6">
              <div className="text-5xl">🎉</div>
              <h2 className="text-xl font-semibold">Great conversation!</h2>
              
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">
                    {sessionSummary.turnsCompleted}
                  </div>
                  <div className="text-sm text-muted-foreground">turns completed</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">
                    {Math.round(sessionSummary.completionRate)}%
                  </div>
                  <div className="text-sm text-muted-foreground">completion</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">
                    {sessionSummary.avgLatencyMs > 0 
                      ? `${(sessionSummary.avgLatencyMs / 1000).toFixed(1)}s`
                      : '—'}
                  </div>
                  <div className="text-sm text-muted-foreground">avg start time</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">
                    {Math.round(sessionSummary.userAIRatio)}%
                  </div>
                  <div className="text-sm text-muted-foreground">your talk time</div>
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                {fromLesson ? (
                  <Button onClick={handleContinue}>
                    Continue Lesson
                  </Button>
                ) : (
                  <>
                    <Button onClick={handlePlayAgain}>
                      Talk Again
                    </Button>
                    <Button variant="outline" onClick={() => navigate('/today')}>
                      Done
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

  // Start screen
  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto space-y-6 pt-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExit}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {fromLesson ? 'Back to Lesson' : 'Back'}
          </Button>

          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <MessageCircle className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Free Talk</h1>
            <p className="text-muted-foreground">
              Practice having a short conversation. I'll ask simple questions and listen.
            </p>
          </div>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-medium">How it works:</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <Volume2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>I'll ask you a simple question</span>
                </li>
                <li className="flex items-start gap-3">
                  <Mic className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Press the button to talk, then press again when done</span>
                </li>
                <li className="flex items-start gap-3">
                  <MessageCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>We'll go back and forth 3 times</span>
                </li>
              </ul>
              
              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <strong>No wrong answers.</strong> Just talk naturally. Take your time.
              </div>

              <Button 
                className="w-full" 
                size="lg"
                onClick={handleStart}
                disabled={isCreatingSession}
              >
                {isCreatingSession ? 'Preparing...' : 'Start Conversation'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Game screen
  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="border-b shrink-0">
        <div className="flex items-center justify-between px-4 h-14">
           <Button variant="ghost" size="sm" onClick={handleExit}>
            <ArrowLeft className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Back</span>
          </Button>
          <h1 className="text-lg font-semibold">Free Talk</h1>
          <div className="w-16" />
        </div>
        {fromLesson && <InlineSessionProgress />}
      </header>

      <main className="flex-1 p-4 flex flex-col overflow-y-auto pb-16">
        <div className="max-w-md mx-auto">
          <ConversationPartnerGame
            userId={user.id}
            profileId={activeProfile?.id || ''}
            sessionId={activeSessionId}
            onComplete={handleComplete}
            onExit={handleExit}
          />
        </div>
      </main>
      {fromLesson && <SessionSidePanel />}
    </div>
  );
}
