import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Play, Loader2, AlertCircle, Gamepad2,
  Flame, Home, BarChart3, Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { DailyLesson } from "@/lib/dailyLessonEngine";
import { ClinicalProfile } from "@/lib/clinicalProfileMapper";
import { useDailyLesson } from "@/hooks/useDailyLesson";
import { useAssessmentContext } from "@/contexts/AssessmentContext";
import { useUiMode } from "@/hooks/useUiMode";
import { UiModeToggle } from "@/components/UiModeToggle";
import { useSessionHistory } from "@/hooks/useSessionHistory";

import { PatientProgressView } from "@/components/patient/PatientProgressView";
import { PatientPracticeView } from "@/components/patient/PatientPracticeView";
import { toast } from "sonner";


interface PatientModeViewProps {
  userId: string;
  profileId: string;
  clinicalProfile: ClinicalProfile | null;
  onStartAssessment?: () => void;
}

type PatientViewState = "loading" | "needs-assessment" | "generating-lesson" | "ready";
type PatientTab = "home" | "practice" | "progress";

function getPatientViewState(
  assessmentLoading: boolean,
  lessonLoading: boolean,
  currentAssessment: any,
  lesson: DailyLesson | null
): PatientViewState {
  if (assessmentLoading) return "loading";
  if (!currentAssessment) return "needs-assessment";
  if (lessonLoading || !lesson) return "generating-lesson";
  return "ready";
}

export function PatientModeView({
  userId,
  profileId,
  clinicalProfile,
  onStartAssessment,
}: PatientModeViewProps) {
  const navigate = useNavigate();
  const { setUiMode } = useUiMode();
  const {
    lesson,
    loading: lessonLoading,
    error: lessonError,
  } = useDailyLesson(userId, profileId, clinicalProfile);
  const { currentAssessment, loading: assessmentLoading } = useAssessmentContext();
  const { sessions } = useSessionHistory(userId);
  const [activeTab, setActiveTab] = useState<PatientTab>("home");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to top on tab switch
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  const lastSession = sessions[0];
  const viewState = getPatientViewState(
    assessmentLoading,
    lessonLoading,
    currentAssessment,
    lesson
  );

  // Calculate streak from session history
  const streak = useMemo(() => {
    if (!sessions.length) return 0;
    let count = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split("T")[0];
      const hasSession = sessions.some(
        (s) => s.startedAt.split("T")[0] === dateStr
      );
      if (hasSession) count++;
      else if (i > 0) break; // Allow today to be missing
    }
    return count;
  }, [sessions]);

  const handleStartSession = () => {
    if (!lesson) return;
    // Track true tap time before any async work
    const { trackSessionStartTap } = require('@/lib/sessionFlowAnalytics');
    trackSessionStartTap(null, lesson.blocks?.length || 0);
    navigate("/lesson", {
      state: {
        lesson,
        clinicalProfile,
        skipDailyCheck: true,
        autoStart: true,
      },
    });
  };


  const handleStartAssessment = () => {
    setUiMode("caregiver");
    setTimeout(() => {
      if (onStartAssessment) onStartAssessment();
    }, 100);
  };

  // ── Bottom Tab Bar ──
  const TabBar = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-bottom">
      <div className="flex justify-around max-w-lg mx-auto">
        {([
          { id: "home" as PatientTab, icon: Home, label: "Home" },
          { id: "practice" as PatientTab, icon: Gamepad2, label: "Practice" },
          { id: "progress" as PatientTab, icon: BarChart3, label: "Progress" },
        ]).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex flex-col items-center py-3 min-h-[60px] transition-all duration-150 touch-manipulation select-none relative
              active:scale-95 active:bg-accent/30
              ${activeTab === id
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            {activeTab === id && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-primary rounded-b-full transition-all" />
            )}
            <Icon className={`${activeTab === id ? "w-7 h-7" : "w-6 h-6"} transition-all duration-150`} />
            <span className={`${activeTab === id ? "text-sm" : "text-xs"} font-medium mt-1 transition-all duration-150`}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  // ── Pre-ready states (loading, assessment, generating) ──
  // These bypass the tab system
  if (viewState === "loading") {
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

  if (viewState === "needs-assessment") {
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
              Do a quick check to personalize your exercises, or just try a game!
            </p>
          </div>
          <div className="space-y-4">
            <Button
              onClick={handleStartAssessment}
              size="lg"
              className="w-full min-h-[100px] sm:min-h-[120px] md:min-h-[140px] text-xl sm:text-2xl md:text-3xl font-bold shadow-xl hover:shadow-2xl px-4 sm:px-8 py-6 rounded-2xl flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4"
            >
              <Play className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 shrink-0" />
              <span>Start Setup</span>
            </Button>
            <Button
              onClick={() => setActiveTab("practice")}
              variant="outline"
              size="lg"
              className="w-full min-h-[64px] sm:min-h-[72px] text-lg sm:text-xl md:text-2xl font-semibold px-4 sm:px-6 py-4 rounded-xl border-2"
            >
              <Gamepad2 className="w-6 h-6 sm:w-7 sm:h-7 mr-3 shrink-0" />
              <span>Just try a game</span>
            </Button>
          </div>
        </Card>
        <TabBar />
      </div>
    );
  }

  if (viewState === "generating-lesson") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 md:p-8 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute top-4 right-4 z-10">
          <UiModeToggle />
        </div>
        <Card className="max-w-3xl w-full p-8 md:p-16 space-y-8 text-center shadow-2xl border-2">
          <Loader2 className="w-16 h-16 md:w-20 md:h-20 animate-spin text-primary mx-auto" />
          <div className="space-y-4">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
              Preparing your session...
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground">
              Creating a personalized lesson plan
            </p>
          </div>
          <Button
            onClick={() => setActiveTab("practice")}
            variant="outline"
            size="lg"
            className="min-h-[64px] text-lg sm:text-xl font-semibold px-6 py-4 rounded-xl border-2"
          >
            <Gamepad2 className="w-6 h-6 mr-3 shrink-0" />
            <span>Play a game while waiting</span>
          </Button>
        </Card>
        <TabBar />
      </div>
    );
  }

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
            onClick={() => setActiveTab("practice")}
            variant="outline"
            size="lg"
            className="min-h-[80px] text-xl md:text-2xl font-semibold px-8 py-4 rounded-xl"
          >
            <Gamepad2 className="w-6 h-6 mr-3" />
            Choose a game instead
          </Button>
        </Card>
        <TabBar />
      </div>
    );
  }

  // ── Main 3-tab patient view ──
  return (
    <div ref={scrollRef} className="min-h-screen pb-24 bg-gradient-to-br from-background via-background to-primary/5 overscroll-y-contain">
      <div className="sticky top-0 z-10 flex justify-end p-2 bg-transparent">
        <UiModeToggle />
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 md:pt-10">
        {/* ── Home Tab ── */}
        {activeTab === "home" && (
          <div className="space-y-6 animate-fade-in">
            {/* Greeting + orientation */}
            <div className="text-center space-y-2 py-6">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Start here</p>
              <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">
                Ready to practice?
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground font-medium">
                No wrong answers. You can stop anytime. 💛
              </p>
            </div>

            {/* Primary CTA */}
            <Button
              onClick={handleStartSession}
              size="lg"
              aria-label="Start today's therapy session"
              className="w-full min-h-[100px] sm:min-h-[120px] md:min-h-[140px] text-xl sm:text-2xl md:text-3xl font-bold shadow-xl hover:shadow-2xl transition-all duration-150 active:scale-[0.96] active:shadow-lg px-4 sm:px-8 py-6 rounded-2xl flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 select-none"
            >
              <Play className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 shrink-0" />
              <span className="text-center leading-tight">
                Start Today's Session
              </span>
            </Button>

            {/* Secondary: pick a game */}
            <Button
              onClick={() => setActiveTab("practice")}
              variant="outline"
              size="lg"
              className="w-full min-h-[64px] text-lg sm:text-xl font-semibold px-4 sm:px-6 py-4 rounded-xl border-2"
            >
              <Gamepad2 className="w-6 h-6 mr-3 shrink-0" />
              <span>Choose a game I like</span>
            </Button>

            {/* Tiny progress summary */}
            {(streak > 0 || sessions.length > 0) && (
              <button
                onClick={() => setActiveTab("progress")}
                className="w-full flex items-center justify-center gap-4 py-3 text-muted-foreground hover:text-foreground transition-colors min-h-[48px] touch-manipulation"
              >
                {streak > 0 && (
                  <span className="flex items-center gap-1.5 text-base">
                    <Flame className="w-5 h-5 text-amber-500" />
                    {streak} day streak
                  </span>
                )}
                {sessions.length > 0 && streak > 0 && (
                  <span className="text-border">·</span>
                )}
                {sessions.length > 0 && (
                  <span className="text-base">
                    {sessions.length} session{sessions.length !== 1 ? "s" : ""} total
                  </span>
                )}
              </button>
            )}

            {/* Caregiver assist */}
            <div className="text-center pt-2">
              <Button
                onClick={() => {
                  setUiMode("caregiver");
                  toast("Switched to Caregiver View — more detail and controls available", { duration: 3000 });
                }}
                variant="ghost"
                size="lg"
                className="min-h-[48px] text-sm text-muted-foreground hover:text-foreground px-6 py-3 rounded-xl hover:bg-accent/50 transition-all"
              >
                <Users className="w-4 h-4 mr-2" />
                Caregiver or helper? Tap here
              </Button>
            </div>
          </div>
        )}

        {/* ── Practice Tab ── */}
        {activeTab === "practice" && (
          <PatientPracticeView userId={userId} profileId={profileId} />
        )}

        {/* ── Progress Tab ── */}
        {activeTab === "progress" && (
          <PatientProgressView
            userId={userId}
            profileId={profileId}
            streak={streak}
          />
        )}
      </div>

      {/* Bottom tab bar */}
      <TabBar />
    </div>
  );
}
