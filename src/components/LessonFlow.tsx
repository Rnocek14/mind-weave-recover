import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { DailyCapabilityCheck } from "./DailyCapabilityCheck";
import { CapabilityAssessment } from "./CapabilityAssessment";
import { SessionSummaryScreen } from "./SessionSummaryScreen";
import { ExerciseTransitionOverlay } from "./ExerciseTransitionOverlay";
import { SessionArcBar, getAdaptivityMessage, shouldPivotToSupport } from "./SessionArcBar";
import { SessionPreviewCard } from "./SessionPreviewCard";
import { Card } from "@/components/ui/card";
import { Play } from "lucide-react";
import { humanizeSlug } from "@/lib/performanceAwareFeedback";
import type { DailyLesson } from "@/lib/dailyLessonEngine";
import type { ClinicalProfile } from "@/lib/clinicalProfileMapper";
import type { TodayFocus } from "@/lib/adaptiveDecisionEngine";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useCoachingMode } from "@/contexts/CoachingModeContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isAdaptationEnabled } from "@/lib/adaptiveEngineConfig";
import { decidePause, type PauseDecision } from "@/lib/adaptivePauseLogic";
import { resetFeedbackHistory } from "@/lib/sessionFeedbackCopy";
import { endSession as endSessionTracking } from "@/lib/sessionTracking";
import { flushVoiceSessionQueue } from "@/lib/voiceController";
import {
  trackFirstExerciseLaunch,
  trackExerciseComplete,
  trackSessionDropOff,
  trackSessionComplete,
  associateSessionWithFlow,
} from "@/lib/sessionFlowAnalytics";
import { clearExerciseDetails } from "@/lib/exerciseDetailsStore";
import { prefetchExerciseRoute } from "@/lib/exercisePrefetch";
import { getExercisePurpose } from "@/lib/exercisePurposeMap";
import { getExerciseMicroGuidance } from "@/lib/exerciseMicroGuidance";
import { MayaSessionFrame } from "./MayaSessionFrame";
import { getSessionFrame, getOrCreateSessionFrame } from "@/lib/sessionFrameTemplates";
import type { SessionFrameTemplate, BlockResult } from "@/lib/sessionFrameTemplates";
import { useUiProfile } from "@/hooks/useUiProfile";
import { variantClass, isMinimal, isSimplified } from "@/lib/ui/variantClass";
import { useDoseCap } from "@/hooks/useDoseCap";
import { DoseCapWarning } from "./DoseCapWarning";


type FlowPhase = 
  | "daily-check" 
  | "full-assessment" 
  | "session-preview"
  | "maya-intro"
  | "maya-transition"
  | "exercise" 
  | "transition" 
  | "micro-pause"
  | "summary";

interface LessonFlowProps {
  lesson: DailyLesson;
  clinicalProfile: ClinicalProfile | null;
  todayFocus?: TodayFocus | null;
  focusWords?: string[];
}

export const LessonFlow = ({ lesson, clinicalProfile, todayFocus, focusWords }: LessonFlowProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const { showPurpose, isVoiceLed } = useCoachingMode();
  const { profile: uiProfile } = useUiProfile();
  const variant = uiProfile.variant;
  const { doseCap } = useDoseCap(user?.id);
  const isOfflineMode = typeof window !== 'undefined' && localStorage.getItem('offlineMode') === 'true';

  const skipDailyCheck = location.state?.skipDailyCheck ?? false;
  const autoStart = location.state?.autoStart ?? false;

  const getInitialPhase = (): FlowPhase => {
    if (autoStart) return "session-preview";
    if (skipDailyCheck) return "session-preview";
    return "daily-check";
  };

  const [phase, setPhase] = useState<FlowPhase>(getInitialPhase);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentPause, setCurrentPause] = useState<PauseDecision | null>(null);
  const [activeSupportPivot, setActiveSupportPivot] = useState(false);
  const [lastPivotWasSupport, setLastPivotWasSupport] = useState(false);
  const [runtimeBlocks, setRuntimeBlocks] = useState(lesson.blocks);
  
  // Session frame template — always create one for Full Coaching, even without explicit ID
  const sessionFrame = getOrCreateSessionFrame(lesson.sessionFrameId, lesson.blocks);
  
  // Clear stale sessionStorage when mounting with a fresh lesson (not resuming)
  useEffect(() => {
    if (!location.state?.resuming) {
      const saved = sessionStorage.getItem('lessonFlowState');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // If the saved lesson blocks don't match the current lesson, it's stale
          const savedBlockCount = parsed.blockCount;
          const savedFirstExercise = parsed.firstExerciseId;
          if (
            savedBlockCount !== lesson.blocks.length ||
            savedFirstExercise !== lesson.blocks[0]?.exerciseId
          ) {
            console.log('[LessonFlow] Clearing stale sessionStorage (lesson mismatch)');
            sessionStorage.removeItem('lessonFlowState'); localStorage.removeItem('lessonFlowState_resume');
          }
        } catch {
          sessionStorage.removeItem('lessonFlowState'); localStorage.removeItem('lessonFlowState_resume');
        }
      }
    }
  }, []); // Only on mount
  
  // Hardened state refs to prevent double-processing
  const hasProcessedResumeRef = useRef(false);
  const isCreatingSessionRef = useRef(false);
  const hasTrackedFirstLaunchRef = useRef(false);
  const sessionStartTimeRef = useRef(Date.now());
  
  // Performance tracking for adaptive pauses
  const recentScoresRef = useRef<number[]>([]);
  const recentRTRef = useRef<number[]>([]);
  const recentTimeoutsRef = useRef(0);
  const lastExerciseScoreRef = useRef<number | null>(null);
  const blockScoresRef = useRef<Record<number, number>>({});

  const currentBlock = runtimeBlocks[currentBlockIndex];
  const isLastBlock = currentBlockIndex === runtimeBlocks.length - 1;

  const finishLessonSession = useCallback((
    targetSessionId: string | null,
    blockCount: number,
    reason: 'completed' | 'manual' = 'completed',
  ) => {
    const elapsedMs = Date.now() - sessionStartTimeRef.current;

    if (reason === 'completed') {
      trackSessionComplete(targetSessionId, blockCount, elapsedMs);
    }

    // Close the session row so completed lesson flows do not get swept later.
    // Best-effort: any failure is logged but never blocks the summary screen.
    if (targetSessionId) {
      const scores = recentScoresRef.current;
      const avgScore = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;
      endSessionTracking(
        targetSessionId,
        {
          durationSec: Math.max(1, Math.floor(elapsedMs / 1000)),
          scores: { average: avgScore },
          reps: blockCount,
        },
        reason,
      ).catch((err) => {
        console.warn('[LessonFlow] endSession failed:', err);
      });
    }

    // Hard-stop any in-flight / queued Maya audio so the last exercise's
    // instructions can't keep speaking over the summary screen.
    flushVoiceSessionQueue('session-complete');
    setPhase('summary');
  }, []);

  const advanceAfterCompletedExercise = useCallback((params: {
    parsed: any;
    savedIndex: number;
    savedSessionId: string | null;
    isDirectJump?: boolean;
    detail?: any;
  }) => {
    const { parsed, savedIndex, savedSessionId, isDirectJump = false, detail } = params;
    const nextIndex = isDirectJump ? savedIndex : savedIndex + 1;
    const isLast = nextIndex >= lesson.blocks.length;

    if (typeof parsed.sessionStartTime === 'number') {
      sessionStartTimeRef.current = parsed.sessionStartTime;
    }
    if (parsed.recentScores) recentScoresRef.current = parsed.recentScores;
    if (parsed.recentRTs) recentRTRef.current = parsed.recentRTs;
    if (parsed.recentTimeouts != null) recentTimeoutsRef.current = parsed.recentTimeouts;
    if (parsed.blockScores) blockScoresRef.current = parsed.blockScores;

    if (!isDirectJump) {
      if (detail?.score != null) {
        recentScoresRef.current = [...recentScoresRef.current.slice(-4), detail.score];
        lastExerciseScoreRef.current = detail.score;
        blockScoresRef.current[savedIndex] = detail.score;
      }
      if (detail?.avgReactionTime != null) {
        recentRTRef.current = [...recentRTRef.current.slice(-4), detail.avgReactionTime];
      }
      if (detail?.timeouts != null) {
        recentTimeoutsRef.current = detail.timeouts;
      }

      trackExerciseComplete(
        savedSessionId,
        savedIndex,
        lesson.blocks.length,
        lesson.blocks[savedIndex]?.exerciseId || 'unknown',
      );
    }

    setSessionId(savedSessionId);
    setCurrentBlockIndex(nextIndex);

    if (isLast && !isDirectJump) {
      finishLessonSession(savedSessionId, lesson.blocks.length, 'completed');
      return;
    }

    if (isDirectJump) {
      setPhase('exercise');
      return;
    }

    const pauseDecision = decidePause({
      completedCount: nextIndex,
      recentScores: recentScoresRef.current,
      recentReactionTimes: recentRTRef.current,
      elapsedMinutes: Math.floor((Date.now() - (parsed.sessionStartTime || Date.now())) / 60000),
      fatigueFlag: (todayFocus?.adaptations?.sessionDurationCap != null && todayFocus.adaptations.sessionDurationCap <= 10),
      recentTimeouts: recentTimeoutsRef.current,
    });

    console.log('[LessonFlow] Resume adaptive pause decision:', pauseDecision);
    setCurrentPause(pauseDecision);

    if (sessionFrame && (showPurpose || isVoiceLed)) {
      if (!sessionFrame.mayaTransitions[nextIndex]) {
        sessionFrame.mayaTransitions[nextIndex] = `Good work on that. Let's continue with the next exercise.`;
      }
      console.log('[LessonFlow] Resume: showing maya-transition for block', nextIndex);
      setPhase('maya-transition');
    } else {
      setPhase(pauseDecision.type === 'micro-pause' ? 'micro-pause' : 'transition');
    }
  }, [finishLessonSession, isVoiceLed, lesson.blocks, sessionFrame, showPurpose, todayFocus]);
  
  // Restore state if returning from exercise — with deduplication guard
  useEffect(() => {
    if (location.state?.resuming && !hasProcessedResumeRef.current) {
      hasProcessedResumeRef.current = true;
      
      const savedState = sessionStorage.getItem('lessonFlowState');
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          const savedIndex = parsed.currentBlockIndex;
          const savedSessionId = parsed.sessionId;
          
          // Guard: don't process if index is out of bounds
          if (typeof savedIndex !== 'number' || savedIndex < 0 || savedIndex >= lesson.blocks.length) {
            console.warn('[LessonFlow] Invalid saved index:', savedIndex);
            return;
          }
          
          const isDirectJump = location.state?.directJump !== undefined;
          const nextIndex = isDirectJump ? savedIndex : savedIndex + 1;
          console.log('[LessonFlow] Processing resume:', {
            savedIndex,
            nextIndex,
            isLast: nextIndex >= lesson.blocks.length,
            isDirectJump,
          });

          advanceAfterCompletedExercise({
            parsed,
            savedIndex,
            savedSessionId,
            isDirectJump,
            detail: (location.state as any)?.exerciseResult,
          });
        } catch (error) {
          console.error('[LessonFlow] Error processing resume:', error);
        }
      }
    } else if (!location.state?.resuming && !hasProcessedResumeRef.current) {
      hasProcessedResumeRef.current = true;
      const savedState = sessionStorage.getItem('lessonFlowState');
      if (savedState) {
        try {
          const { phase: savedPhase, currentBlockIndex: savedIndex, sessionId: savedSessionId } = JSON.parse(savedState);
          
          // Guard: validate saved state
          if (typeof savedIndex !== 'number' || savedIndex < 0 || savedIndex >= lesson.blocks.length) {
            console.warn('[LessonFlow] Stale saved state, ignoring');
            sessionStorage.removeItem('lessonFlowState'); localStorage.removeItem('lessonFlowState_resume');
            return;
          }
          
          // Guard: if saved phase is 'exercise', the user exited mid-session.
          // Preserve the resumable state and send them back to Today so the
          // Continue session card can appear reliably.
          //
          // EXCEPTION: when the user explicitly started a fresh session
          // (autoStart), a leftover 'exercise' state is just stale storage that
          // didn't get cleared. Bouncing here causes the "flash the lesson plan
          // then return to /today" bug. Clear the stale state and proceed.
          if (savedPhase === 'exercise') {
            if (autoStart) {
              console.log('[LessonFlow] Stale interrupted-exercise state on fresh start, clearing and continuing');
              sessionStorage.removeItem('lessonFlowState'); localStorage.removeItem('lessonFlowState_resume');
              // Don't restore the stale phase — let the fresh session-preview proceed.
              return;
            }
            console.log('[LessonFlow] Detected interrupted exercise, preserving resume state and redirecting to /today');
            navigate('/today', { replace: true });
            return;
          }
          
          console.log('[LessonFlow] Restoring state (non-resuming):', { savedPhase, savedIndex, savedSessionId });
          setPhase(savedPhase);
          setCurrentBlockIndex(savedIndex);
          setSessionId(savedSessionId);
        } catch (error) {
          console.error('[LessonFlow] Error restoring state:', error);
          sessionStorage.removeItem('lessonFlowState'); localStorage.removeItem('lessonFlowState_resume');
        }
      }
    }
  }, [
    advanceAfterCompletedExercise,
    autoStart,
    lesson.blocks.length,
    location.state?.directJump,
    location.state?.exerciseResult,
    location.state?.resuming,
    navigate,
  ]);

  // Create session when needed — with dedup guard
  useEffect(() => {
    const needsSession = phase === "exercise" && !sessionId && user && !isCreatingSessionRef.current;
    if (needsSession) {
      console.log('[LessonFlow] Creating session for phase:', phase);
      isCreatingSessionRef.current = true;
      createSession();
    }
  }, [phase, sessionId, user?.id, activeProfile?.id]);

  // Navigate to exercise when phase is exercise AND sessionId is ready
  useEffect(() => {
    if (phase === "exercise" && currentBlock && (sessionId || isOfflineMode)) {
      // One-time first-launch tracking
      if (!hasTrackedFirstLaunchRef.current) {
        hasTrackedFirstLaunchRef.current = true;
        trackFirstExerciseLaunch(sessionId, lesson.blocks.length);
      }
      console.log('[LessonFlow] Navigating to exercise:', currentBlock.exerciseId);
      navigateToExercise(currentBlock.exerciseId);
    }
  }, [phase, currentBlock, sessionId, isOfflineMode]);

  const createSession = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        profile_id: activeProfile?.id,
        started_at: new Date().toISOString(),
        plan: lesson as any,
        // Stamp mode so analytics/auditors can filter Full Coaching vs standalone games.
        // 'lesson' covers both Guided and Full Coaching modes (LessonFlow owns both).
        summary: { mode: 'lesson' } as any,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create session:", error);
      toast.error("Failed to start session");
      isCreatingSessionRef.current = false;
      return;
    }

    console.log('[LessonFlow] Session created:', data.id);
    sessionStartTimeRef.current = Date.now();
    associateSessionWithFlow(data.id);
    setSessionId(data.id);
  };

  const handleDailyCheckComplete = (results: any) => {
    if (results.needsFullAssessment) {
      setPhase("full-assessment");
    } else {
      setPhase("session-preview");
    }
  };

  const handleFullAssessmentComplete = () => {
    setPhase("session-preview");
  };
  
  const handlePreviewStart = () => {
    resetFeedbackHistory();
    clearExerciseDetails(); // Clear any stale exercise details from previous session
    // Full Coaching: always show Maya intro; Guided: show if session frame exists
    if (sessionFrame && (isVoiceLed || showPurpose)) {
      setPhase("maya-intro");
    } else {
      setPhase("exercise");
    }
  };

  const navigateToExercise = (exerciseId: string) => {
    console.log('[LessonFlow] Navigating to exercise:', { exerciseId, sessionId, currentBlockIndex });
    
    // Save state to sessionStorage (for exercise return) AND localStorage (for resume from /today)
    const stateToSave = {
      phase: 'exercise',
      currentBlockIndex,
      sessionId,
      sessionStartTime: sessionStartTimeRef.current,
      recentScores: recentScoresRef.current,
      recentRTs: recentRTRef.current,
      recentTimeouts: recentTimeoutsRef.current,
      blockScores: blockScoresRef.current,
      blockCount: lesson.blocks.length,
      firstExerciseId: lesson.blocks[0]?.exerciseId,
      lesson,
      clinicalProfile,
      savedAt: Date.now(),
    };
    const stateJson = JSON.stringify(stateToSave);
    sessionStorage.setItem('lessonFlowState', stateJson);
    localStorage.setItem('lessonFlowState_resume', stateJson);
    
    const routeMap: Record<string, string> = {
      "photo-naming": "/exercise/photo-naming",
      "phonological": "/exercise/phonological-awareness",
      "phonological-awareness": "/exercise/phonological-awareness",
      "semantic-features": "/exercise/semantic-features",
      "sentence-construction": "/exercise/sentence-construction",
      "phrase-practice": "/exercise/word-practice",
      "reach-tap": "/exercise/reach-tap",
      "pattern-match": "/exercise/pattern-match",
      "minimal-pairs": "/exercise/minimal-pairs",
      "conversation-partner": "/exercise/conversation-partner",
      "conversation-coach": "/exercise/conversation-coach",
      "two-clues": "/exercise/two-clues",
      "fix-sentence": "/exercise/fix-sentence",
      "describe-guess": "/exercise/describe-guess",
      "detective-mind": "/exercise/detective-mind",
      "meaning-match": "/exercise/meaning-match",
      "narrative-retell": "/exercise/narrative-retell",
      "abstract-compare": "/exercise/abstract-compare",
      "multi-step-plan": "/exercise/multi-step-plan",
      "dual-load-naming": "/exercise/dual-load-naming",
      "left-side-hunt": "/exercise/left-side-hunt",
      "thought-continuation": "/exercise/thought-continuation",
      "category-fluency": "/exercise/category-fluency",
      "synonym-generator": "/exercise/synonym-generator",
    };

    const route = routeMap[exerciseId];
    
    if (!route) {
      console.error('[LessonFlow] No route found for exercise:', exerciseId);
      toast.error(`Exercise "${exerciseId}" is not available`);
      return;
    }
    
    if (!sessionId && !isOfflineMode) {
      console.error('[LessonFlow] No sessionId available');
      toast.error("Session not ready. Please wait...");
      return;
    }
    
    // Build adaptations
    const appliedAdaptations: Record<string, any> = {
      ...currentBlock?.adaptations,
    };
    
    if (todayFocus?.adaptations) {
      if (isAdaptationEnabled('timeoutMultiplier') && todayFocus.adaptations.timeoutMultiplier) {
        appliedAdaptations.timeoutMultiplier = todayFocus.adaptations.timeoutMultiplier;
      }
      if (isAdaptationEnabled('startDifficulty') && todayFocus.adaptations.startDifficulty) {
        appliedAdaptations.startDifficulty = todayFocus.adaptations.startDifficulty;
      }
      if (isAdaptationEnabled('largeTargets') && todayFocus.adaptations.largeTargets) {
        appliedAdaptations.largeTargets = todayFocus.adaptations.largeTargets;
      }
      if (isAdaptationEnabled('sessionDurationCap') && todayFocus.adaptations.sessionDurationCap) {
        appliedAdaptations.sessionDurationCap = todayFocus.adaptations.sessionDurationCap;
      }
      if (isAdaptationEnabled('slowerTTS') && todayFocus.adaptations.slowerTTS) {
        appliedAdaptations.slowerTTS = todayFocus.adaptations.slowerTTS;
      }
    }
    
    const isPreset = lesson.reasoning?.[0]?.startsWith('Preset:');
    const focusPhonemes = todayFocus?.adaptations?.focusPhonemes;
    const preferredCueType = todayFocus?.adaptations?.preferredCueType;
    
    navigate(route, { 
      state: { 
        sessionId,
        adaptations: appliedAdaptations,
        focusWords: focusWords?.slice(0, 5),
        focusPhonemes: focusPhonemes?.length ? focusPhonemes : undefined,
        preferredCueType: preferredCueType || undefined,
        fromLesson: true,
        trialLimit: currentBlock?.trialLimit ?? undefined,
        blockIndex: currentBlockIndex,
        ...(isPreset ? { lessonSource: 'preset', presetId: 'comprehension_session' } : {}),
      } 
    });
  };

  const handleNextBlock = useCallback(() => {
    if (isLastBlock) {
      finishLessonSession(sessionId, runtimeBlocks.length, 'completed');
    } else {
      const nextIndex = currentBlockIndex + 1;
      
      // Micro-reflection toast (light/full mode only)
      if (showPurpose && recentScoresRef.current.length > 0) {
        const lastScore = recentScoresRef.current[recentScoresRef.current.length - 1];
        const exerciseName = humanizeSlug(runtimeBlocks[currentBlockIndex]?.exerciseId || '');
        const reflection = getMicroReflection(lastScore, exerciseName);
        if (reflection) {
          toast(reflection, { duration: 3000 });
        }
      }
      
      // === RUNTIME SUPPORT PIVOT ===
      const currentPriority = runtimeBlocks[currentBlockIndex]?.priority || 'primary';
      if (
        !activeSupportPivot &&
        lesson.supportBlocks?.length &&
        shouldPivotToSupport(recentScoresRef.current, currentPriority)
      ) {
        // Pick a support exercise that isn't already in the session to avoid
        // running the user through the same exercise twice in one round.
        const existingIds = new Set(runtimeBlocks.map(b => b.exerciseId));
        const supportBlock = lesson.supportBlocks.find(b => !existingIds.has(b.exerciseId));
        if (supportBlock) {
          console.log('[LessonFlow] 🔄 SUPPORT PIVOT: Injecting support exercise due to low performance');
          const newBlocks = [...runtimeBlocks];
          newBlocks.splice(nextIndex, 0, supportBlock);
          setRuntimeBlocks(newBlocks);
          setActiveSupportPivot(true);
          setLastPivotWasSupport(true);
        }
      }
      
      setCurrentBlockIndex(nextIndex);
      
      // Adaptive pause decision
      const pauseDecision = decidePause({
        completedCount: nextIndex,
        recentScores: recentScoresRef.current,
        recentReactionTimes: recentRTRef.current,
        elapsedMinutes: Math.floor((Date.now() - sessionStartTimeRef.current) / 60000),
        fatigueFlag: (todayFocus?.adaptations?.sessionDurationCap != null && todayFocus.adaptations.sessionDurationCap <= 10),
        recentTimeouts: recentTimeoutsRef.current,
      });
      
      console.log('[LessonFlow] Adaptive pause decision:', pauseDecision);
      setCurrentPause(pauseDecision);
      
      // Always show Maya transition between exercises in guided/voice-led mode
      // This ensures continuity — user is never "dropped" into an exercise cold
      if (sessionFrame && (showPurpose || isVoiceLed)) {
        // If no specific transition text exists, generate a generic one
        if (!sessionFrame.mayaTransitions[nextIndex]) {
          // Build a dynamic transition on the fly
          const prevExercise = runtimeBlocks[currentBlockIndex]?.exerciseId || '';
          const nextExercise = runtimeBlocks[nextIndex]?.exerciseId || '';
          sessionFrame.mayaTransitions[nextIndex] = `Good work on that. Now let's move to the next exercise.`;
        }
        setPhase('maya-transition');
      } else {
        setPhase(pauseDecision.type === 'micro-pause' ? 'micro-pause' : 'transition');
      }
    }
  }, [currentBlockIndex, isLastBlock, sessionId, runtimeBlocks, lesson.supportBlocks, todayFocus, activeSupportPivot, showPurpose, isVoiceLed, sessionFrame, finishLessonSession]);

  const handleTransitionContinue = useCallback(() => {
    setPhase("exercise");
  }, []);

  const handleEndSession = useCallback(() => {
    trackSessionDropOff(sessionId, currentBlockIndex, lesson.blocks.length, 'end_button');
    finishLessonSession(sessionId, lesson.blocks.length, 'manual');
  }, [sessionId, currentBlockIndex, lesson.blocks.length, finishLessonSession]);

  const handleFinish = () => {
    navigate("/today");
  };

  // Listen for exercise completion — with dedup guard
  useEffect(() => {
    let hasHandled = false;
    
    const handleExerciseComplete = () => {
      if (hasHandled) {
        console.warn('[LessonFlow] Ignoring duplicate exercise-complete event');
        return;
      }
      hasHandled = true;
      
      console.log('[LessonFlow] ✅ exercise-complete event received', {
        currentBlockIndex,
        isLastBlock,
      });
      handleNextBlock();
    };

    window.addEventListener("exercise-complete", handleExerciseComplete);
    return () => {
      window.removeEventListener("exercise-complete", handleExerciseComplete);
    };
  }, [currentBlockIndex, isLastBlock, handleNextBlock]);
  
  // Clear sessionStorage when lesson completes
  useEffect(() => {
    if (phase === 'summary') {
      console.log('[LessonFlow] Clearing saved state');
      sessionStorage.removeItem('lessonFlowState'); localStorage.removeItem('lessonFlowState_resume');
    }
  }, [phase]);

  // --- RENDER ---

  if (phase === "daily-check") {
    return <DailyCapabilityCheck onComplete={handleDailyCheckComplete} />;
  }

  if (phase === "full-assessment") {
    return (
      <CapabilityAssessment
        userId={user?.id || ""}
        profileId={activeProfile?.id || ""}
        clinicalProfile={clinicalProfile}
        onComplete={handleFullAssessmentComplete}
        onExit={() => navigate("/today")}
      />
    );
  }

  // Pre-session preview
  if (phase === "session-preview") {
    return (
      <SessionPreviewCard
        lesson={lesson}
        displayName={activeProfile?.display_name || activeProfile?.profile_name}
        onStart={handlePreviewStart}
      />
    );
  }

  // Maya session intro (before first exercise)
  if (phase === "maya-intro" && sessionFrame) {
    // Use recommendation reason if provided, otherwise use template default
    const recommendationReason = location.state?.recommendationReason;
    const introText = recommendationReason || sessionFrame.mayaIntro;
    return (
      <MayaSessionFrame
        text={introText}
        type="intro"
        sessionTheme={sessionFrame.sessionTheme}
        onContinue={() => setPhase("exercise")}
      />
    );
  }

  // Maya session transition (between exercises)
  if (phase === "maya-transition" && sessionFrame) {
    const baseTransition = sessionFrame.mayaTransitions[currentBlockIndex] || '';
    const score = lastExerciseScoreRef.current;
    // Honest reflection when score is low or exercise was effectively skipped.
    // Replace the canned positive reflection with truthful, non-judgmental copy.
    let transitionText = baseTransition;
    if (score !== null && score < 30) {
      // Strip everything before the first "Now" / "Let's" purpose clause and prepend honest line.
      const purposeMatch = baseTransition.match(/(Now |Let'?s ).*/i);
      const purposePart = purposeMatch ? purposeMatch[0] : baseTransition;
      transitionText = `That one was tough — let's make the next one easier. ${purposePart}`;
    }
    const nextBlock = runtimeBlocks[currentBlockIndex];
    if (nextBlock) prefetchExerciseRoute(nextBlock.exerciseId);
    return (
      <MayaSessionFrame
        text={transitionText}
        type="transition"
        onContinue={handleTransitionContinue}
      />
    );
  }

  // Auto-advancing encouragement overlay
  if (phase === "transition") {
    const nextBlock = runtimeBlocks[currentBlockIndex];
    if (nextBlock) prefetchExerciseRoute(nextBlock.exerciseId);
    const wasSupportPivot = lastPivotWasSupport;
    // Clear pivot flag after displaying
    if (wasSupportPivot) setLastPivotWasSupport(false);
    return (
      <ExerciseTransitionOverlay
        type="encouragement"
        durationOverride={wasSupportPivot ? 5 : currentPause?.duration}
        completedCount={currentBlockIndex}
        totalCount={runtimeBlocks.length}
        nextExerciseName={humanizeSlug(nextBlock?.exerciseId || "exercise")}
        nextExerciseId={nextBlock?.exerciseId}
        nextPhase={nextBlock?.priority}
        isSupportPivot={wasSupportPivot}
        sessionId={sessionId}
        lastScore={lastExerciseScoreRef.current}
        onContinue={handleTransitionContinue}
        onEnd={handleEndSession}
      />
    );
  }

  // Breathing micro-pause
  if (phase === "micro-pause") {
    const nextBlock = runtimeBlocks[currentBlockIndex];
    // Prefetch next exercise chunk while pause overlay is visible
    if (nextBlock) prefetchExerciseRoute(nextBlock.exerciseId);
    return (
      <ExerciseTransitionOverlay
        type="micro-pause"
        durationOverride={currentPause?.duration}
        completedCount={currentBlockIndex}
        totalCount={runtimeBlocks.length}
        nextExerciseName={humanizeSlug(nextBlock?.exerciseId || "exercise")}
        nextExerciseId={nextBlock?.exerciseId}
        nextPhase={nextBlock?.priority}
        sessionId={sessionId}
        lastScore={lastExerciseScoreRef.current}
        onContinue={handleTransitionContinue}
        onEnd={handleEndSession}
      />
    );
  }

  if (phase === "summary") {
    return (
      <SessionSummaryScreen
        lesson={lesson}
        sessionId={sessionId}
        sessionFrame={sessionFrame}
        onFinish={handleFinish}
      />
    );
  }

  // Loading state when navigating to exercise
  if (phase === "exercise") {
    const phaseLabel = currentBlock?.priority === 'warmup' ? 'warm-up' 
      : currentBlock?.priority === 'primary' ? 'core' 
      : currentBlock?.priority === 'support' ? 'support'
      : 'stretch';
    const adaptMsg = getAdaptivityMessage(recentScoresRef.current, phaseLabel);
    return (
      <div className={variantClass(variant, {
        base: "min-h-screen bg-background flex items-center justify-center p-4",
        simplified: "p-6",
      })}>
        <Card className={variantClass(variant, {
          base: "w-full max-w-md p-8 space-y-6 text-center",
          simplified: "max-w-lg p-10 space-y-8",
          minimal: "max-w-lg p-10 space-y-6 shadow-none border-2",
        })}>
          {/* Session arc progress — hidden in minimal to reduce visual load */}
          {!isMinimal(variant) && (
            <SessionArcBar 
              blocks={runtimeBlocks} 
              currentIndex={currentBlockIndex} 
            />
          )}
          
          <div className={variantClass(variant, {
            base: "w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto animate-pulse",
            simplified: "w-20 h-20",
            minimal: "w-20 h-20 animate-none",
          })}>
            <Play className={variantClass(variant, {
              base: "w-8 h-8 text-primary",
              simplified: "w-10 h-10",
            })} />
          </div>
          <div className="space-y-2">
            <h2 className={variantClass(variant, {
              base: "text-2xl font-bold",
              simplified: "text-3xl",
            })}>
              {!sessionId ? "Preparing session..." : "Loading Exercise..."}
            </h2>
            <p className={variantClass(variant, {
              base: "text-muted-foreground",
              simplified: "text-lg",
            })}>
              {humanizeSlug(currentBlock?.exerciseId || '')}
            </p>
            {/* Micro-guidance — Guided/Full only, suppressed in minimal */}
            {showPurpose && !isMinimal(variant) && (() => {
              const guidance = getExerciseMicroGuidance(currentBlock?.exerciseId || '');
              return guidance ? (
                <p className="text-sm text-muted-foreground/80 italic">{guidance}</p>
              ) : null;
            })()}
            {/* Visible adaptivity message — hidden in minimal */}
            {adaptMsg && !isMinimal(variant) && (
              <p className="text-sm text-primary/80 font-medium mt-2">
                {adaptMsg}
              </p>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return null;
};

/** Generate a brief micro-reflection based on score */
function getMicroReflection(score: number, exerciseName: string): string | null {
  if (score >= 85) return `Strong round on ${exerciseName} — that speed carries over.`;
  if (score >= 65) return `Solid work on ${exerciseName}. Building momentum.`;
  if (score >= 40) return `${exerciseName} was tough — that's the right challenge level.`;
  if (score < 40) return `Hard round — the effort still strengthens those pathways.`;
  return null;
}
