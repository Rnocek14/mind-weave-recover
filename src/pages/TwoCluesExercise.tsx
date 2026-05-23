/**
 * Two Clues Word Association Exercise Page
 *
 * Phase 2 (Universal Clinical Migration):
 *   - Replaces `useExerciseTelemetry` + manual `logTrial` with the unified
 *     `useTrialSubmission` pathway. `exercise_events` + mastery shadow now
 *     flow through one call site (lexical axis).
 *   - `adaptation_trial_logs` continues to be auto-written from
 *     `TwoCluesGame`'s own `useInGameAdaptation(autoLog:true)` controller —
 *     it already owns the per-trial logger via `onTrialLogged`.
 *   - SupportLevel mapping uses the **lexical axis** contract:
 *     baseline retrieval = `independent`, anchor reached = `semantic_cue`.
 *     See `docs/unified-trial-contract.md` §"Per-axis supportUsed".
 *   - No per-game progression hook yet — `progression: null` keeps the
 *     buffer + clinical_progression_state flush as no-ops (Phase 3 work).
 */

import { ExerciseLoading } from '@/components/exercise/ExerciseLoading';
import React, { useCallback, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TwoCluesGame } from '@/components/TwoCluesGame';
import { TwoCluesTrialResult } from '@/hooks/useTwoCluesGame';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useTrialSubmission } from '@/hooks/useTrialSubmission';
import { extractAnswerFromTranscript } from '@/lib/speechNormalizer';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';
import {
  useTwoCluesProgression,
  mapTwoCluesSupport,
} from '@/hooks/useTwoCluesProgression';
import { resolveEffectiveTwoCluesInitialDifficulty } from '@/lib/progression/twoCluesDifficultyBridge';
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

  // Clinical Progression v1 — Wave 1 wiring for Two Clues.
  // Persistent Clinical Level (1–8) supplies a FLOOR on the 1–10 engine
  // tier. Session adaptation can still escalate above this floor.
  const progression = useTwoCluesProgression({
    userId: user?.id,
    profileId: activeProfile?.id,
  });
  const bridge = resolveEffectiveTwoCluesInitialDifficulty({
    sessionAdaptationDifficulty: adaptation.difficultyTier,
    clinicalLevel: progression.startingLevel,
    supportBaseline: progression.state?.supportBaseline ?? 0,
  });
  if (import.meta.env.DEV && bridge.softRegressionScaffold) {
    console.log(
      `[SoftRegression] TwoClues scaffolding active — supportBaseline=${progression.state?.supportBaseline} ` +
        `lowered floor by 1 (clinicalLevel=${progression.startingLevel}, floor=${bridge.clinicalFloor}, effective=${bridge.effective})`,
    );
  }

  // Unified trial submission (lexical axis). Progression is wired through
  // useTwoCluesProgression — every submitTrial buffers a clinical trial,
  // commitSession flushes the L1–L8 ladder. TwoCluesGame's adaptation is
  // autoLog:false, so the page is the single writer.
  const { submitTrial, commitSession } = useTrialSubmission({
    userId: user?.id,
    profileId: activeProfile?.id,
    sessionId: activeSessionId,
    exerciseSlug: EXERCISE_SLUG,
    progression,
  });

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

    // Lexical axis SupportLevel mapping:
    //   independent  → produced from the two clues alone (no anchor)
    //   semantic_cue → anchor word was shown (semantic scaffold)
    // TwoClues never escalates to phonemic / full-model, so the ladder
    // stops at semantic_cue.
    const usedAnchor = !!result.reachedAnchor;
    const supportUsed = mapTwoCluesSupport(usedAnchor);
    const cleanedAnswer = extractAnswerFromTranscript(result.spokenWord);

    void submitTrial({
      profileId: activeProfile?.id,
      sessionId: activeSessionId,
      gameId: EXERCISE_SLUG,
      level: bridge.effective ?? adaptation.difficultyTier ?? 1,
      stimulusId: result.puzzleId,
      expectedResponse: Array.isArray(result.anchors) ? result.anchors[0] ?? null : null,
      userResponse: cleanedAnswer ?? result.spokenWord ?? null,
      isCorrect,
      accuracyScore: typeof result.semanticSimilarity === 'number' ? result.semanticSimilarity : (isCorrect ? 1 : 0),
      cueLevel: usedAnchor ? 1 : 0,
      supportUsed,
      latencyMs: result.reactionTimeMs ?? null,
      trialMode: 'production',
      errorType: isCorrect ? undefined : (result.tier === 'uncertain' ? 'no_match' : 'semantic_paraphasia'),
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
        cue_type_given: adaptation.recommendedCueType !== 'none' ? adaptation.recommendedCueType : 'none',
        clinical_level: progression.startingLevel,
        clinical_floor: bridge.clinicalFloor,
        ...adaptationTelemetry,
      },
    });

    if (pivot.shouldStepDown) {
      console.log('[TwoClues] Mid-session pivot: step down', pivot.pivotReason);
      pivot.acknowledge();
    }
  }, [activeSessionId, activeProfile?.id, submitTrial, adaptation, adaptationTelemetry, pivot]);

  // Handle game completion
  const handleGameComplete = useCallback(async (results: TwoCluesTrialResult[]) => {
    // Unified commit: drains adaptation log buffer + flushes mastery shadow.
    await commitSession();

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
  }, [fromLesson, completeSession, commitSession, navigate, returnTo]);



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

  // Load gate: clinical progression must load before the game mounts so
  // the bridge's effective floor is in place from trial 1. Mirrors
  // SemanticFeatures / MinimalPairs Wave 0 gate.
  const isReady = !isCreatingSession && !!activeSessionId && progression.loaded;

  if (!isReady) {
    return <ExerciseLoading />;
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
