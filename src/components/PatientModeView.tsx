import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, LogOut, Loader2, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { DailyLesson } from "@/lib/dailyLessonEngine";
import { ClinicalProfile } from "@/lib/clinicalProfileMapper";
import { useDailyLesson } from "@/hooks/useDailyLesson";
import { useCapabilityAssessment } from "@/hooks/useCapabilityAssessment";
import { useUiMode } from "@/hooks/useUiMode";
import { UiModeToggle } from "@/components/UiModeToggle";

interface PatientModeViewProps {
  userId: string;
  profileId: string;
  clinicalProfile: ClinicalProfile | null;
  onStartAssessment?: () => void;
}

export function PatientModeView({ userId, profileId, clinicalProfile, onStartAssessment }: PatientModeViewProps) {
  const navigate = useNavigate();
  const { setUiMode } = useUiMode();
  const { lesson, loading: lessonLoading, error: lessonError } = useDailyLesson(userId, profileId, clinicalProfile);
  const { currentAssessment, loading: assessmentLoading } = useCapabilityAssessment(userId, profileId);

  const handleStartSession = () => {
    navigate('/lesson', { 
      state: { lesson, clinicalProfile }
    });
  };

  const handleRest = () => {
    // User chooses to rest - stay in patient mode on current screen
    // Could show a friendly toast message
  };

  const handleStartAssessment = () => {
    console.log('[PatientMode] Starting assessment - switching to caregiver mode');
    // Switch to caregiver mode and trigger assessment
    setUiMode('caregiver');
    
    // Small delay to let the mode switch render, then trigger assessment
    setTimeout(() => {
      console.log('[PatientMode] Triggering assessment modal');
      if (onStartAssessment) {
        onStartAssessment();
      }
    }, 100);
  };

  // Loading state
  if (lessonLoading || assessmentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 md:p-8 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute top-4 right-4 z-10">
          <UiModeToggle />
        </div>
        <Card className="max-w-3xl w-full p-8 md:p-16 space-y-8 text-center shadow-2xl border-2">
          <Loader2 className="w-16 h-16 md:w-20 md:h-20 animate-spin text-primary mx-auto" />
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            Getting ready...
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground">
            Loading your personalized session
          </p>
        </Card>
      </div>
    );
  }

  // No assessment state
  if (!currentAssessment) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 md:p-8 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute top-4 right-4 z-10">
          <UiModeToggle />
        </div>
        <Card className="max-w-3xl w-full p-8 md:p-16 space-y-8 text-center shadow-2xl border-2">
          <AlertCircle className="w-16 h-16 md:w-20 md:h-20 text-amber-500 mx-auto" />
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Let's get started!
            </h2>
            <p className="text-xl md:text-2xl text-muted-foreground font-medium">
              We need to do a quick check first to personalize your exercises.
            </p>
          </div>
          <Button
            onClick={handleStartAssessment}
            size="lg"
            className="w-full min-h-[140px] md:min-h-[160px] text-3xl md:text-4xl font-bold shadow-xl hover:shadow-2xl px-8 py-6 rounded-2xl"
          >
            <Play className="w-12 h-12 md:w-14 md:h-14 mr-4 shrink-0" />
            <span>Start Setup</span>
          </Button>
        </Card>
      </div>
    );
  }

  // Error state
  if (lessonError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 md:p-8 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute top-4 right-4 z-10">
          <UiModeToggle />
        </div>
        <Card className="max-w-3xl w-full p-8 md:p-16 space-y-8 text-center shadow-2xl border-2 border-destructive/20">
          <AlertCircle className="w-16 h-16 md:w-20 md:h-20 text-destructive mx-auto" />
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Something went wrong
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground">
              {lessonError}
            </p>
          </div>
          <Button
            onClick={handleStartAssessment}
            variant="outline"
            size="lg"
            className="min-h-[80px] text-xl md:text-2xl font-semibold px-8 py-4 rounded-xl"
          >
            Go to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  // Main Patient Mode view
  return (
    <div className="min-h-screen flex items-center justify-center p-6 md:p-8 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="absolute top-4 right-4 z-10">
        <UiModeToggle />
      </div>
      <Card className="max-w-3xl w-full p-8 md:p-16 space-y-12 text-center shadow-2xl border-2">
        {/* Friendly greeting */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
            Ready to practice?
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground font-medium">
            No wrong answers. You can stop anytime. 💛
          </p>
        </div>

        {/* Big primary button - Extra large touch target */}
        <div className="pt-8">
          <Button
            onClick={handleStartSession}
            size="lg"
            disabled={!lesson}
            aria-label="Start today's therapy session"
            aria-describedby="session-help-text"
            className="w-full min-h-[140px] md:min-h-[180px] text-3xl md:text-4xl font-bold shadow-xl hover:shadow-2xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed px-8 py-6 rounded-2xl"
          >
            <Play className="w-12 h-12 md:w-16 md:h-16 mr-4 shrink-0" />
            <span>Start Today's Session</span>
          </Button>
          <p id="session-help-text" className="sr-only">
            This button will start your personalized therapy exercises for today
          </p>
        </div>

        {/* Small secondary option - Still accessible */}
        <div className="pt-6">
          <Button
            onClick={handleRest}
            variant="ghost"
            size="lg"
            aria-label="Take a rest break"
            className="min-h-[64px] text-xl md:text-2xl text-muted-foreground hover:text-foreground px-8 py-4 rounded-xl hover:bg-accent/50 active:scale-[0.98] transition-all"
          >
            <LogOut className="w-6 h-6 md:w-7 md:h-7 mr-3" />
            I need to rest
          </Button>
        </div>

        {/* Lesson status indicator */}
        {!lesson && !lessonLoading && (
          <p className="text-base md:text-lg text-muted-foreground pt-4 animate-pulse">
            Preparing your session...
          </p>
        )}
      </Card>
    </div>
  );
}
