import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { DailyLesson } from "@/lib/dailyLessonEngine";
import { ClinicalProfile } from "@/lib/clinicalProfileMapper";

interface PatientModeViewProps {
  userId: string;
  lesson: DailyLesson | null;
  clinicalProfile: ClinicalProfile | null;
}

export function PatientModeView({ lesson, clinicalProfile }: PatientModeViewProps) {
  const navigate = useNavigate();

  const handleStartSession = () => {
    navigate('/lesson', { 
      state: { lesson, clinicalProfile }
    });
  };

  const handleRest = () => {
    // User chooses to rest - stay in patient mode on current screen
    // Could show a friendly toast message
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 md:p-8 bg-gradient-to-br from-background via-background to-primary/5">
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
        {!lesson && (
          <p className="text-base md:text-lg text-muted-foreground pt-4 animate-pulse">
            Loading your personalized session...
          </p>
        )}
      </Card>
    </div>
  );
}
