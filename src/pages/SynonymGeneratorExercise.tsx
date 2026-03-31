/**
 * Synonym Generator Exercise Page
 * 
 * "Give as many synonyms for [word] as you can" with adaptive difficulty
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SynonymGeneratorGame, type SynonymRoundResult } from '@/components/SynonymGeneratorGame';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useExerciseTelemetry } from '@/hooks/useExerciseTelemetry';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { InlineSessionProgress } from '@/components/InlineSessionProgress';
import { SessionSidePanel } from '@/components/SessionSidePanel';

const EXERCISE_SLUG = 'synonym_generator';

export default function SynonymGeneratorExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const [completed, setCompleted] = useState(false);
  const exerciseCompleteSentRef = useRef(false);
  const dispatchTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => { if (dispatchTimeoutRef.current) clearTimeout(dispatchTimeoutRef.current); };
  }, []);

  const scoreRef = useRef(0);
  const trialsRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  const restored = useRestoredLessonContext(EXERCISE_SLUG);
  const fromLesson = restored.fromLesson;
  const providedSessionId = restored.sessionId;
  const roundCount = Number(location.state?.trialLimit) || 3;
  const lessonAdaptations = restored.adaptations;

  const adaptation = useSessionAdaptation({
    exerciseSlug: EXERCISE_SLUG,
    lessonAdaptations,
  });
  const difficultyLevel = adaptation.difficultyTier;
  const adaptationTelemetry = buildAdaptationTelemetry(adaptation);

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

  const handleRoundComplete = useCallback((result: SynonymRoundResult) => {
    if (!activeSessionId) return;
    trialsRef.current += 1;
    scoreRef.current += result.matchCount;

    logTrial({
      correct: result.matchCount >= 2,
      reactionTimeMs: result.durationSec * 1000,
      taskParameters: {
        target_word: result.targetWord,
        matched_synonyms: result.matchedSynonyms,
        unmatched_entries: result.unmatchedEntries,
        match_count: result.matchCount,
        total_entered: result.totalEntered,
        time_limit: result.timeLimitSec,
        difficulty: result.difficulty,
        ...adaptationTelemetry,
      },
    });
  }, [activeSessionId, logTrial, adaptationTelemetry]);

  const handleGameComplete = useCallback((results: SynonymRoundResult[]) => {
    setCompleted(true);
    completeSession();

    if (fromLesson && !exerciseCompleteSentRef.current) {
      exerciseCompleteSentRef.current = true;
      dispatchTimeoutRef.current = window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('exercise-complete', {
          detail: {
            exerciseSlug: EXERCISE_SLUG,
            results,
            totalScore: results.reduce((sum, r) => sum + r.matchCount, 0),
          }
        }));
        navigate('/lesson', { state: { resuming: true }, replace: true });
      }, 400);
    }
  }, [fromLesson, completeSession, navigate]);

  const handleBack = useCallback(() => {
    navigate(fromLesson ? '/lesson' : '/dashboard');
  }, [navigate, fromLesson]);

  const isReady = !isCreatingSession && !!activeSessionId;

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading exercise...</div>
      </div>
    );
  }

  return (
    <div className={`${fromLesson ? 'h-dvh overflow-hidden' : 'min-h-screen'} bg-background flex flex-col`}>
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <h1 className="text-lg font-semibold">🔄 Synonym Generator</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            <Home className="h-4 w-4" />
          </Button>
        </div>
        {fromLesson && <InlineSessionProgress />}
      </header>

      <main className={`container px-4 ${fromLesson ? 'py-2 flex-1 min-h-0 overflow-auto' : 'py-4 md:py-8'}`}>
        {completed ? (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="text-6xl">🏆</div>
            <h2 className="text-2xl font-bold">Great Work!</h2>
            <p className="text-muted-foreground">
              {fromLesson ? 'Loading next exercise…' : 'Nice synonym practice!'}
            </p>
            {!fromLesson && (
              <Button onClick={() => navigate('/dashboard')} size="lg">Continue</Button>
            )}
          </div>
        ) : (
          <SynonymGeneratorGame
            difficulty={difficultyLevel}
            onRoundComplete={handleRoundComplete}
            onGameComplete={handleGameComplete}
            roundCount={roundCount}
          />
        )}
      </main>

      {fromLesson && <SessionSidePanel />}
    </div>
  );
}
