import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { DailyCapabilityCheck } from "./DailyCapabilityCheck";
import { CapabilityAssessment } from "./CapabilityAssessment";
import { SessionSummaryScreen } from "./SessionSummaryScreen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Play, CheckCircle2, Clock } from "lucide-react";
import type { DailyLesson } from "@/lib/dailyLessonEngine";
import { buildPresetLesson } from "@/lib/dailyLessonEngine";
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
  | "lesson-overview" 
  | "exercise" 
  | "transition" 
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

  // Check navigation state for flags
  const skipDailyCheck = location.state?.skipDailyCheck ?? false;
  const autoStart = location.state?.autoStart ?? false;

  // Determine initial phase based on flags
  const getInitialPhase = (): FlowPhase => {
    if (autoStart) return "exercise"; // Patient mode: skip everything
    if (skipDailyCheck) return "lesson-overview"; // Skip daily check only
    return "daily-check"; // Normal flow
  };

  const [phase, setPhase] = useState<FlowPhase>(getInitialPhase);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [checkResults, setCheckResults] = useState<any>(null);
  
  // Track if we've processed the resuming state to avoid race conditions
  const hasProcessedResumeRef = useRef(false);

  const currentBlock = lesson.blocks[currentBlockIndex];
  const isLastBlock = currentBlockIndex === lesson.blocks.length - 1;
  
  // Restore state if returning from exercise
  useEffect(() => {
    // Only process resuming once
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
          setPhase(isLast ? 'summary' : 'transition');
        } catch (error) {
          console.error('[LessonFlow] Error processing resume:', error);
        }
      }
    } else if (!location.state?.resuming) {
      // Normal restore (not resuming)
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

  // Create session when needed - now also handles autoStart scenario
  useEffect(() => {
    const needsSession = (phase === "lesson-overview" || phase === "exercise") && !sessionId && user;
    
    if (needsSession) {
      console.log('[LessonFlow] Creating session for phase:', phase, { userId: user?.id, profileId: activeProfile?.id });
      createSession();
    }
  }, [phase, sessionId, user?.id, activeProfile?.id]);

  // Navigate to exercise when phase is exercise AND sessionId is ready
  useEffect(() => {
    if (phase === "exercise" && currentBlock && sessionId) {
      console.log('[LessonFlow] Phase is exercise, sessionId ready, navigating:', currentBlock.exerciseId);
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
    setCheckResults(results);
    
    if (results.needsFullAssessment) {
      setPhase("full-assessment");
    } else {
      setPhase("lesson-overview");
    }
  };

  const handleFullAssessmentComplete = () => {
    setPhase("lesson-overview");
  };

  const handleStartExercises = () => {
    if (!currentBlock) return;
    setPhase("exercise");
    navigateToExercise(currentBlock.exerciseId);
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
    
    // Map exercise IDs to their routes
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
    
    // Build adaptations from todayFocus when Phase A is enabled
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
    
    // Detect if this is a preset lesson for telemetry
    const isPreset = lesson.reasoning?.[0]?.startsWith('Preset:');
    
    // Pass focusPhonemes and preferredCueType from adaptive engine
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

  const handleNextBlock = () => {
    if (isLastBlock) {
      setPhase("summary");
    } else {
      setCurrentBlockIndex(prev => prev + 1);
      setPhase("transition");
    }
  };

  const handleContinueFromTransition = () => {
    setPhase("exercise");
    navigateToExercise(currentBlock.exerciseId);
  };

  const handleFinish = () => {
    navigate("/dashboard");
  };

  // Listen for exercise completion
  useEffect(() => {
    const handleExerciseComplete = () => {
      console.log('[LessonFlow] ✅ exercise-complete event received', {
        currentBlockIndex,
        isLastBlock,
        nextPhase: isLastBlock ? 'summary' : 'transition'
      });
      handleNextBlock();
    };

    window.addEventListener("exercise-complete", handleExerciseComplete);
    return () => window.removeEventListener("exercise-complete", handleExerciseComplete);
  }, [currentBlockIndex, isLastBlock]);
  
  // Clear sessionStorage when lesson completes
  useEffect(() => {
    if (phase === 'summary') {
      console.log('[LessonFlow] Clearing saved state');
      sessionStorage.removeItem('lessonFlowState');
    }
  }, [phase]);

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

  if (phase === "lesson-overview") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Today's Lesson Plan</h1>
            <p className="text-muted-foreground">
              {lesson.blocks.length} exercises • {lesson.totalDuration} minutes
            </p>
          </div>

          {checkResults && !checkResults.needsFullAssessment && (
            <div className="bg-primary/10 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">✓ Daily check complete</p>
              <p className="text-sm text-muted-foreground">
                Exercises adapted to your current capabilities
              </p>
            </div>
          )}

          <div className="space-y-3">
            {lesson.blocks.map((block, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 p-4 rounded-lg border bg-card"
              >
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-primary">{idx + 1}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium capitalize">{block.exerciseId.replace(/-/g, ' ')}</p>
                  <p className="text-sm text-muted-foreground">
                    {block.trialLimit ? `${block.trialLimit} rounds` : `${block.duration} min`} • {block.priority}
                  </p>
                </div>
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
            ))}
          </div>

          <div className="pt-4">
            <Button 
              size="lg" 
              className="w-full" 
              onClick={handleStartExercises}
              disabled={!sessionId}
            >
              <Play className="w-5 h-5 mr-2" />
              {!sessionId ? "Creating session..." : "Start Exercises"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (phase === "transition") {
    const nextBlock = lesson.blocks[currentBlockIndex];
    const completedCount = currentBlockIndex;
    const progress = (completedCount / lesson.blocks.length) * 100;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-xl p-8 space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Great work!</h2>
            <p className="text-muted-foreground">
              {completedCount} of {lesson.blocks.length} exercises complete
            </p>
          </div>

          <Progress value={progress} className="h-2" />

          <div className="bg-muted/50 rounded-lg p-6 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Next Exercise:</p>
            <p className="text-xl font-semibold capitalize">{nextBlock?.exerciseId.replace(/-/g, ' ')}</p>
            <p className="text-sm text-muted-foreground">{nextBlock?.duration} minutes</p>
          </div>

          <Button size="lg" className="w-full" onClick={handleContinueFromTransition}>
            Continue
          </Button>
        </Card>
      </div>
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
