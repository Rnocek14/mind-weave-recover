/**
 * Synonym Generator Exercise Page
 *
 * "Give as many synonyms for [word] as you can" with adaptive difficulty.
 *
 * Wave 3 (Phase 2): migrated off raw useExerciseTelemetry to the unified
 * useTrialSubmission pipeline. Only completed speech-only rounds emit
 * `trialMode: 'production'`; typed, mixed and early-ended rounds remain
 * practice data and do not contribute to clinical progression or expressive
 * mastery. The slug `synonym_generator` is adopted for eligible production.
 * Progression is wired via useSynonymGeneratorProgression (L1–L8 ladder)
 * with a load gate so the engine starts at the correct clinical floor.
 */

import { ExerciseLoading } from '@/components/exercise/ExerciseLoading';
import { ExerciseLoadGate } from '@/components/ExerciseLoadGate';
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SynonymGeneratorGame, type SynonymRoundResult } from '@/components/SynonymGeneratorGame';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { InlineSessionProgress } from '@/components/InlineSessionProgress';
import { SessionSidePanel } from '@/components/SessionSidePanel';
import { useTrialSubmission } from '@/hooks/useTrialSubmission';
import {
  useSynonymGeneratorProgression,
  mapSynonymGeneratorSupport,
} from '@/hooks/useSynonymGeneratorProgression';
import { resolveEffectiveSynonymGeneratorInitialDifficulty } from '@/lib/progression/synonymGeneratorDifficultyBridge';
import { classifySynonymRoundEvidence } from '@/lib/synonymGenerator/roundEvidence';
import { isFillerOnly } from '@/lib/clinical/classifyUtteranceValidity';

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
  const trialIndexRef = useRef(0);
  const pendingTrialsRef = useRef<Array<Promise<{ ok: boolean }>>>([]);
  const startTimeRef = useRef(Date.now());

  const restored = useRestoredLessonContext(EXERCISE_SLUG);
  const { fromLesson, returnTo } = restored;
  const providedSessionId = restored.sessionId;
  const roundCount = Number(location.state?.trialLimit) || 3;
  const lessonAdaptations = restored.adaptations;

  const adaptation = useSessionAdaptation({
    exerciseSlug: EXERCISE_SLUG,
    lessonAdaptations,
  });
  const adaptationTelemetry = buildAdaptationTelemetry(adaptation);

  const { activeSessionId, isCreatingSession } = useStandaloneSession(
    user?.id,
    providedSessionId,
    EXERCISE_SLUG
  );

  // Wave 3: Clinical Progression v1 — synonym-generator L1–L8 ladder.
  // Persistent Clinical Level supplies a FLOOR for the in-session engine
  // tier (1–10); session adaptation can still escalate above the floor.
  const progression = useSynonymGeneratorProgression({
    userId: user?.id,
    profileId: activeProfile?.id,
  });
  const bridge = resolveEffectiveSynonymGeneratorInitialDifficulty({
    sessionAdaptationDifficulty: adaptation.difficultyTier,
    clinicalLevel: progression.startingLevel,
    supportBaseline: progression.state?.supportBaseline ?? 0,
  });
  if (import.meta.env.DEV && bridge.softRegressionScaffold) {
    console.log(
      `[SoftRegression] SynonymGenerator scaffolding active — supportBaseline=${progression.state?.supportBaseline} ` +
        `lowered floor by 1 (clinicalLevel=${progression.startingLevel}, floor=${bridge.clinicalFloor}, effective=${bridge.effective})`,
    );
  }
  const difficultyLevel = bridge.effective;

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

  // Unified trial submission is the single data writer. Only eligible
  // speech rounds enter expressive mastery; typed/mixed practice is recorded
  // with its true mode and excluded from verified clinical scores.
  const { submitTrial, commitSession } = useTrialSubmission({
    userId: user?.id,
    profileId: activeProfile?.id,
    sessionId: activeSessionId,
    exerciseSlug: EXERCISE_SLUG,
    progression,
  });

  const pivot = useExerciseMidSessionPivot({
    exerciseSlug: EXERCISE_SLUG,
    domainSlug: 'semantic_depth',
    fromLesson,
  });

  const handleDifficultyChange = useCallback((newLevel: number, direction: 'up' | 'down') => {
    console.log(`[SynonymGenerator] Adaptive difficulty ${direction}: now level ${newLevel}`);
  }, []);

  const handleRoundComplete = useCallback((result: SynonymRoundResult) => {
    if (!activeSessionId) return;
    trialsRef.current += 1;
    trialIndexRef.current += 1;
    scoreRef.current += result.matchCount;

    const evidence = classifySynonymRoundEvidence(result);
    const isCorrect = evidence.practiceSuccessful;
    if (evidence.clinicalProgressionEligible) {
      pivot.recordTrialResult({
        wasCorrect: isCorrect,
        reactionTimeMs: result.durationSec * 1000,
      });
    }
    let errorType: string | undefined;
    if (!isCorrect) {
      if (result.browserTranscript && isFillerOnly(result.browserTranscript)) {
        errorType = 'filler_only';
      } else if (result.totalEntered === 0) errorType = 'no_response';
      else if (result.matchCount === 0) errorType = 'no_valid_synonyms';
      else errorType = 'low_synonym_count';
    }

    const pending = submitTrial({
      profileId: activeProfile?.id,
      sessionId: activeSessionId,
      gameId: EXERCISE_SLUG,
      level: result.difficulty ?? difficultyLevel,
      stimulusId: result.targetWord ?? `syn_trial_${trialIndexRef.current}`,
      expectedResponse: null,
      userResponse: result.enteredWords?.join(', ') ?? null,
      browserTranscript: result.browserTranscript,
      isCorrect,
      accuracyScore: result.totalEntered > 0 ? result.matchCount / Math.max(result.totalEntered, 1) : 0,
      cueLevel: 0,
      supportUsed: mapSynonymGeneratorSupport(),
      latencyMs: Math.round(result.durationSec * 1000),
      trialMode: evidence.trialMode,
      clinicalProgressionEligible: evidence.clinicalProgressionEligible,
      errorType,
      taskParameters: {
        // This page owns the adaptation_trial_logs writer (game is autoLog:false).
        unified_route_adaptation_log: true,
        target_word: result.targetWord,
        matched_synonyms: result.matchedSynonyms,
        unmatched_entries: result.unmatchedEntries,
        match_count: result.matchCount,
        total_entered: result.totalEntered,
        input_mode: result.inputMode,
        completion_reason: result.completionReason,
        time_limit: result.timeLimitSec,
        actual_duration_sec: result.durationSec,
        required_matches: evidence.requiredMatches,
        verified_spoken_score_eligible: evidence.verifiedSpokenScoreEligible,
        difficulty: result.difficulty,
        difficulty_changed: result.difficultyChanged ?? null,
        pivot_pending: pivot.hasPending,
        clinical_level: progression.startingLevel,
        clinical_floor: bridge.clinicalFloor,
        ...adaptationTelemetry,
      },
    });
    // The game emits onRoundComplete and onGameComplete in the same tick.
    // Queue the promise synchronously, before a final-round commit can run.
    pendingTrialsRef.current.push(pending);

    if (pivot.shouldStepDown && evidence.clinicalProgressionEligible) {
      console.log('[SynonymGenerator] Pivot: step down', pivot.pivotReason);
      pivot.acknowledge();
    }
  }, [activeSessionId, submitTrial, adaptationTelemetry, pivot, activeProfile?.id, difficultyLevel, progression.startingLevel, bridge.clinicalFloor]);

  const handleGameComplete = useCallback(async (results: SynonymRoundResult[]) => {
    setCompleted(true);
    // Await every raw record before flushing the progression buffer and
    // longitudinal mastery. The last round otherwise races the commit.
    const pending = pendingTrialsRef.current.splice(0);
    const outcomes = await Promise.allSettled(pending);
    const failed = outcomes.filter(entry =>
      entry.status === 'rejected' || (entry.status === 'fulfilled' && !entry.value.ok),
    );
    if (failed.length) {
      console.warn('[SynonymGenerator] Raw event persistence failed for', failed.length, 'rounds; these do not advance progression');
    }
    const commit = await commitSession();
    if (!commit.ok) {
      console.warn('[SynonymGenerator] Clinical progression commit incomplete', commit.errors);
    }
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
        navigate(returnTo, { state: { resuming: true }, replace: true });
      }, 400);
    }
  }, [fromLesson, completeSession, commitSession, navigate, returnTo]);

  const handleBack = useCallback(() => {
    navigate(fromLesson ? returnTo : '/dashboard');
  }, [navigate, fromLesson, returnTo]);

  const isReady = !isCreatingSession && !!activeSessionId;

  if (!isReady) {
    return <ExerciseLoading />;
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <h1 className="text-lg font-semibold">🔄 Synonym Generator</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate('/today')}>
            <Home className="h-4 w-4" />
          </Button>
        </div>
        {fromLesson && <InlineSessionProgress />}
      </header>

      <main className="container px-4 py-2 flex-1 flex flex-col overflow-y-auto pb-16">
        {completed ? (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="text-6xl">🏆</div>
            <h2 className="text-2xl font-bold">Great Work!</h2>
            <p className="text-muted-foreground">
              {fromLesson ? 'Loading next exercise…' : 'Nice synonym practice!'}
            </p>
            {!fromLesson && (
              <Button onClick={() => navigate('/today')} size="lg">Continue</Button>
            )}
          </div>
        ) : progression.loaded ? (
          <SynonymGeneratorGame
            difficulty={difficultyLevel}
            onRoundComplete={handleRoundComplete}
            onGameComplete={handleGameComplete}
            onDifficultyChange={handleDifficultyChange}
            roundCount={roundCount}
            autoStartFirst={fromLesson}
            userId={user?.id}
            sessionId={activeSessionId}
          />
        ) : (
          <ExerciseLoadGate inline loadingLabel="Loading your progression…" />
        )}
      </main>

      {fromLesson && <SessionSidePanel />}
    </div>
  );
}
