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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isAdaptationEnabled } from "@/lib/adaptiveEngineConfig";
import { decidePause, type PauseDecision } from "@/lib/adaptivePauseLogic";
import {
  trackFirstExerciseLaunch,
  trackExerciseComplete,
  trackSessionDropOff,
  trackSessionComplete,
  associateSessionWithFlow,
} from "@/lib/sessionFlowAnalytics";
import { prefetchExerciseRoute } from "@/lib/exercisePrefetch";

type FlowPhase = 
  | "daily-check" 
  | "full-assessment" 
  | "session-preview"
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

  const skipDailyCheck = location.state?.skipDailyCheck ?? false;
  const autoStart = location.state?.autoStart ?? false;

  const getInitialPhase = (): FlowPhase => {
    if (autoStart) return "exercise";
    if (skipDailyCheck) return "exercise";
    return "daily-check";
  };

  const [phase, setPhase] = useState<FlowPhase>(getInitialPhase);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentPause, setCurrentPause] = useState<PauseDecision | null>(null);
  const [activeSupportPivot, setActiveSupportPivot] = useState(false); // Runtime support pivot flag
  const [runtimeBlocks, setRuntimeBlocks] = useState(lesson.blocks); // Mutable block list for support injection
  
  // Hardened state refs to prevent double-processing
  const hasProcessedResumeRef = useRef(false);
  const isCreatingSessionRef = useRef(false);
  const hasTrackedFirstLaunchRef = useRef(false);
  const sessionStartTimeRef = useRef(Date.now());
  
  // Performance tracking for adaptive pauses
  const recentScoresRef = useRef<number[]>([]);
  const recentRTRef = useRef<number[]>([]);
  const recentTimeoutsRef = useRef(0);

  const currentBlock = runtimeBlocks[currentBlockIndex];
  const isLastBlock = currentBlockIndex === runtimeBlocks.length - 1;
  
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
          
          const nextIndex = savedIndex + 1;
          const isLast = nextIndex >= lesson.blocks.length;
          
          console.log('[LessonFlow] Processing resume:', { savedIndex, nextIndex, isLast });
          
          // Restore performance signals if available
          if (parsed.recentScores) recentScoresRef.current = parsed.recentScores;
          if (parsed.recentRTs) recentRTRef.current = parsed.recentRTs;
          if (parsed.recentTimeouts != null) recentTimeoutsRef.current = parsed.recentTimeouts;
          
          // Extract score from the exercise-complete event detail if available
          const detail = (location.state as any)?.exerciseResult;
          if (detail?.score != null) {
            recentScoresRef.current = [...recentScoresRef.current.slice(-4), detail.score];
          }
          if (detail?.avgReactionTime != null) {
            recentRTRef.current = [...recentRTRef.current.slice(-4), detail.avgReactionTime];
          }
          if (detail?.timeouts != null) {
            recentTimeoutsRef.current = detail.timeouts;
          }
          
          setSessionId(savedSessionId);
          setCurrentBlockIndex(nextIndex);

          // Track exercise completion
          trackExerciseComplete(savedSessionId, savedIndex, lesson.blocks.length, 
            lesson.blocks[savedIndex]?.exerciseId || 'unknown');
          
          if (isLast) {
            trackSessionComplete(savedSessionId, lesson.blocks.length, Date.now() - sessionStartTimeRef.current);
            setPhase('summary');
          } else {
            // Use adaptive pause logic
            const pauseDecision = decidePause({
              completedCount: nextIndex,
              recentScores: recentScoresRef.current,
              recentReactionTimes: recentRTRef.current,
              elapsedMinutes: Math.floor((Date.now() - (parsed.sessionStartTime || Date.now())) / 60000),
              fatigueFlag: (todayFocus?.adaptations?.sessionDurationCap != null && todayFocus.adaptations.sessionDurationCap <= 10),
              recentTimeouts: recentTimeoutsRef.current,
            });
            
            console.log('[LessonFlow] Adaptive pause decision:', pauseDecision);
            setCurrentPause(pauseDecision);
            setPhase(pauseDecision.type === 'micro-pause' ? 'micro-pause' : 'transition');
          }
        } catch (error) {
          console.error('[LessonFlow] Error processing resume:', error);
        }
      }
    } else if (!location.state?.resuming) {
      const savedState = sessionStorage.getItem('lessonFlowState');
      if (savedState && !hasProcessedResumeRef.current) {
        try {
          const { phase: savedPhase, currentBlockIndex: savedIndex, sessionId: savedSessionId } = JSON.parse(savedState);
          
          // Guard: validate saved state
          if (typeof savedIndex !== 'number' || savedIndex < 0 || savedIndex >= lesson.blocks.length) {
            console.warn('[LessonFlow] Stale saved state, ignoring');
            sessionStorage.removeItem('lessonFlowState');
            return;
          }
          
          console.log('[LessonFlow] Restoring state (non-resuming):', { savedPhase, savedIndex, savedSessionId });
          setPhase(savedPhase);
          setCurrentBlockIndex(savedIndex);
          setSessionId(savedSessionId);
        } catch (error) {
          console.error('[LessonFlow] Error restoring state:', error);
          sessionStorage.removeItem('lessonFlowState');
        }
      }
    }
  }, [lesson.blocks.length, location.state?.resuming]);

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
    if (phase === "exercise" && currentBlock && sessionId) {
      // One-time first-launch tracking
      if (!hasTrackedFirstLaunchRef.current) {
        hasTrackedFirstLaunchRef.current = true;
        trackFirstExerciseLaunch(sessionId, lesson.blocks.length);
      }
      console.log('[LessonFlow] Navigating to exercise:', currentBlock.exerciseId);
      navigateToExercise(currentBlock.exerciseId);
    }
  }, [phase, currentBlock, sessionId]);

  const createSession = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        profile_id: activeProfile?.id,
        started_at: new Date().toISOString(),
        plan: lesson as any,
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
      setPhase("exercise");
    }
  };

  const handleFullAssessmentComplete = () => {
    setPhase("exercise");
  };

  const navigateToExercise = (exerciseId: string) => {
    console.log('[LessonFlow] Navigating to exercise:', { exerciseId, sessionId, currentBlockIndex });
    
    // Save minimal state to sessionStorage (not full lesson/profile)
    sessionStorage.setItem('lessonFlowState', JSON.stringify({
      phase: 'exercise',
      currentBlockIndex,
      sessionId,
      sessionStartTime: sessionStartTimeRef.current,
      // Persist performance signals for adaptive pauses
      recentScores: recentScoresRef.current,
      recentRTs: recentRTRef.current,
      recentTimeouts: recentTimeoutsRef.current,
      // Keep lesson/clinicalProfile for components that still read them
      lesson,
      clinicalProfile,
    }));
    
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
    
    if (!sessionId) {
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
      trackSessionComplete(sessionId, runtimeBlocks.length, Date.now() - sessionStartTimeRef.current);
      setPhase("summary");
    } else {
      const nextIndex = currentBlockIndex + 1;
      
      // === RUNTIME SUPPORT PIVOT ===
      // If user is struggling and we have support blocks, inject one
      const currentPriority = runtimeBlocks[currentBlockIndex]?.priority || 'primary';
      if (
        !activeSupportPivot &&
        lesson.supportBlocks?.length &&
        shouldPivotToSupport(recentScoresRef.current, currentPriority)
      ) {
        console.log('[LessonFlow] 🔄 SUPPORT PIVOT: Injecting support exercise due to low performance');
        const supportBlock = lesson.supportBlocks[0];
        const newBlocks = [...runtimeBlocks];
        newBlocks.splice(nextIndex, 0, supportBlock);
        setRuntimeBlocks(newBlocks);
        setActiveSupportPivot(true); // Only pivot once per session
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
      setPhase(pauseDecision.type === 'micro-pause' ? 'micro-pause' : 'transition');
    }
  }, [currentBlockIndex, isLastBlock, sessionId, runtimeBlocks, lesson.supportBlocks, todayFocus, activeSupportPivot]);

  const handleTransitionContinue = useCallback(() => {
    setPhase("exercise");
  }, []);

  const handleEndSession = useCallback(() => {
    trackSessionDropOff(sessionId, currentBlockIndex, lesson.blocks.length, 'end_button');
    setPhase("summary");
  }, [sessionId, currentBlockIndex, lesson.blocks.length]);

  const handleFinish = () => {
    navigate("/dashboard");
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
      sessionStorage.removeItem('lessonFlowState');
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
        onExit={() => navigate("/dashboard")}
      />
    );
  }

  // Auto-advancing encouragement overlay
  if (phase === "transition") {
    const nextBlock = runtimeBlocks[currentBlockIndex];
    // Prefetch next exercise chunk while overlay is visible
    if (nextBlock) prefetchExerciseRoute(nextBlock.exerciseId);
    return (
      <ExerciseTransitionOverlay
        type="encouragement"
        durationOverride={currentPause?.duration}
        completedCount={currentBlockIndex}
        totalCount={runtimeBlocks.length}
        nextExerciseName={humanizeSlug(nextBlock?.exerciseId || "exercise")}
        sessionId={sessionId}
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
        sessionId={sessionId}
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
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 space-y-6 text-center">
          {/* Session arc progress */}
          <SessionArcBar 
            blocks={runtimeBlocks} 
            currentIndex={currentBlockIndex} 
          />
          
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto animate-pulse">
            <Play className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">
              {!sessionId ? "Preparing session..." : "Loading Exercise..."}
            </h2>
            <p className="text-muted-foreground">
              {humanizeSlug(currentBlock?.exerciseId || '')}
            </p>
            {/* Visible adaptivity message */}
            {adaptMsg && (
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
