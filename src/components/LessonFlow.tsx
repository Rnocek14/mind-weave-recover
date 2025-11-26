import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DailyCapabilityCheck } from "./DailyCapabilityCheck";
import { CapabilityAssessment } from "./CapabilityAssessment";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Play, CheckCircle2, Clock } from "lucide-react";
import type { DailyLesson } from "@/lib/dailyLessonEngine";
import type { ClinicalProfile } from "@/lib/clinicalProfileMapper";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
}

export const LessonFlow = ({ lesson, clinicalProfile }: LessonFlowProps) => {
  const [phase, setPhase] = useState<FlowPhase>("daily-check");
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [checkResults, setCheckResults] = useState<any>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const currentBlock = lesson.blocks[currentBlockIndex];
  const isLastBlock = currentBlockIndex === lesson.blocks.length - 1;

  useEffect(() => {
    // Create session when lesson overview starts
    if (phase === "lesson-overview" && !sessionId && user) {
      createSession();
    }
  }, [phase, user]);

  const createSession = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
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
    // Map exercise IDs to their routes
    const routeMap: Record<string, string> = {
      "photo-naming": "/exercise/photo-naming",
      "phonological": "/exercise/phonological",
      "semantic-features": "/exercise/semantic-features",
      "sentence-construction": "/exercise/sentence-construction",
      "phrase-practice": "/exercise/phrase-practice",
    };

    const route = routeMap[exerciseId];
    if (route && sessionId) {
      navigate(route, { 
        state: { 
          sessionId,
          adaptations: currentBlock?.adaptations,
          fromLesson: true,
        } 
      });
    }
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
      handleNextBlock();
    };

    window.addEventListener("exercise-complete", handleExerciseComplete);
    return () => window.removeEventListener("exercise-complete", handleExerciseComplete);
  }, [currentBlockIndex, isLastBlock]);

  if (phase === "daily-check") {
    return <DailyCapabilityCheck onComplete={handleDailyCheckComplete} />;
  }

  if (phase === "full-assessment") {
    return (
      <CapabilityAssessment
        userId={user?.id || ""}
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
                    {block.duration} min • {block.priority}
                  </p>
                </div>
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
            ))}
          </div>

          <div className="pt-4">
            <Button size="lg" className="w-full" onClick={handleStartExercises}>
              <Play className="w-5 h-5 mr-2" />
              Start Exercises
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
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-xl p-8 space-y-6 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-bold">Lesson Complete!</h2>
            <p className="text-muted-foreground text-lg">
              You completed all {lesson.blocks.length} exercises
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-6 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Duration:</span>
              <span className="font-semibold">{lesson.totalDuration} minutes</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Exercises:</span>
              <span className="font-semibold">{lesson.blocks.length}</span>
            </div>
          </div>

          <Button size="lg" className="w-full" onClick={handleFinish}>
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return null;
};
