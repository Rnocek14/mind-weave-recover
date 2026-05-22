/**
 * Narrative Retell Exercise Page — wrapper with session lifecycle.
 * Now consumes shared adaptation contract (profile-aware, not phoneme-targeted).
 */
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
    const points = Math.round(result.eventCoverage * 100);
    scoreRef.current += points;
    trialsRef.current += 1;

    // Derive errorType for narrative-retell from coverage and on-topic signals
    const isCorrect = result.eventCoverage >= 0.3;
    let errorType: string | undefined;
    if (!isCorrect) {
      if (result.wordCount < 5) errorType = 'minimal_output';
      else if (result.onTopicScore != null && result.onTopicScore < 0.4) errorType = 'off_topic';
      else if (result.eventCoverage === 0) errorType = 'no_event_coverage';
      else errorType = 'low_event_coverage';
    }

    logTrial({
      correct: isCorrect,
      reactionTimeMs: result.durationMs,
      errorType,
      taskParameters: {
        story_id: result.storyId,
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
  }, [activeSessionId, isOfflineMode, logTrial, trialLimit, adaptationTelemetry]);

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

  const handleGameComplete = useCallback((results: NarrativeTrialResult[]) => {
    setCompleted(true);
    completeSession();

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
  }, [fromLesson, completeSession, resumeLessonFlow, blockIndex]);

  const handleBack = useCallback(() => navigate(fromLesson ? returnTo : '/dashboard'), [navigate, fromLesson]);
  const handleContinue = useCallback(() => {
    if (fromLesson) {
      resumeLessonFlow();
    } else {
      navigate('/today');
    }
  }, [fromLesson, navigate, resumeLessonFlow]);

  if (!isOfflineMode && (isCreatingSession || !activeSessionId)) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse text-muted-foreground">Loading exercise...</div></div>;
  }

  return (
    <div className="h-dvh overflow-hidden bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={handleBack}><ArrowLeft className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Back</span></Button>
          <h1 className="text-lg font-semibold">📖 Narrative Retell</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate('/today')}><Home className="h-4 w-4" /></Button>
        </div>
        {fromLesson && <InlineSessionProgress />}
      </header>
      <main className="container px-4 py-2 flex-1 min-h-0 overflow-hidden flex flex-col">
        {completed ? (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="text-6xl">📖</div>
            <h2 className="text-2xl font-bold">Stories Complete!</h2>
            <p className="text-muted-foreground">
              {fromLesson ? 'Loading next exercise...' : 'Great job retelling those stories!'}
            </p>
            {!fromLesson && <Button onClick={handleContinue} size="lg">Continue</Button>}
          </div>
        ) : (
          <NarrativeRetellGame userId={user?.id} sessionId={activeSessionId} onTrialComplete={handleTrialComplete} onGameComplete={handleGameComplete} roundCount={trialLimit} tier={adaptation.difficultyTier} recommendedCueType={adaptation.recommendedCueType !== 'none' ? adaptation.recommendedCueType as any : undefined} />
        )}
      </main>
      {fromLesson && <SessionSidePanel />}
    </div>
  );
}
