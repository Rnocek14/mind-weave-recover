import { hasMissingClinicalRawEvidence } from '@/lib/trial/clinicalRawCompletionGate';
import { UnverifiedPracticeBanner } from '@/components/exercise/UnverifiedPracticeBanner';
/**
 * Describe & Guess Exercise Page
 *
 * Flagship circumlocution training — wrapper with session lifecycle.
 *
 * Phase 2 (Universal Clinical Migration):
 *   - Replaces `useExerciseTelemetry` + manual `logTrial` with the unified
 *     `useTrialSubmission` pathway (lexical axis). One call site → both
 *     `exercise_events` and the mastery shadow.
 *   - `adaptation_trial_logs` continues to be written from
 *     `DescribeGuessGame`'s own `useInGameAdaptation(autoLog:true)`.
 *   - All feature-chip prompts are SEMANTIC hints (what/where/how).
 *     None supplies a phoneme or full spoken carrier model. Record
 *     `cueLevel` 0–3 as intensity/count, but `supportUsed` is semantic
 *     for every prompted attempt, never fabricated phonemic/model support.
 *   - No per-game progression hook yet — `progression: null`.
 */

import { ExerciseLoading } from '@/components/exercise/ExerciseLoading';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { InlineSessionProgress } from '@/components/InlineSessionProgress';
import { useNavigate, useLocation } from 'react-router-dom';
import { DescribeGuessGame } from '@/components/DescribeGuessGame';
import { DescribeGuessTrialResult } from '@/hooks/useDescribeGuessGame';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useTrialSubmission } from '@/hooks/useTrialSubmission';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { deriveCueTelemetry } from '@/lib/describeGuess/cueMapping';
import { classifyDescribeGuessEvidence } from '@/lib/describeGuess/roundEvidence';
import { useDescribeGuessTrainingStage } from '@/hooks/useDescribeGuessTrainingStage';
import type { SupportLevel } from '@/lib/progression/clinicalProgression';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { SessionSidePanel } from '@/components/SessionSidePanel';

/** Help-chip counts are ordinal INTENSITY, not phonemic cue types.
 * All help chips in Describe & Guess ask for semantic features. */
export function cueLevelToLexicalSupport(cueLevel: number): SupportLevel {
  return cueLevel <= 0 ? 'independent' : 'semantic_cue';
}


const EXERCISE_SLUG = 'describe_guess';

export default function DescribeGuessExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const [completed, setCompleted] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const scoreRef = useRef(0);
  const trialsRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const completionTimeoutRef = useRef<number | null>(null);
  const hasAdvancedLessonRef = useRef(false);

  const restoredLessonContext = useMemo(() => {
    try {
      const savedState = sessionStorage.getItem('lessonFlowState');
      if (!savedState) return null;

      const parsed = JSON.parse(savedState);
      const savedIndex = typeof parsed?.currentBlockIndex === 'number' ? parsed.currentBlockIndex : -1;
      const savedBlock = parsed?.lesson?.blocks?.[savedIndex];
      const savedExerciseId = savedBlock?.exerciseId;
      const normalizedSavedExerciseId = typeof savedExerciseId === 'string'
        ? savedExerciseId.replace(/_/g, '-')
        : null;

      if (!savedBlock || normalizedSavedExerciseId !== 'describe-guess') {
        return null;
      }

      return {
        fromLesson: Boolean(parsed?.sessionId),
        sessionId: parsed?.sessionId ?? null,
        adaptations: savedBlock?.adaptations,
      };
    } catch (error) {
      console.warn('[DescribeGuess] Failed to restore lesson context:', error);
      return null;
    }
  }, [location.key]);

  const hasRouteLessonContext = Boolean(location.state?.fromLesson || location.state?.sessionId);
  const fromLesson = hasRouteLessonContext
    ? Boolean(location.state?.fromLesson || location.state?.sessionId)
    : (restoredLessonContext?.fromLesson ?? false);
  const providedSessionId = location.state?.sessionId ?? restoredLessonContext?.sessionId ?? null;
  const returnTo = location.state?.returnTo || '/lesson';
  // Honor the lesson plan's trial limit so a short plan doesn't run the full 8.
  const trialCount = Number(location.state?.trialLimit) || 8;

  // Shared adaptation contract
  const adaptation = useSessionAdaptation({
    exerciseSlug: EXERCISE_SLUG,
    lessonAdaptations: location.state?.adaptations ?? restoredLessonContext?.adaptations,
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
  const training = useDescribeGuessTrainingStage({
    userId: user?.id,
    profileId: activeProfile?.id,
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

  // Unified trial submission (lexical axis). No per-game progression hook
  // yet — progression:null keeps the progression buffer + commit flush as
  // no-ops; exercise_events + mastery shadow still write.
  const { submitTrial, commitSession } = useTrialSubmission({
    userId: user?.id,
    profileId: activeProfile?.id,
    sessionId: activeSessionId,
    exerciseSlug: EXERCISE_SLUG,
    progression: null,
  });

  const pivot = useExerciseMidSessionPivot({ exerciseSlug: EXERCISE_SLUG, domainSlug: 'lexical_retrieval', fromLesson });

  const resumeLessonFlow = useCallback((results?: DescribeGuessTrialResult[]) => {
    if (!fromLesson || hasAdvancedLessonRef.current) return;

    hasAdvancedLessonRef.current = true;

    if (completionTimeoutRef.current !== null) {
      window.clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }

    window.dispatchEvent(new CustomEvent('exercise-complete', {
      detail: {
        exerciseSlug: EXERCISE_SLUG,
        ...(results ? { results } : {}),
      },
    }));

    navigate(returnTo, { state: { resuming: true }, replace: true });
  }, [fromLesson, navigate]);

  useEffect(() => {
    return () => {
      if (completionTimeoutRef.current !== null) {
        window.clearTimeout(completionTimeoutRef.current);
      }
    };
  }, []);

  const handleTrialComplete = useCallback((result: DescribeGuessTrialResult) => {
    if (!activeSessionId) return;
    const points = (result.meaningWin ? 40 : 0) + (result.wordWin ? 40 : 0) + (result.strategyWin ? 20 : 0);
    scoreRef.current += points;
    trialsRef.current += 1;
    const evidence = classifyDescribeGuessEvidence(result);
    const isCorrect = evidence.practiceSuccessful;
    // The pivot reflects speech-task performance only. A typed fallback,
    // or an unknown/invalid response, must not lower the patient's speech
    // difficulty or masquerade as an independent clinical trial.
    if (evidence.shouldAdaptSpokenTask) {
      pivot.recordTrialResult({ wasCorrect: isCorrect, reactionTimeMs: result.reactionTimeMs });
    }

    // Cue telemetry — chips tapped (and feature-type prompts surfaced) are
    // semantic scaffolds. Map count → 0..3 cue level so adaptation, mastery
    // shadow, and cue-independence analytics see real support usage instead
    // of "always unaided".
    const promptCount = result.promptsShown?.length ?? 0;
    const { cueLevel, cueTypeGiven } = deriveCueTelemetry(promptCount, isCorrect);
    // New staged tasks show 2–5 semantic strategy labels from the outset.
    // These are useful lexical scaffolds even if the patient does not tap.
    // A cued practice configuration must not silently become INDEPENDENT
    // speech recovery evidence when no chip was tapped.
    const stageStrategyLabelsAvailable = training.stage
      ? Math.min(5, training.stage.initialVisiblePrompts + 2)
      : 0;
    const stageScaffolded = stageStrategyLabelsAvailable > 0;
    const independentlyObserved = evidence.independentSpokenScoreEligible && !stageScaffolded;
    const supportUsed = stageScaffolded ? 'semantic_cue' : cueLevelToLexicalSupport(cueLevel);
    const trialMode = stageScaffolded && evidence.inputMode === 'spoken' &&
      evidence.validCommunication && !!result.browserTranscript?.trim()
      ? 'scaffolded' : stageScaffolded ? 'mixed' : evidence.trialMode;

    void submitTrial({
      profileId: activeProfile?.id,
      sessionId: activeSessionId,
      gameId: EXERCISE_SLUG,
      level: result.difficulty ?? adaptation.difficultyTier ?? 1,
      stimulusId: result.trialId,
      expectedResponse: result.target ?? null,
      userResponse: result.transcript || null,
      // Never manufacture recognized speech from the generic response text.
      browserTranscript: result.inputMode === 'spoken' && result.browserTranscript?.trim()
        ? result.browserTranscript : null,
      isCorrect,
      // Word win is the harder of the two; weight accordingly so mastery
      // shadow / adaptation can distinguish full retrieval from
      // partial-meaning success.
      accuracyScore: result.wordWin ? 1 : (result.meaningWin ? 0.5 : 0),
      cueLevel,
      supportUsed,
      latencyMs: result.reactionTimeMs ?? null,
      trialMode,
      clinicalProgressionEligible: independentlyObserved,
      errorType: !evidence.validCommunication ? 'unscorable_response'
        : result.inputMode === 'spoken' && !result.browserTranscript?.trim()
          ? 'unverified_speech_provenance'
        : result.inputMode === 'typed' ? 'typed_practice'
        : isCorrect ? undefined : 'no_guess',
      taskParameters: {
        trial_id: result.trialId, target: result.target,
        meaning_win: result.meaningWin, word_win: result.wordWin,
        strategy_win: result.strategyWin, communication_win: result.communicationWin,
        feature_types_used: result.featureTypesUsed, guess_confidence: result.guessConfidence,
        prompts_shown: result.promptsShown, prompts_shown_count: promptCount,
        input_mode: evidence.inputMode,
        describing_training_stage: training.stage?.level ?? null,
        describing_target_tier: training.stage?.itemTier ?? null,
        stage_strategy_labels_available: stageStrategyLabelsAvailable,
        clinical_stage_promotion_eligible: false,
        // The raw logger normalizes successful error_type to 'correct'. Keep
        // missing recognition provenance queryable even on correct practice.
        provenance_issue: result.inputMode === 'spoken' && !result.browserTranscript?.trim()
          ? 'missing_browser_transcript' : null,
        valid_communication: evidence.validCommunication,
        independent_spoken_score_eligible: independentlyObserved,
        supported_spoken_practice: evidence.shouldAdaptSpokenTask && (cueLevel > 0 || stageScaffolded),
        cue_type_given: cueTypeGiven,
        time_to_word_retrieval_ms: result.timeToWordRetrievalMs,
        self_corrected: result.selfCorrected, difficulty: result.difficulty,
        pivot_pending: pivot.hasPending, ...adaptationTelemetry,
      },
    });
    if (evidence.shouldAdaptSpokenTask && pivot.shouldStepDown) {
      console.log('[DescribeGuess] Pivot: step down', pivot.pivotReason);
      pivot.acknowledge();
    }
  }, [activeSessionId, activeProfile?.id, submitTrial, adaptation.difficultyTier, adaptationTelemetry, pivot, training.stage]);

  const handleGameComplete = useCallback(async (results: DescribeGuessTrialResult[]) => {
    // Unified commit: drains adaptation log buffer + flushes mastery shadow.
    const commit = await commitSession();
    if (hasMissingClinicalRawEvidence(commit)) {
      setSaveError(true);
      return;
    }
    setCompleted(true);
    await completeSession();

    if (fromLesson) {
      completionTimeoutRef.current = window.setTimeout(() => {
        resumeLessonFlow(results);
      }, 400);
    }
  }, [fromLesson, completeSession, commitSession, resumeLessonFlow]);


  const handleBack = useCallback(() => {
    navigate(fromLesson ? returnTo : '/dashboard');
  }, [navigate, fromLesson]);

  const handleContinue = useCallback(() => {
    if (fromLesson) {
      resumeLessonFlow();
    } else {
      navigate('/today');
    }
  }, [fromLesson, navigate, resumeLessonFlow]);

  const isReady = !isCreatingSession && !!activeSessionId && training.loaded;

  if (!isReady) {
    return <ExerciseLoading />;
  }

  if (training.loadUnavailable) {
    return (
      <div role="alert" className="min-h-dvh bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Practice level unavailable</h1>
        <p className="text-lg">We couldn't load your saved level. Ask a care partner for help.</p>
        <Button size="lg" onClick={() => navigate('/today')}>Return to Today</Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {saveError && <UnverifiedPracticeBanner />}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Back</span>
          </Button>
          <h1 className="text-lg font-semibold">Describe & Guess</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate('/today')}>
            <Home className="h-4 w-4" />
          </Button>
        </div>
        {fromLesson && <InlineSessionProgress />}
      </header>

      <main className="container px-4 py-2 flex-1 flex flex-col overflow-y-auto pb-4 tall:pb-16">
        {!training.stage && training.persistedLevel != null && (
          <div role="status" className="rounded-lg border p-3 text-sm">
            Your saved level is {training.persistedLevel}. Higher-stage
            describing tasks are still being developed; general describing
            practice will not change your saved level.
          </div>
        )}
        {saveError ? null : completed ? (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-bold">Exercise Complete!</h2>
            <p className="text-muted-foreground">
              {fromLesson ? 'Loading next exercise…' : 'Amazing describing practice!'}
            </p>
            {!fromLesson && <Button onClick={handleContinue} size="lg">Continue</Button>}
          </div>
        ) : (
          <DescribeGuessGame
            key={[activeProfile?.id ?? 'none', activeSessionId, training.stage?.level ?? 'general'].join(':')}
            trainingStage={training.stage}
            onTrialComplete={handleTrialComplete}
            onGameComplete={handleGameComplete}
            trialCount={trialCount}
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
