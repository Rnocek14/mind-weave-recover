/**
 * Fix the Sentence Exercise Page
 * 
 * Wrapper with session lifecycle, telemetry, and navigation.
 * Now consumes shared adaptation contract.
 */

import React, { useCallback, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FixSentenceGame } from '@/components/FixSentenceGame';
import { FixSentenceTrialResult } from '@/hooks/useFixSentenceGame';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useExerciseTelemetry } from '@/hooks/useExerciseTelemetry';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';
import { useValidationTrialCount } from '@/hooks/useValidationTrialCount';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';
import { classifyUtteranceValidity } from '@/lib/clinical/classifyUtteranceValidity';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { InlineSessionProgress } from '@/components/InlineSessionProgress';
import { SessionSidePanel } from '@/components/SessionSidePanel';
import { useFixSentenceProgression } from '@/hooks/useFixSentenceProgression';
import { resolveEffectiveFixSentenceInitialDifficulty } from '@/lib/progression/fixSentenceDifficultyBridge';

const EXERCISE_SLUG = 'fix_sentence';

export default function FixSentenceExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const [completed, setCompleted] = useState(false);
  // Validation harness: ?validation=1 → 10 trials so adaptation can show both
  // UP and DOWN within one session. Production users still get 5.
  const validationTrialCount = useValidationTrialCount(5, 10);

  const scoreRef = useRef(0);
  const trialsRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  const restored = useRestoredLessonContext(EXERCISE_SLUG);
  const { fromLesson, returnTo } = restored;
  const providedSessionId = restored.sessionId;

  // Shared adaptation contract
  const adaptation = useSessionAdaptation({
    exerciseSlug: EXERCISE_SLUG,
    lessonAdaptations: location.state?.adaptations,
    lessonFocusPhonemes: location.state?.focusPhonemes,
    defaultErrorType: 'semantic_paraphasia',
  });

  const adaptationTelemetry = buildAdaptationTelemetry(adaptation, {
    phonemeSensitive: false,  // sentence-level, not phoneme
    cueSensitive: true,
  });

  const { activeSessionId, isCreatingSession } = useStandaloneSession(
    user?.id,
    providedSessionId,
    EXERCISE_SLUG
  );

  // Clinical Progression v1 — Fix Sentence persistence + bridge.
  // Persistent Clinical Level provides a FLOOR for engine difficulty.
  // In-session adaptation can still escalate above this floor.
  const progression = useFixSentenceProgression({
    userId: user?.id,
    profileId: activeProfile?.id,
  });
  const bridge = resolveEffectiveFixSentenceInitialDifficulty({
    sessionAdaptationDifficulty: 1,
    clinicalLevel: progression.startingLevel,
  });

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

  const handleTrialComplete = useCallback((result: FixSentenceTrialResult) => {
    if (!activeSessionId) return;
    scoreRef.current += result.isCorrect ? 100 : (result.isPartialCredit ? 50 : 0);
    trialsRef.current += 1;

    // Check if trial phonemes matched the adaptation focus
    const focusSet = new Set(adaptation.focusPhonemes);
    const phonemeMatched = result.phonemeTargets.length > 0 && 
      result.phonemeTargets.some(p => focusSet.has(p));

    // Speech Validity Gate — transcript-only classification (no audio metadata
    // available from FixSentence pipeline yet). Catches filler-only / empty.
    const validity = classifyUtteranceValidity({
      transcript: result.spokenWord,
      asrConfidence: null,
      recordingDurationMs: result.reactionTimeMs,
    });

    logTrial({
      correct: result.isCorrect,
      reactionTimeMs: result.reactionTimeMs,
      errorType: result.isCorrect ? undefined : (result.isPartialCredit ? 'incorrect_close' : 'incorrect_fix'),
      taskParameters: {
        trial_id: result.trialId,
        sentence: result.sentence,
        wrong_word: result.wrongWord,
        spoken_word: result.spokenWord,
        matched_fix: result.matchedFix,
        self_corrected: result.selfCorrected,
        semantic_similarity: result.semanticSimilarity,
        difficulty: result.difficulty,
        trial_source: 'fix_sentence_bank',
        phoneme_matched: phonemeMatched,
        phoneme_targets: result.phonemeTargets,
        close_miss: !result.isCorrect && result.isPartialCredit,
        // Shared adaptation telemetry
        ...adaptationTelemetry,
      },
      validity,
    });
  }, [activeSessionId, logTrial, adaptationTelemetry, adaptation.focusPhonemes]);

  const handleGameComplete = useCallback((results: FixSentenceTrialResult[]) => {
    setCompleted(true);
    completeSession();

    if (fromLesson) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('exercise-complete', {
          detail: { exerciseSlug: EXERCISE_SLUG, results },
        }));
        navigate(returnTo, { state: { resuming: true }, replace: true });
      }, 400);
    }
  }, [fromLesson, completeSession]);

  const handleBack = useCallback(() => {
    navigate(fromLesson ? returnTo : '/dashboard');
  }, [navigate, fromLesson]);

  const handleContinue = useCallback(() => {
    if (fromLesson) {
      window.dispatchEvent(new CustomEvent('exercise-complete', {
        detail: { exerciseSlug: EXERCISE_SLUG },
      }));
    } else {
      navigate('/today');
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
    <div className={`${fromLesson ? 'h-dvh overflow-hidden' : 'min-h-screen'} bg-background flex flex-col`}>
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Back</span>
          </Button>
          <h1 className="text-lg font-semibold">Fix the Sentence</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate('/today')}>
            <Home className="h-4 w-4" />
          </Button>
        </div>
        {fromLesson && <InlineSessionProgress />}
      </header>

      <main className={`container px-4 ${fromLesson ? 'py-2 flex-1 min-h-0 overflow-auto' : 'py-4 md:py-8'}`}>
        {completed ? (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-bold">Exercise Complete!</h2>
            <p className="text-muted-foreground">{fromLesson ? 'Loading next exercise…' : 'Great job fixing those sentences!'}</p>
            {!fromLesson && <Button onClick={handleContinue} size="lg">Continue</Button>}
          </div>
        ) : (
          <FixSentenceGame
            onTrialComplete={handleTrialComplete}
            onGameComplete={handleGameComplete}
            trialCount={validationTrialCount}
            focusPhonemes={adaptation.focusPhonemes}
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
