/**
 * Two Clues Word Association Exercise Page
 * 
 * Wrapper page for the Two Clues game with session lifecycle management.
 * Now uses shared AdaptationContract for phoneme targeting and cue personalization.
 */

import React, { useCallback, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TwoCluesGame } from '@/components/TwoCluesGame';
import { TwoCluesTrialResult } from '@/hooks/useTwoCluesGame';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useExerciseTelemetry } from '@/hooks/useExerciseTelemetry';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';
import { extractAnswerFromTranscript } from '@/lib/speechNormalizer';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { InlineSessionProgress } from '@/components/InlineSessionProgress';
import { SessionSidePanel } from '@/components/SessionSidePanel';

const EXERCISE_SLUG = 'two_clues';

export default function TwoCluesExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const [completed, setCompleted] = useState(false);
  
  // Session stats for lifecycle management
  const scoreRef = useRef(0);
  const trialsRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  const restored = useRestoredLessonContext(EXERCISE_SLUG);
  const { fromLesson, returnTo } = restored;
  const providedSessionId = restored.sessionId;
  const lessonAdaptations = restored.adaptations;
  const lessonFocusPhonemes = location.state?.focusPhonemes as string[] | undefined;
  const lessonFocusWords = location.state?.focusWords as string[] | undefined;

  // Shared adaptation contract - provides focusPhonemes, cue type, difficulty
  const adaptation = useSessionAdaptation({
    exerciseSlug: EXERCISE_SLUG,
    lessonAdaptations,
    lessonFocusPhonemes,
    lessonFocusWords,
    defaultErrorType: 'semantic_paraphasia',
  });
  const adaptationTelemetry = buildAdaptationTelemetry(adaptation, {
    phonemeSensitive: true,
    cueSensitive: true,
  });

  // Session management
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

  // Telemetry
  const { logTrial, trialNumber } = useExerciseTelemetry(
    activeSessionId,
    normalizeExerciseSlug(EXERCISE_SLUG)
  );

  // Mid-session pivot
  const pivot = useExerciseMidSessionPivot({
    exerciseSlug: EXERCISE_SLUG,
    domainSlug: 'lexical_retrieval',
    fromLesson,
  });

  // Handle trial completion - log to telemetry
  const handleTrialComplete = useCallback((result: TwoCluesTrialResult) => {
    if (!activeSessionId) return;

    // Update stats refs
    scoreRef.current += result.score;
    trialsRef.current += 1;

    const isCorrect = result.tier === 'strong' || result.tier === 'related';

    // Record for mid-session pivot
    pivot.recordTrialResult({
      wasCorrect: isCorrect,
      reactionTimeMs: result.reactionTimeMs,
      cueLevel: result.reachedAnchor ? 1 : 0,
    });

    // Log both raw spoken word and cleaned version for analytics
    const cleanedAnswer = extractAnswerFromTranscript(result.spokenWord);

    logTrial({
      correct: isCorrect,
      reactionTimeMs: result.reactionTimeMs,
      errorType: result.tier === 'uncertain' ? 'no_match' : undefined,
      taskParameters: {
        puzzle_id: result.puzzleId,
        clues: result.clues,
        anchors: result.anchors,
        match_tier: result.tier,
        reached_anchor: result.reachedAnchor,
        spoken_word_raw: result.spokenWord,
        spoken_word_clean: cleanedAnswer,
        matched_word: result.matchedWord,
        coach_response: result.coachResponse,
        semantic_similarity: result.semanticSimilarity,
        pivot_pending: pivot.hasPending,
        ...adaptationTelemetry,
      },
      cueTypeGiven: adaptation.recommendedCueType !== 'none' ? adaptation.recommendedCueType : 'none',
    });

    if (pivot.shouldStepDown) {
      console.log('[TwoClues] Mid-session pivot: step down', pivot.pivotReason);
      pivot.acknowledge();
    }
  }, [activeSessionId, logTrial, adaptation, pivot]);

  // Handle game completion
  const handleGameComplete = useCallback((results: TwoCluesTrialResult[]) => {
    setCompleted(true);
    completeSession();

    // Dispatch exercise complete event for lesson flow
    if (fromLesson) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('exercise-complete', {
          detail: {
            exerciseSlug: EXERCISE_SLUG,
            results,
            totalScore: results.reduce((sum, r) => sum + r.score, 0),
          }
        }));
        navigate(returnTo, { state: { resuming: true }, replace: true });
      }, 400);
    }
  }, [fromLesson, completeSession]);

  // Navigation
  const handleBack = useCallback(() => {
    if (fromLesson) {
      navigate(returnTo);
    } else {
      navigate('/today');
    }
  }, [navigate, fromLesson]);

  const handleHome = useCallback(() => {
    navigate('/today');
  }, [navigate]);

  // Continue button for completion screen
  const handleContinue = useCallback(() => {
    if (fromLesson) {
      window.dispatchEvent(new CustomEvent('exercise-complete', {
        detail: { exerciseSlug: EXERCISE_SLUG }
      }));
    } else {
      navigate('/today');
    }
  }, [fromLesson, navigate]);

  const isReady = !isCreatingSession && !!activeSessionId;

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">
          Loading exercise...
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-hidden bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          
          <h1 className="text-lg font-semibold">Two Clues</h1>
          
          <Button variant="ghost" size="sm" onClick={handleHome}>
            <Home className="h-4 w-4" />
          </Button>
        </div>
        {fromLesson && <InlineSessionProgress />}
      </header>

      {/* Main content */}
      <main className="container px-4 py-2 flex-1 min-h-0 overflow-hidden flex flex-col">
        {completed ? (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-bold">Exercise Complete!</h2>
            <p className="text-muted-foreground">
              {fromLesson ? 'Loading next exercise…' : 'Great job practicing word associations!'}
            </p>
            {!fromLesson && (
              <Button onClick={handleContinue} size="lg">
                Continue
              </Button>
            )}
          </div>
        ) : (
          <TwoCluesGame
            onTrialComplete={handleTrialComplete}
            onGameComplete={handleGameComplete}
            roundCount={10}
            sessionId={activeSessionId}
            userId={user?.id}
            profileId={activeProfile?.id}
            focusPhonemes={adaptation.focusPhonemes.length > 0 ? adaptation.focusPhonemes : undefined}
            recommendedCueType={adaptation.recommendedCueType !== 'none' ? adaptation.recommendedCueType : undefined}
          />
        )}
      </main>

      {/* Session side panel (if from lesson) */}
      {fromLesson && <SessionSidePanel />}
    </div>
  );
}
