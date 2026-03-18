import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { DailyCapabilityCheck } from "./DailyCapabilityCheck";
import { CapabilityAssessment } from "./CapabilityAssessment";
import { SessionSummaryScreen } from "./SessionSummaryScreen";
import { ExerciseTransitionOverlay } from "./ExerciseTransitionOverlay";
import { Card } from "@/components/ui/card";
import { Play } from "lucide-react";
import type { DailyLesson } from "@/lib/dailyLessonEngine";
import type { ClinicalProfile } from "@/lib/clinicalProfileMapper";
import type { TodayFocus } from "@/lib/adaptiveDecisionEngine";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isAdaptationEnabled } from "@/lib/adaptiveEngineConfig";

type FlowPhase = 
  | "daily-check" 
  | "full-assessment" 
  | "exercise" 
  | "transition" 
  | "micro-pause"
  | "summary";

/** Show a micro-pause (breathing screen) every N exercises */
const MICRO_PAUSE_INTERVAL = 3;

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

  // Check navigation state for flags
  const skipDailyCheck = location.state?.skipDailyCheck ?? false;
  const autoStart = location.state?.autoStart ?? false;

  // Determine initial phase: skip overview entirely, go straight to exercise
  const getInitialPhase = (): FlowPhase => {
    if (autoStart) return "exercise";
    if (skipDailyCheck) return "exercise"; // No more overview — straight to exercise
    return "daily-check";
  };

  const [phase, setPhase] = useState<FlowPhase>(getInitialPhase);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const hasProcessedResumeRef = useRef(false);

  const currentBlock = lesson.blocks[currentBlockIndex];
  const isLastBlock = currentBlockIndex === lesson.blocks.length - 1;
  
  // Restore state if returning from exercise
  useEffect(() => {
    if (location.state?.resuming && !hasProcessedResumeRef.current) {
      hasProcessedResumeRef.current = true;
      
      const savedState = sessionStorage.getItem('lessonFlowState');
      if (savedState) {
        try {
          const { currentBlockIndex: savedIndex, sessionId: savedSessionId } = JSON.parse(savedState);
          const nextIndex = savedIndex + 1;
          const isLast = nextIndex >= lesson.blocks.length;
          
          console.log('[LessonFlow] Processing resume:', { savedIndex, nextIndex, isLast });
          
          setSessionId(savedSessionId);
          setCurrentBlockIndex(nextIndex);
          
          if (isLast) {
            setPhase('summary');
          } else {
            // Determine transition type: micro-pause every N exercises
            const shouldPause = nextIndex > 0 && nextIndex % MICRO_PAUSE_INTERVAL === 0;
            setPhase(shouldPause ? 'micro-pause' : 'transition');
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
          console.log('[LessonFlow] Restoring state (non-resuming):', { savedPhase, savedIndex, savedSessionId });
          setPhase(savedPhase);
          setCurrentBlockIndex(savedIndex);
          setSessionId(savedSessionId);
        } catch (error) {
          console.error('[LessonFlow] Error restoring state:', error);
        }
      }
    }
  }, [lesson.blocks.length, location.state?.resuming]);

  // Create session when needed
  useEffect(() => {
    const needsSession = phase === "exercise" && !sessionId && user;
    if (needsSession) {
      console.log('[LessonFlow] Creating session for phase:', phase);
      createSession();
    }
  }, [phase, sessionId, user?.id, activeProfile?.id]);

  // Navigate to exercise when phase is exercise AND sessionId is ready
  useEffect(() => {
    if (phase === "exercise" && currentBlock && sessionId) {
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
      return;
    }

    console.log('[LessonFlow] Session created:', data.id);
    setSessionId(data.id);
  };

  const handleDailyCheckComplete = (results: any) => {
    if (results.needsFullAssessment) {
      setPhase("full-assessment");
    } else {
      // Skip overview, go straight to exercise
      setPhase("exercise");
    }
  };

  const handleFullAssessmentComplete = () => {
    setPhase("exercise");
  };

  const navigateToExercise = (exerciseId: string) => {
    console.log('[LessonFlow] Navigating to exercise:', { exerciseId, sessionId, currentBlockIndex });
    
    // Save state to sessionStorage before navigating
    sessionStorage.setItem('lessonFlowState', JSON.stringify({
      phase: 'exercise',
      currentBlockIndex,
      sessionId,
      sessionStartTime: Date.now(),
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
      setPhase("summary");
    } else {
      const nextIndex = currentBlockIndex + 1;
      setCurrentBlockIndex(nextIndex);
      // Micro-pause every N exercises for cognitive reset
      const shouldPause = nextIndex > 0 && nextIndex % MICRO_PAUSE_INTERVAL === 0;
      setPhase(shouldPause ? 'micro-pause' : 'transition');
    }
  }, [currentBlockIndex, isLastBlock]);

  const handleTransitionContinue = useCallback(() => {
    setPhase("exercise");
  }, []);

  const handleEndSession = useCallback(() => {
    setPhase("summary");
  }, []);

  const handleFinish = () => {
    navigate("/dashboard");
  };

  // Listen for exercise completion
  useEffect(() => {
    const handleExerciseComplete = () => {
      console.log('[LessonFlow] ✅ exercise-complete event received', {
        currentBlockIndex,
        isLastBlock,
      });
      handleNextBlock();
    };

    window.addEventListener("exercise-complete", handleExerciseComplete);
    return () => window.removeEventListener("exercise-complete", handleExerciseComplete);
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

  // Auto-advancing encouragement overlay (3 sec)
  if (phase === "transition") {
    const nextBlock = lesson.blocks[currentBlockIndex];
    return (
      <ExerciseTransitionOverlay
        type="encouragement"
        completedCount={currentBlockIndex}
        totalCount={lesson.blocks.length}
        nextExerciseName={nextBlock?.exerciseId || "exercise"}
        onContinue={handleTransitionContinue}
        onEnd={handleEndSession}
      />
    );
  }

  // Breathing micro-pause (8 sec, every N exercises)
  if (phase === "micro-pause") {
    const nextBlock = lesson.blocks[currentBlockIndex];
    return (
      <ExerciseTransitionOverlay
        type="micro-pause"
        completedCount={currentBlockIndex}
        totalCount={lesson.blocks.length}
        nextExerciseName={nextBlock?.exerciseId || "exercise"}
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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto animate-pulse">
            <Play className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">
              {!sessionId ? "Preparing session..." : "Loading Exercise..."}
            </h2>
            <p className="text-muted-foreground capitalize">
              {currentBlock?.exerciseId.replace(/-/g, ' ')}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return null;
};
