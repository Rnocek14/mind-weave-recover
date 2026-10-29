/**
 * Fix the Sentence Exercise Page
 * 
 * Wrapper with session lifecycle, telemetry, and navigation.
 * Now consumes shared adaptation contract.
 */

import { ExerciseLoading } from '@/components/exercise/ExerciseLoading';
import { ExerciseLoadGate } from '@/components/ExerciseLoadGate';
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FixSentenceGame } from '@/components/FixSentenceGame';
import { FixSentenceTrialResult } from '@/hooks/useFixSentenceGame';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useTrialSubmission } from '@/hooks/useTrialSubmission';
import { useVerifiedExerciseCompletion } from '@/hooks/useVerifiedExerciseCompletion';
import { ExerciseSaveFeedback } from '@/components/exercise/ExerciseSaveFeedback';
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

const EXERCISE_SLUG = 'fix_sentence';

export default function FixSentenceExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  // Validation harness: ?validation=1 → 10 trials so adaptation can show both
  // UP and DOWN within one session. Production users still get 5.
  const validationTrialCount = useValidationTrialCount(5, 10);
  const [recap, setRecap] = useState<CommitSessionResult['progressionSnapshot'] | null>(null);
  const confirmedProgressionRef = useRef<CommitSessionResult['progressionSnapshot'] | null>(null);
  const dispatchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (dispatchTimeoutRef.current !== null) clearTimeout(dispatchTimeoutRef.current);
  }, []);

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

  const { activeSessionId, isCreatingSession, sessionError, retrySession } = useStandaloneSession(
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
  const { submitTrial, commitSession, retryFailedSubmissions } = useTrialSubmission({
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

    const validity = classifyUtteranceValidity({
      transcript: result.spokenWord,
      asrConfidence: null,
      recordingDurationMs: result.reactionTimeMs,
    });

    void submitTrial({
      profileId: activeProfile?.id,
      sessionId: activeSessionId,
      gameId: EXERCISE_SLUG,
      level: result.difficulty ?? 1,
      stimulusId: result.trialId,
      expectedResponse: result.wrongWord,
      userResponse: result.spokenWord,
      isCorrect: result.isCorrect,
      accuracyScore: result.semanticSimilarity ?? null,
      // cue_level stays 0: choice tiles are a RESPONSE-FORMAT support
      // (supportUsed), not an issued cue — per the locked cross-game
      // cue_level contract (docs/unified-trial-contract.md).
      cueLevel: 0,
      supportUsed: result.support ?? 'open_response',
      latencyMs: result.reactionTimeMs ?? null,
      trialMode: 'production',
      validity,
      errorType: result.isCorrect ? undefined : (result.isPartialCredit ? 'incorrect_close' : 'incorrect_fix'),
      taskParameters: buildFixSentenceTaskParameters(result, {
        phoneme_matched: phonemeMatched,
        phoneme_targets: result.phonemeTargets,
        ...adaptationTelemetry,
      }),
    });
  }, [activeSessionId, activeProfile?.id, submitTrial, adaptationTelemetry, adaptation.focusPhonemes]);

  const verifiedCommit = useCallback(async () => {
    // FixSentenceGame owns an in-game adaptation log buffer; its final row
    // must flush before we can claim a complete clinical session.
    // A failed flush is recoverable on the same original result without
    // falsely reporting a completed lesson.
    try {
      await flushAdaptationLogsRef.current?.();
    } catch (error) {
      console.warn('[FixSentenceExercise] Final adaptation log flush not confirmed', error);
      return { ok: false };
    }

    const saved = await commitSession();
    if (saved.ok) confirmedProgressionRef.current = saved.progressionSnapshot;
    return saved;
  }, [commitSession]);

  const handleConfirmedCompletion = useCallback((results: FixSentenceTrialResult[]) => {
    if (fromLesson) {
      dispatchTimeoutRef.current = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('exercise-complete', {
          detail: { exerciseSlug: EXERCISE_SLUG, results },
        }));
        navigate(returnTo, { state: { resuming: true }, replace: true });
      }, 400);
    } else if (confirmedProgressionRef.current) {
      // The patient's progression recap is a reward for a verified save.
      // Never show it after a partial commit or a failed session close.
      setRecap(confirmedProgressionRef.current);
    }
  }, [fromLesson, navigate, returnTo]);

  const { saveState, finish, retry } = useVerifiedExerciseCompletion<FixSentenceTrialResult[]>({
    scope: user?.id && activeProfile?.id && activeSessionId
      ? JSON.stringify([user.id, activeProfile.id, activeSessionId, EXERCISE_SLUG])
      : null,
    commitSession: verifiedCommit,
    completeSession,
    retryFailedSubmissions,
    onConfirmed: handleConfirmedCompletion,
  });

  const handleGameComplete = useCallback((results: FixSentenceTrialResult[]) => {
    if (import.meta.env.DEV) {
      console.info('[FixSentence] Finished trials, awaiting verified save', {
        expectedTrialCount: validationTrialCount,
        resultCount: results.length,
        clinicalFloor: bridge.clinicalFloor,
      });
    }
    void finish(results);
  }, [bridge.clinicalFloor, finish, validationTrialCount]);

  const handleBack = useCallback(() => {
    navigate(fromLesson ? returnTo : '/dashboard');
  }, [navigate, fromLesson]);

  const handleContinue = useCallback(() => navigate('/today'), [navigate]);

  // Wait for the adaptation contract too: games snapshot their trial pool on
  // mount, so mounting before struggling-phoneme targeting resolves would
  // silently discard it (the "never targets his hard sounds" bug).
  const isReady = !isCreatingSession && !!activeSessionId && !adaptation.loading;

  if (!isReady) {
    return <ExerciseLoading error={sessionError} onRetry={sessionError ? retrySession : undefined} />;
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {recap && (
        <ProgressionRecap
          gameTitle="Fix the Sentence"
          levelDescription={getFixSentenceLevelSpec(
            recap.leveledUp ? recap.next.level : recap.prev.level,
          ).description}
          prev={recap.prev}
          next={recap.next}
          leveledUp={recap.leveledUp}
          onContinue={() => setRecap(null)}
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
        {saveState === 'saving' || saveState === 'error' ? (
          <ExerciseSaveFeedback
            state={saveState}
            onRetry={() => void retry()}
            onExit={() => navigate('/today')}
          />
        ) : saveState === 'complete' ? (
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
              key={JSON.stringify([user?.id, activeProfile?.id, activeSessionId])}
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
