/**
 * Describe & Guess Exercise Page
 * 
 * Flagship circumlocution training — wrapper with session lifecycle.
 * Now consumes shared adaptation contract.
 */

import React, { useCallback, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DescribeGuessGame } from '@/components/DescribeGuessGame';
import { DescribeGuessTrialResult } from '@/hooks/useDescribeGuessGame';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useExerciseTelemetry } from '@/hooks/useExerciseTelemetry';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { SessionProgressBubble } from '@/components/SessionProgressBubble';
import { SessionSidePanel } from '@/components/SessionSidePanel';

const EXERCISE_SLUG = 'describe_guess';

export default function DescribeGuessExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const [completed, setCompleted] = useState(false);

  const scoreRef = useRef(0);
  const trialsRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  const fromLesson = location.state?.fromLesson ?? false;
  const providedSessionId = location.state?.sessionId ?? null;

  // Shared adaptation contract
  const adaptation = useSessionAdaptation({
    lessonAdaptations: location.state?.adaptations,
    lessonFocusPhonemes: location.state?.focusPhonemes,
    defaultErrorType: 'semantic_paraphasia',
  });

  const adaptationTelemetry = buildAdaptationTelemetry(adaptation, {
    phonemeSensitive: false,  // circumlocution is semantic, not phonemic
    cueSensitive: true,
  });

  const { activeSessionId, isCreatingSession } = useStandaloneSession(
    user?.id,
    providedSessionId,
    EXERCISE_SLUG
  );

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

  const { logTrial } = useExerciseTelemetry(
    activeSessionId,
    normalizeExerciseSlug(EXERCISE_SLUG)
  );

  const handleTrialComplete = useCallback((result: DescribeGuessTrialResult) => {
    if (!activeSessionId) return;
    const points = (result.meaningWin ? 40 : 0) + (result.wordWin ? 40 : 0) + (result.strategyWin ? 20 : 0);
    scoreRef.current += points;
    trialsRef.current += 1;

    logTrial({
      correct: result.meaningWin || result.wordWin,
      reactionTimeMs: result.reactionTimeMs,
      errorType: result.meaningWin || result.wordWin ? undefined : 'no_guess',
      taskParameters: {
        trial_id: result.trialId,
        target: result.target,
        meaning_win: result.meaningWin,
        word_win: result.wordWin,
        strategy_win: result.strategyWin,
        communication_win: result.communicationWin,
        feature_types_used: result.featureTypesUsed,
        guess_confidence: result.guessConfidence,
        prompts_shown: result.promptsShown,
        time_to_word_retrieval_ms: result.timeToWordRetrievalMs,
        self_corrected: result.selfCorrected,
        difficulty: result.difficulty,
        // Shared adaptation telemetry
        ...adaptationTelemetry,
      },
    });
  }, [activeSessionId, logTrial, adaptationTelemetry]);

  const handleGameComplete = useCallback((results: DescribeGuessTrialResult[]) => {
    setCompleted(true);
    completeSession();

    if (fromLesson) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('exercise-complete', {
          detail: { exerciseSlug: EXERCISE_SLUG, results },
        }));
      }, 2000);
    }
  }, [fromLesson, completeSession]);

  const handleBack = useCallback(() => {
    navigate(fromLesson ? '/lesson' : '/dashboard');
  }, [navigate, fromLesson]);

  const handleContinue = useCallback(() => {
    if (fromLesson) {
      window.dispatchEvent(new CustomEvent('exercise-complete', {
        detail: { exerciseSlug: EXERCISE_SLUG },
      }));
    } else {
      navigate('/dashboard');
    }
  }, [fromLesson, navigate]);

  const isReady = !isCreatingSession && !!activeSessionId;

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading exercise...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <h1 className="text-lg font-semibold">Describe & Guess</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            <Home className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {fromLesson && <SessionProgressBubble />}

      <main className="container px-4 py-8">
        {completed ? (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-bold">Exercise Complete!</h2>
            <p className="text-muted-foreground">Amazing describing practice!</p>
            <Button onClick={handleContinue} size="lg">Continue</Button>
          </div>
        ) : (
          <DescribeGuessGame
            onTrialComplete={handleTrialComplete}
            onGameComplete={handleGameComplete}
            trialCount={8}
            sessionId={activeSessionId}
            userId={user?.id}
            profileId={activeProfile?.id}
          />
        )}
      </main>

      {fromLesson && <SessionSidePanel />}
    </div>
  );
}
