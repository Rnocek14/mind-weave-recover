import { confirmRawEventWrites } from '@/lib/trial/confirmRawEventWrites';
import { UnverifiedPracticeBanner } from '@/components/exercise/UnverifiedPracticeBanner';
/**
 * Narrative Retell Exercise Page — wrapper with session lifecycle.
 * Now consumes shared adaptation contract (profile-aware, not phoneme-targeted).
 */
import { ExerciseLoading } from '@/components/exercise/ExerciseLoading';
import React, { useCallback, useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NarrativeRetellGame } from '@/components/NarrativeRetellGame';
import { NarrativeTrialResult } from '@/hooks/useNarrativeRetellGame';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useExerciseTelemetry } from '@/hooks/useExerciseTelemetry';
import { useSessionStallWatchdog } from '@/hooks/useSessionStallWatchdog';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { saveExerciseDetails } from '@/lib/exerciseDetailsStore';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';
import { classifyNarrativeRoundEvidence } from '@/lib/narrative/roundEvidence';
import { useNarrativeRetellTrainingStage } from '@/hooks/useNarrativeRetellTrainingStage';
import { getNarrativeTrainingStage, type NarrativeTrainingStageLevel } from '@/lib/narrative/trainingStages';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { InlineSessionProgress } from '@/components/InlineSessionProgress';
import { SessionSidePanel } from '@/components/SessionSidePanel';

const EXERCISE_SLUG = 'narrative_retell';

export default function NarrativeRetellExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isOfflineMode = typeof window !== 'undefined' && localStorage.getItem('offlineMode') === 'true';
  const { activeProfile } = useProfile();
  const [completed, setCompleted] = useState(false);
  const [saveWarning, setSaveWarning] = useState(false);
  const pendingEventWritesRef = useRef<Promise<boolean>[]>([]);
  const exerciseCompleteSentRef = useRef(false);
  const hasAdvancedLessonRef = useRef(false);
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const scoreRef = useRef(0);
  const trialsRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  // Restore lesson context from sessionStorage if route state is lost
  const restoredLessonContext = useMemo(() => {
    if (location.state?.fromLesson) return null;
    try {
      const saved = sessionStorage.getItem('lessonFlowState');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (parsed?.lesson?.exercises?.some((e: any) => 
        e.slug === 'narrative-retell' || e.slug === 'narrative_retell'
      )) {
        return { fromLesson: true, sessionId: parsed.sessionId, adaptations: parsed.adaptations };
      }
    } catch { /* ignore */ }
    return null;
  }, [location.state]);

  const fromLesson = location.state?.fromLesson ?? restoredLessonContext?.fromLesson ?? false;
  const providedSessionId = location.state?.sessionId ?? restoredLessonContext?.sessionId ?? null;
  const trialLimit = Number(location.state?.trialLimit) || 3;
  const returnTo = location.state?.returnTo || '/lesson';
  const blockIndex = location.state?.blockIndex ?? null;

  // Shared adaptation contract — profile-aware, not directly phoneme-targeted
  const adaptation = useSessionAdaptation({
    exerciseSlug: EXERCISE_SLUG,
    lessonAdaptations: location.state?.adaptations,
    defaultErrorType: 'no_response',
  });

  const adaptationTelemetry = buildAdaptationTelemetry(adaptation, {
    phonemeSensitive: false,
    cueSensitive: true,  // narrative prompting can benefit from cue personalization
  });

  const { activeSessionId, isCreatingSession } = useStandaloneSession(user?.id, providedSessionId, EXERCISE_SLUG);
  const training = useNarrativeRetellTrainingStage({
    userId: user?.id,
    profileId: activeProfile?.id,
    offline: isOfflineMode,
  });
  // Care partners can choose an available PRACTICE stage. The choice is local
  // to this patient/session and NEVER changes the persisted clinical level.
  // The start lock prevents changing a story after recording has begun.
  const scope = JSON.stringify([user?.id ?? null, activeProfile?.id ?? null, activeSessionId ?? null]);
  const [stageChoice, setStageChoice] = useState<{ scope: string; level: NarrativeTrainingStageLevel } | null>(null);
  const [practiceStarted, setPracticeStarted] = useState<string | null>(null);
  const caregiverSelected = stageChoice?.scope === scope;
  const activeStage = caregiverSelected
    ? getNarrativeTrainingStage(stageChoice.level)
    : training.stage;
  const practiceStageSource = caregiverSelected
    ? 'care_partner_selection' : activeStage ? 'saved_level' : 'general_practice';
  const stageCanChange = !fromLesson && practiceStarted !== scope && !completed && !saveWarning;

  const getSessionStats = useCallback(() => ({
    score: scoreRef.current, totalTrials: trialsRef.current, startTime: startTimeRef.current,
  }), []);

  const { completeSession } = useSessionLifecycle({
    sessionId: activeSessionId, userId: user?.id, profileId: activeProfile?.id,
    exerciseSlug: EXERCISE_SLUG, getSessionStats,
  });

  const { logTrial } = useExerciseTelemetry(activeSessionId, normalizeExerciseSlug(EXERCISE_SLUG));

  // Watchdog: warn + log if no trial advances within 90s of session start
  useSessionStallWatchdog({
    sessionId: activeSessionId,
    exerciseSlug: EXERCISE_SLUG,
    trialCount: trialsRef.current,
    disabled: fromLesson, // lesson flow controls its own progression
  });

  const handleTrialComplete = useCallback((result: NarrativeTrialResult) => {
    if (!activeSessionId && !isOfflineMode) return;
    const evidence = classifyNarrativeRoundEvidence(result);
    const isCorrect = evidence.practiceSuccessful;
    // Every selected Stage 1–8 is practice-only. Even if
    // the visual telemetry is missing or delayed, an independently spoken
    // verdict cannot be inferred from this actively assisted task.
    const independentSpokenScoreEligible =
      !activeStage && evidence.independentSpokenScoreEligible;
    // Session totals must reflect DURABLY SAVED eligible evidence, not
    // optimistic UI feedback. A failed final insert cannot inflate the
    // saved session's score or trial count.
    const verifiedScore = independentSpokenScoreEligible &&
      Number.isFinite(result.eventCoverage)
      ? Math.round(result.eventCoverage * 100) : 0;

    let errorType: string | undefined;
    if (result.completionReason === 'skipped' || result.skipped) errorType = 'skipped';
    else if (!result.responseValid) errorType = 'unscorable_retell';
    else if (result.inputMode === 'typed') errorType = 'typed_retell_practice';
    else if (!independentSpokenScoreEligible) errorType = 'supported_retell_practice';
    else if (!isCorrect) {
      if (result.wordCount < 5) errorType = 'minimal_output';
      else if (result.onTopicScore != null && result.onTopicScore < 0.4) errorType = 'off_topic';
      else if (result.eventCoverage === 0) errorType = 'no_event_coverage';
      else errorType = 'low_event_coverage';
    }

    // A raw event has its own durable write. The game may call
    // onGameComplete immediately after onTrialComplete; register the write
    // synchronously so finalization can await the last trial.
    if (!activeSessionId) return; // Explicit offline participation only.
    const pending = logTrial({
      correct: isCorrect,
      browserTranscript: result.inputMode === 'spoken' ? (result.browserTranscript ?? undefined) : undefined,
      reactionTimeMs: result.durationMs,
      errorType,
      taskParameters: {
        trial_mode: activeStage && result.inputMode === 'spoken'
          ? 'scaffolded' : evidence.trialMode,
        clinical_progression_eligible: independentSpokenScoreEligible,
        input_mode: result.inputMode ?? 'unknown',
        completion_reason: result.completionReason ?? 'unknown',
        response_valid: result.responseValid === true,
        required_event_coverage: evidence.requiredEventCoverage,
        support_used: activeStage ? 'visual_or_stall_prompt' : evidence.support,
        independent_spoken_score_eligible: independentSpokenScoreEligible,
        story_id: result.storyId,
        story_tier: result.storyTier ?? null,
        narrative_training_stage: activeStage?.level ?? null,
        narrative_practice_stage_source: practiceStageSource,
        // These new stages only select real practice content and support.
        // There are no approved automated promotion rules yet.
        narrative_stage_promotion_eligible: false,
        story_title: result.allKeyEvents ? undefined : undefined, // placeholder for downstream typing
        prompt: result.allKeyEvents?.join(' | ') ?? null,
        transcript: result.transcript ?? '',
        word_count: result.wordCount,
        duration_ms: result.durationMs,
        events_found: result.eventsFound,
        events_total: result.eventsTotal,
        event_coverage: result.eventCoverage,
        on_topic_score: result.onTopicScore,
        skipped: result.skipped,
        trial_limit: trialLimit,
        ...adaptationTelemetry,
        ...(result.visualSupport ? {
          visual_support_flag: result.visualSupport.flagEnabled,
          visual_support_adaptive_level: result.visualSupport.adaptiveLevel,
          visual_support_baseline: result.visualSupport.baselineSupport,
          visual_support_max_stall_reveal: result.visualSupport.maxStallReveal,
          visual_support_max_resolved: result.visualSupport.maxResolvedSupport,
          visual_support_stall_count: result.visualSupport.stallCount,
          visual_support_rescue_triggered: result.visualSupport.rescueTriggered,
        } : {}),
      },
      trialOutputs: {
        explanation: {
          coverageRatio: result.eventCoverage,
          onTopicScore: result.onTopicScore,
          conceptsFound: result.eventsFound,
          conceptsTotal: result.eventsTotal,
        },
        depth: result.depthTelemetry,
      },
    });
    pendingEventWritesRef.current.push(pending.then(saved => {
      if (saved === true) {
        trialsRef.current += 1;
        scoreRef.current += verifiedScore;
      }
      return saved;
    }));
  }, [activeSessionId, isOfflineMode, logTrial, trialLimit, adaptationTelemetry, activeStage?.level, practiceStageSource]);

  const resumeLessonFlow = useCallback(() => {
    if (hasAdvancedLessonRef.current) return;
    hasAdvancedLessonRef.current = true;
    if (!exerciseCompleteSentRef.current) {
      exerciseCompleteSentRef.current = true;
      window.dispatchEvent(new CustomEvent('exercise-complete', { detail: { exerciseSlug: EXERCISE_SLUG } }));
    }
    navigate(returnTo, { state: { resuming: true }, replace: true });
  }, [navigate]);

  useEffect(() => {
    return () => { if (completionTimeoutRef.current) clearTimeout(completionTimeoutRef.current); };
  }, []);

  const handleGameComplete = useCallback(async (results: NarrativeTrialResult[]) => {
    // Existing legacy telemetry does not use useTrialSubmission's shared
    // commit barrier. Await its own pending raw events before ending the
    // session or navigating to another game.
    const saved = await confirmRawEventWrites(
      pendingEventWritesRef.current.splice(0),
      results.length,
    );
    // Offline practice can finish locally, but is never verified clinical data.
    if (!isOfflineMode && !saved.ok) {
      console.warn('[NarrativeRetell] Session has incomplete raw clinical events', saved);
      setSaveWarning(true);
      return;
    }
    await completeSession();
    setCompleted(true);

    // Save structured details for reflection engine
    if (blockIndex != null && results.length > 0) {
      const r = results[0]; // Typically 1 story per block
      saveExerciseDetails(blockIndex, 'narrative-retell', {
        structureBreakdown: r.structureBreakdown,
        eventCoverage: r.eventCoverage,
        wordCount: r.wordCount,
        eventsFound: r.eventsFound,
        eventsTotal: r.eventsTotal,
      });
    }

    if (fromLesson) {
      completionTimeoutRef.current = setTimeout(() => resumeLessonFlow(), 400);
    }
  }, [fromLesson, completeSession, resumeLessonFlow, blockIndex, isOfflineMode]);

  const handleBack = useCallback(() => navigate(fromLesson ? returnTo : '/dashboard'), [navigate, fromLesson]);
  const handleContinue = useCallback(() => {
    if (fromLesson) {
      resumeLessonFlow();
    } else {
      navigate('/today');
    }
  }, [fromLesson, navigate, resumeLessonFlow]);

  // Even offline practice must wait for the stage configuration. Otherwise
  // the old generic game mounts first and its one-time story queue ignores
  // the patient's actual training stage when the read finishes.
  if (!training.loaded || (!isOfflineMode && (isCreatingSession || !activeSessionId))) {
    return <ExerciseLoading />;
  }

  if (!isOfflineMode && training.loadUnavailable) {
    return (
      <div role="alert" className="min-h-dvh bg-background flex flex-col items-center justify-center gap-5 p-6 text-center">
        <h1 className="text-2xl font-bold">Practice level unavailable</h1>
        <p className="max-w-md text-lg">We couldn't load your saved practice level. Ask a care partner for help.</p>
        <Button size="lg" onClick={() => navigate('/today')}>Return to Today</Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={handleBack}><ArrowLeft className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Back</span></Button>
          <h1 className="text-lg font-semibold">📖 Narrative Retell</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate('/today')}><Home className="h-4 w-4" /></Button>
        </div>
        {fromLesson && <InlineSessionProgress />}
      </header>
      <main className="container px-4 py-2 flex-1 flex flex-col overflow-y-auto pb-16">
        {!training.stage && training.persistedLevel != null && (
          <div role="status" aria-label="Higher stage practice notice" className="rounded-lg border p-3 text-sm">
            Your saved level is {training.persistedLevel}. This higher-level story training is
            not yet clinically validated. You can practice an available story mode here without
            changing your saved level.
          </div>
        )}
        {stageCanChange && (
          <details className="rounded-lg border bg-muted/20 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold">Care partner: choose practice level</summary>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose the story support that feels comfortable. This changes only today's
              practice, not the patient's saved recovery level.
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {([1, 2, 3, 4, 5, 6, 7, 8] as const).map(level => (
                <Button
                  key={level}
                  type="button"
                  size="lg"
                  variant={activeStage?.level === level ? 'default' : 'outline'}
                  aria-pressed={activeStage?.level === level}
                  className="flex-1 min-h-12"
                  onClick={() => setStageChoice({ scope, level })}
                >
                  Stage {level}: {getNarrativeTrainingStage(level)?.label}
                </Button>
              ))}
            </div>
          </details>
        )}
        {saveWarning ? (
          <UnverifiedPracticeBanner />
        ) : completed ? (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="text-6xl">📖</div>
            <h2 className="text-2xl font-bold">Stories Complete!</h2>
            {saveWarning && (
              <p role="alert" className="text-sm text-destructive">
                Some results could not be saved. Your practice still counts as participation,
                but these attempts will not be treated as complete clinical records.
              </p>
            )}
            <p className="text-muted-foreground">
              {fromLesson ? 'Loading next exercise...' : 'Great job retelling those stories!'}
            </p>
            {!fromLesson && <Button onClick={handleContinue} size="lg">Continue</Button>}
          </div>
        ) : (
          <NarrativeRetellGame
            key={[activeProfile?.id ?? 'offline', activeSessionId ?? 'offline', activeStage?.level ?? 'general'].join(':')}
            userId={user?.id}
            sessionId={activeSessionId}
            onTrialComplete={handleTrialComplete}
            onGameComplete={handleGameComplete}
            roundCount={trialLimit}
            tier={activeStage?.storyTier ?? adaptation.difficultyTier}
            trainingStage={activeStage ?? undefined}
            onRetellStarted={() => setPracticeStarted(scope)}
            recommendedCueType={adaptation.recommendedCueType !== 'none' ? adaptation.recommendedCueType as any : undefined}
          />
        )}
      </main>
      {fromLesson && <SessionSidePanel />}
    </div>
  );
}
