import { hasMissingClinicalRawEvidence } from '@/lib/trial/clinicalRawCompletionGate';
import { UnverifiedPracticeBanner } from '@/components/exercise/UnverifiedPracticeBanner';
/**
 * Fix the Sentence Exercise Page
 * 
 * Wrapper with session lifecycle, telemetry, and navigation.
 * Now consumes shared adaptation contract.
 */

import { ExerciseLoading } from '@/components/exercise/ExerciseLoading';
import { ExerciseLoadGate } from '@/components/ExerciseLoadGate';
import React, { useCallback, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FixSentenceGame } from '@/components/FixSentenceGame';
import { FixSentenceTrialResult } from '@/hooks/useFixSentenceGame';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useTrialSubmission } from '@/hooks/useTrialSubmission';
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
import { ProgressionRecap } from '@/components/ProgressionRecap';
import { getFixSentenceLevelSpec } from '@/lib/progression/fixSentenceLevels';
import type { CommitSessionResult } from '@/lib/trial/types';
import { buildFixSentenceTaskParameters } from '@/lib/telemetry/fixSentenceTaskParams';
import { routeFixSentenceEvidence } from '@/lib/fixSentence/evidenceRouting';
import { recordFixSentenceReviewTargets } from '@/lib/gameReviewHandoff';

const EXERCISE_SLUG = 'fix_sentence';

export default function FixSentenceExercise() {
  const navigate = useNavigate();
  const [saveError, setSaveError] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const [completed, setCompleted] = useState(false);
  // Validation harness: ?validation=1 → 10 trials so adaptation can show both
  // UP and DOWN within one session. Production users still get 5.
  const validationTrialCount = useValidationTrialCount(5, 10);
  const [recap, setRecap] = useState<CommitSessionResult['progressionSnapshot'] | null>(null);
  const finalizeAfterRecapRef = useRef<(() => void) | null>(null);

  const scoreRef = useRef(0);
  const trialsRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  /** Set by FixSentenceGame on mount; lets the page await the auto-wired
   * adaptation_trial_logs flush before navigation. Mirrors the
   * `flushAdaptationLogs` discipline in PhotoNamingGame. */
  const flushAdaptationLogsRef = useRef<null | (() => Promise<void>)>(null);

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
    supportBaseline: progression.state?.supportBaseline ?? 0,
  });
  if (import.meta.env.DEV && bridge.softRegressionScaffold) {
    console.log(
      `[SoftRegression] FixSentence scaffolding active — supportBaseline=${progression.state?.supportBaseline} ` +
        `lowered floor by 1 step (clinicalLevel=${progression.startingLevel}, floor=${bridge.clinicalFloor})`,
    );
  }

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

  // Unified trial submission — fans out to exercise_events,
  // adaptation_trial_logs (auto-wired in-game), clinical_progression_state,
  // and user_skill_mastery on commit.
  const { submitTrial, commitSession } = useTrialSubmission({
    userId: user?.id,
    profileId: activeProfile?.id,
    sessionId: activeSessionId,
    exerciseSlug: EXERCISE_SLUG,
    progression,
  });

  const handleTrialComplete = useCallback((result: FixSentenceTrialResult) => {
    if (!activeSessionId) return;
    scoreRef.current += result.isCorrect ? 100 : (result.isPartialCredit ? 50 : 0);
    trialsRef.current += 1;

    const focusSet = new Set(adaptation.focusPhonemes);
    const phonemeMatched = result.phonemeTargets.length > 0 &&
      result.phonemeTargets.some(p => focusSet.has(p));

    const evidence = routeFixSentenceEvidence(result);
    // A typed answer or a tapped word can be useful supported practice,
    // but classifying either as a recorded utterance invents speech evidence.
    const validity = evidence.browserTranscript
      ? classifyUtteranceValidity({
          transcript: evidence.browserTranscript,
          asrConfidence: null,
          recordingDurationMs: result.reactionTimeMs,
        })
      : undefined;

    void submitTrial({
      profileId: activeProfile?.id,
      sessionId: activeSessionId,
      gameId: EXERCISE_SLUG,
      level: result.difficulty ?? 1,
      stimulusId: result.trialId,
      expectedResponse: result.wrongWord,
      userResponse: result.spokenWord,
      browserTranscript: evidence.browserTranscript,
      isCorrect: result.isCorrect,
      accuracyScore: result.semanticSimilarity ?? null,
      // cue_level stays 0: choice tiles are a RESPONSE-FORMAT support
      // (supportUsed), not an issued cue — per the locked cross-game
      // cue_level contract (docs/unified-trial-contract.md).
      cueLevel: 0,
      supportUsed: result.support ?? 'open_response',
      latencyMs: result.reactionTimeMs ?? null,
      trialMode: evidence.trialMode,
      clinicalProgressionEligible: evidence.clinicalProgressionEligible,
      validity,
      errorType: result.isCorrect ? undefined : (result.isPartialCredit ? 'incorrect_close' : 'incorrect_fix'),
      taskParameters: buildFixSentenceTaskParameters(result, {
        // Keep clinical ladder eligibility separate from *verified spoken*
        // session accuracy. Choice is appropriate L1/L2 receptive evidence,
        // but it is not independent spoken production.
        input_mode: evidence.inputMode,
        clinical_score_eligible: evidence.verifiedSpeechScoreEligible,
        independent_spoken_score_eligible: evidence.independentSpokenScoreEligible,
        phoneme_matched: phonemeMatched,
        phoneme_targets: result.phonemeTargets,
        ...adaptationTelemetry,
      }),
    });
  }, [activeSessionId, activeProfile?.id, submitTrial, adaptationTelemetry, adaptation.focusPhonemes]);

  const handleGameComplete = useCallback(async (results: FixSentenceTrialResult[]) => {
    // Final-trial flush race fix (mirrors PhotoNamingGame): force-flush the
    // auto-wired adaptation_trial_logs buffer BEFORE persisting progression
    // and navigating, so the last trial isn't lost when the component unmounts.
    try { await flushAdaptationLogsRef.current?.(); } catch (err) {
      console.warn('[FixSentenceExercise] adaptation flush error', err);
    }

    if (import.meta.env.DEV) {
      const buffered = (progression as any)?.__bufferedTrialCount?.();
      console.groupCollapsed('[FixSentence][AccountingDiagnostic]');
      console.log('expectedTrialCount:', validationTrialCount);
      console.log('completedTrialResults:', results.length);
      console.log('progressionBufferedTrials:', buffered ?? '(unavailable)');
      console.log('clinicalFloor:', bridge.clinicalFloor, 'raised:', bridge.raised);
      console.groupEnd();
    }

    // Unified commit: progression flush + mastery shadow flush in one call.
    const commitResult = await commitSession();
    if (hasMissingClinicalRawEvidence(commitResult)) {
      setSaveError(true);
      return;
    }
    // Only offer optional conversation-review prompts from a RAW-SAVED
    // exercise. Do not claim a repaired word was practiced in a completed
    // session when its underlying event failed to persist.
    recordFixSentenceReviewTargets(results, activeSessionId);

    const finalize = () => {
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
    };

    // Show patient-facing progression recap when we have real movement data.
    // If snapshot is missing (no buffered trials, persist failed, or already
    // flushed), skip the overlay and finalize immediately to avoid dead state.
    // Never mid-lesson: a "Session complete / Clinical Level" overlay between
    // lesson games reads as the whole session ending. The lesson has its own
    // closing summary; the recap is for standalone runs.
    if (commitResult.progressionSnapshot && !fromLesson) {
      finalizeAfterRecapRef.current = finalize;
      setRecap(commitResult.progressionSnapshot);
    } else {
      finalize();
    }
  }, [fromLesson, completeSession, commitSession, progression, validationTrialCount, bridge, navigate, returnTo, activeSessionId]);

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

  // Wait for the adaptation contract too: games snapshot their trial pool on
  // mount, so mounting before struggling-phoneme targeting resolves would
  // silently discard it (the "never targets his hard sounds" bug).
  const isReady = !isCreatingSession && !!activeSessionId && !adaptation.loading;

  if (!isReady) {
    return <ExerciseLoading />;
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {saveError && <UnverifiedPracticeBanner />}
      {recap && (
        <ProgressionRecap
          gameTitle="Fix the Sentence"
          levelDescription={getFixSentenceLevelSpec(
            recap.leveledUp ? recap.next.level : recap.prev.level,
          ).description}
          prev={recap.prev}
          next={recap.next}
          leveledUp={recap.leveledUp}
          onContinue={() => {
            const fn = finalizeAfterRecapRef.current;
            finalizeAfterRecapRef.current = null;
            setRecap(null);
            fn?.();
          }}
        />
      )}
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

      <main className="container px-4 py-2 flex-1 flex flex-col overflow-y-auto pb-4 tall:pb-16">
        {completed ? (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-bold">Exercise Complete!</h2>
            <p className="text-muted-foreground">{fromLesson ? 'Loading next exercise…' : 'Great job fixing those sentences!'}</p>
            {!fromLesson && <Button onClick={handleContinue} size="lg">Continue</Button>}
          </div>
        ) : !progression.loaded ? (
          // Phase 3 load-gate: don't mount the game until persistent
          // clinical progression resolves, otherwise the floor collapses to 1.
          <ExerciseLoadGate inline loadingLabel="Loading your progress..." />

        ) : (
          <>
            {import.meta.env.DEV &&
              (() => {
                console.log(
                  `[Phase3 load-gate] FixSentence first paint — clinicalLevel=${progression.startingLevel} ` +
                    `floor=${bridge.clinicalFloor} raised=${bridge.raised}`,
                );
                return null;
              })()}
            <FixSentenceGame
              onTrialComplete={handleTrialComplete}
              onGameComplete={handleGameComplete}
              trialCount={validationTrialCount}
              focusPhonemes={adaptation.focusPhonemes}
              sessionId={activeSessionId}
              userId={user?.id}
              profileId={activeProfile?.id}
              initialDifficultyFloor={bridge.clinicalFloor}
              clinicalLevel={progression.startingLevel}
              registerFlush={(fn) => { flushAdaptationLogsRef.current = fn; }}
            />
          </>
        )}
      </main>

      {fromLesson && <SessionSidePanel />}
    </div>
  );
}
