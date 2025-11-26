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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <Card className="max-w-2xl w-full p-8 md:p-12 space-y-8 text-center shadow-2xl">
        {/* Friendly greeting */}
        <div className="space-y-3">
          <h1 className="text-3xl md:text-5xl font-bold text-foreground">
            Ready to practice?
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground">
            No wrong answers. You can stop anytime. 💛
          </p>
        </div>

        {/* Big primary button */}
        <div className="pt-6">
          <Button
            onClick={handleStartSession}
            size="lg"
            disabled={!lesson}
            className="w-full h-24 md:h-32 text-2xl md:text-3xl font-bold shadow-lg hover:shadow-xl transition-all"
          >
            <Play className="w-10 h-10 md:w-12 md:h-12 mr-4" />
            Start Today's Session
          </Button>
        </div>

        {/* Small secondary option */}
        <div className="pt-4">
          <Button
            onClick={handleRest}
            variant="ghost"
            size="lg"
            className="text-lg text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-5 h-5 mr-2" />
            I need to rest
          </Button>
        </div>

        {/* Lesson status indicator */}
        {!lesson && (
          <p className="text-sm text-muted-foreground pt-4">
            Loading your personalized session...
          </p>
        )}
      </Card>
    </div>
  );
}
