import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy, TrendingUp, Flame, Loader2,
  Brain, Activity, Stethoscope, AlertCircle,
  LayoutDashboard, Target, BarChart3, ClipboardList,
  Calendar,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { calculateStreak, getTotalReps, getTodayProgress } from "@/hooks/useStreakCalculation";
import { supabase } from "@/integrations/supabase/client";
import { getExerciseRecommendations, ClinicalProfile } from "@/lib/clinicalProfileMapper";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import ClinicalProfileForm from "@/components/ClinicalProfileForm";
import { useRedFlagDetection } from "@/hooks/useRedFlagDetection";
import { useDoseCap } from "@/hooks/useDoseCap";
import { useLearningRate } from "@/hooks/useLearningRate";
import { CapabilityAssessment } from "@/components/CapabilityAssessment";
import { useCapabilityAssessment } from "@/hooks/useCapabilityAssessment";
import type { AssessmentResult } from "@/lib/capabilityAssessor";
import { useExerciseGating } from "@/hooks/useExerciseGating";
import { useDailyLesson } from "@/hooks/useDailyLesson";
import { OverviewTab } from "@/components/dashboard/OverviewTab";
import { DomainsTab } from "@/components/dashboard/DomainsTab";
import { ProgressTab } from "@/components/dashboard/ProgressTab";
import { PlanTab } from "@/components/dashboard/PlanTab";
import { QuickActionFAB } from "@/components/QuickActionFAB";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { useRecoverySummary } from "@/hooks/useRecoverySummary";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { EXERCISES } from "@/data/exercises";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { DashboardQuickTour } from "@/components/DashboardQuickTour";
import { useUiMode } from "@/hooks/useUiMode";
import { PatientModeView } from "@/components/PatientModeView";

import { ProfileSwitcher } from "@/components/ProfileSwitcher";
import { useProfile } from "@/hooks/useProfile";
import { AdaptiveLoopDebugPanel } from "@/components/AdaptiveLoopDebugPanel";

/** Compute days since stroke for the header */
function daysSinceStroke(strokeDate: string | null | undefined): number | null {
  if (!strokeDate) return null;
  const d = new Date(strokeDate);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { uiMode, setUiMode, isAtLeast } = useUiMode();
  const isClinician = isAtLeast('clinician');
  const [streak, setStreak] = useState(0);
  const [totalReps, setTotalReps] = useState(0);
  const [achievementCount, setAchievementCount] = useState(0);
  const [todayProgress, setTodayProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  const [clinicalProfile, setClinicalProfile] = useState<ClinicalProfile | null>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showCapabilityAssessment, setShowCapabilityAssessment] = useState(false);
  const [showQuickTour, setShowQuickTour] = useState(false);
  const [assessmentOrigin, setAssessmentOrigin] = useState<"patient" | "caregiver" | null>(null);
  const [pendingLessonNavigation, setPendingLessonNavigation] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("dashboard-active-tab") || "overview";
  });

  const { flags: redFlags, isLoading: flagsLoading } = useRedFlagDetection(user?.id || null);
  const { doseCap } = useDoseCap(user?.id);
  const { learningRates, clusterComparisons, isLoading: learningRatesLoading } = useLearningRate(user?.id || null);

  const { activeProfile } = useProfile();

  const { currentAssessment, previousAssessment, fetchLatestAssessment } = useCapabilityAssessment(user?.id, activeProfile?.id);
  const { checkExerciseAccess, getAdaptations, hasAssessment, hasSoftOverride } = useExerciseGating(user?.id, activeProfile?.id);
  const { lesson, todayFocus, regenerateLesson } = useDailyLesson(user?.id || undefined, activeProfile?.id, clinicalProfile);
  const { getLatestSummary } = useRecoverySummary(user?.id || "", "progress");
  const recoverySummary = getLatestSummary("progress");
  const isMobile = useIsMobile();

  const { isRefreshing, pullDistance, pullProgress } = usePullToRefresh({
    onRefresh: async () => {
      await loadDashboardData();
      toast.success("Dashboard refreshed!");
    },
    enabled: isMobile,
  });

  // Auto-redirect clinicians to Weekly Review
  useEffect(() => {
    if (!authLoading && user && (uiMode === 'clinician' || uiMode === 'admin')) {
      navigate("/clinician/review", { replace: true });
    }
  }, [uiMode, authLoading, user, navigate]);

  // Patient mode: /today is the canonical home — redirect away from /dashboard
  useEffect(() => {
    if (!authLoading && user && uiMode === 'patient') {
      navigate("/today", { replace: true });
    }
  }, [uiMode, authLoading, user, navigate]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (user) {
      loadDashboardData();
      fetchLatestAssessment();
    }
  }, [user, authLoading, navigate, activeProfile?.id]);

  useEffect(() => {
    if (pendingLessonNavigation && lesson && !showCapabilityAssessment) {
      setPendingLessonNavigation(false);
      navigate("/lesson", { state: { lesson, clinicalProfile } });
    }
  }, [pendingLessonNavigation, lesson, showCapabilityAssessment, navigate]);

  const loadDashboardData = async () => {
    if (!user) return;
    try {
      const [streakVal, repsVal, progressVal] = await Promise.all([
        calculateStreak(user.id),
        getTotalReps(user.id),
        getTodayProgress(user.id, 20),
      ]);
      const { data: achievements } = await supabase
        .from("achievements")
        .select("id")
        .eq("user_id", user.id);
      const { data: profileData } = await supabase
        .from("profiles")
        .select("clinical_profile")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (profileData?.clinical_profile) {
        setClinicalProfile(profileData.clinical_profile as unknown as ClinicalProfile);
      }
      setStreak(streakVal);
      setTotalReps(repsVal);
      setTodayProgress(progressVal);
      setAchievementCount(achievements?.length || 0);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const recommendations = useMemo(
    () => (clinicalProfile ? getExerciseRecommendations(clinicalProfile) : []),
    [clinicalProfile]
  );
  const recommendedExercises = useMemo(
    () =>
      recommendations.length > 0
        ? EXERCISES.filter((ex) => recommendations.some((r) => r.slug === ex.id))
        : EXERCISES,
    [recommendations]
  );
  const recentAchievements = useMemo(
    () => [
      { label: "First Session Complete", icon: Trophy, date: "Today" },
      { label: "3-Day Streak", icon: Flame, date: "Today" },
    ],
    []
  );

  const dashboardContextValue = useMemo(
    () => ({
      userId: user?.id || "",
      streak,
      totalReps,
      achievementCount,
      todayProgress,
      clinicalProfile,
      exercises: EXERCISES,
      recommendations,
      recommendedExercises,
      checkExerciseAccess,
      getAdaptations,
      hasAssessment,
      hasSoftOverride,
      lesson,
      todayFocus,
      redFlags,
      doseCap,
      learningRates,
      clusterComparisons,
      learningRatesLoading,
      currentAssessment,
      previousAssessment,
      onStartAssessment: () => setShowCapabilityAssessment(true),
      recentAchievements,
    }),
    [
      user?.id, streak, totalReps, achievementCount, todayProgress,
      clinicalProfile, recommendations, recommendedExercises,
      checkExerciseAccess, getAdaptations, hasAssessment, hasSoftOverride,
      lesson, todayFocus, redFlags, doseCap, learningRates,
      clusterComparisons, learningRatesLoading, currentAssessment,
      previousAssessment, recentAchievements,
    ]
  );

  const handleProfileSubmit = async (profile: ClinicalProfile) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ clinical_profile: profile as any })
        .eq("user_id", user!.id);
      if (error) throw error;
      setClinicalProfile(profile);
      setShowProfileDialog(false);
      loadDashboardData();
    } catch (error) {
      console.error("Error saving clinical profile:", error);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    localStorage.setItem("dashboard-active-tab", value);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-dvh bg-gradient-calm flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Patient Mode
  if (uiMode === "patient") {
    return (
      <PatientModeView
        userId={user!.id}
        profileId={activeProfile?.id || ""}
        clinicalProfile={clinicalProfile}
        onStartAssessment={() => {
          setAssessmentOrigin("patient");
          setShowCapabilityAssessment(true);
        }}
      />
    );
  }

  // Profile identity for header
  const profileName = activeProfile?.profile_name || "Patient";
  const strokeDays = daysSinceStroke(activeProfile?.stroke_date);
  const alertCount = redFlags.filter(
    (f) => f.severity === "red" || f.severity === "orange"
  ).length;

  // Clinical identity for banner
  const clinicalImpairments = (clinicalProfile as any)?.impairments?.speech || [];
  const diagnosisLabel = (() => {
    const norm = clinicalImpairments.map((s: string) => s.toLowerCase().replace(/[^a-z]/g, ''));
    if (norm.some((s: string) => s.includes('broca') || s === 'expressive')) return 'Expressive Aphasia';
    if (norm.some((s: string) => s.includes('wernicke') || s === 'receptive')) return 'Receptive Aphasia';
    if (norm.some((s: string) => s.includes('global'))) return 'Global Aphasia';
    if (norm.some((s: string) => s.includes('anomic'))) return 'Anomic Aphasia';
    if (clinicalImpairments.length > 0) return clinicalImpairments[0].replace(/_/g, ' ');
    return null;
  })();
  const handBias = activeProfile?.hand_bias;

  return (
    <div className="min-h-dvh bg-gradient-calm">
      <DashboardQuickTour open={showQuickTour} onOpenChange={setShowQuickTour} />

      {isMobile && (
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
          pullProgress={pullProgress}
        />
      )}

      <div className="container mx-auto px-4 py-6 md:py-8 max-w-6xl touch-manipulation">
        {/* ── Profile Hub Header ── */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-1">
                Recovery Profile
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <span className="font-medium text-foreground">{profileName}</span>
                {diagnosisLabel && (
                  <Badge variant="secondary" className="text-xs">
                    {diagnosisLabel}
                  </Badge>
                )}
                {strokeDays !== null && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Calendar className="w-3 h-3" />
                    Day {strokeDays}
                  </Badge>
                )}
                {handBias && (
                  <span className="text-xs capitalize">{handBias}-handed</span>
                )}
                {alertCount > 0 && (
                  <Badge variant="destructive" className="gap-1 text-xs">
                    <AlertCircle className="w-3 h-3" />
                    {alertCount} alert{alertCount !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <ProfileSwitcher />
              <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 flex-1 md:flex-none touch-manipulation min-h-[44px]"
                  >
                    <Brain className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {clinicalProfile ? "Update" : "Set"} Profile
                    </span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Clinical Profile</DialogTitle>
                    <DialogDescription>
                      Set up your clinical stroke profile for personalized therapy
                    </DialogDescription>
                  </DialogHeader>
                  <ClinicalProfileForm
                    initialProfile={clinicalProfile || undefined}
                    onSubmit={handleProfileSubmit}
                    onCancel={() => setShowProfileDialog(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-3 gap-3 md:gap-4 mt-4">
            <Card className="p-3 md:p-4 shadow-card border hover:border-primary transition-smooth">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-celebrate flex items-center justify-center shrink-0">
                  <Flame className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-bold text-foreground">{streak}</div>
                  <div className="text-xs text-muted-foreground">Streak</div>
                </div>
              </div>
            </Card>
            <Card className="p-3 md:p-4 shadow-card border hover:border-primary transition-smooth">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-healing flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-bold text-foreground">{totalReps}</div>
                  <div className="text-xs text-muted-foreground">Reps</div>
                </div>
              </div>
            </Card>
            <Card className="p-3 md:p-4 shadow-card border hover:border-primary transition-smooth">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-success flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-bold text-foreground">{achievementCount}</div>
                  <div className="text-xs text-muted-foreground">Wins</div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* ── Profile Hub Tabs ── */}
        <DashboardProvider value={dashboardContextValue}>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className={`grid w-full ${isClinician ? 'grid-cols-4' : 'grid-cols-3'} mb-6`}>
              <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Overview</span>
                {!flagsLoading && alertCount > 0 && (
                  <Badge variant="destructive" className="ml-0.5 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                    {alertCount}
                  </Badge>
                )}
              </TabsTrigger>
              {isClinician && (
                <TabsTrigger value="domains" className="gap-1.5 text-xs sm:text-sm">
                  <Brain className="w-4 h-4" />
                  <span className="hidden sm:inline">Domains</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="progress" className="gap-1.5 text-xs sm:text-sm">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Progress</span>
              </TabsTrigger>
              <TabsTrigger value="plan" className="gap-1.5 text-xs sm:text-sm">
                <ClipboardList className="w-4 h-4" />
                <span className="hidden sm:inline">Plan</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab />
            </TabsContent>
            {isClinician && (
              <TabsContent value="domains">
                <DomainsTab />
              </TabsContent>
            )}
            <TabsContent value="progress">
              <ProgressTab />
            </TabsContent>
            <TabsContent value="plan">
              <PlanTab />
            </TabsContent>
          </Tabs>
        </DashboardProvider>
      </div>

      {/* Capability Assessment Modal */}
      {showCapabilityAssessment && user && activeProfile && (
        <CapabilityAssessment
          userId={user.id}
          profileId={activeProfile.id}
          clinicalProfile={clinicalProfile}
          onComplete={async (result: AssessmentResult) => {
            const origin = assessmentOrigin;
            setShowCapabilityAssessment(false);
            const freshAssessment = await fetchLatestAssessment();
            if (origin === "patient") {
              const freshLesson = await regenerateLesson(freshAssessment);
              if (freshLesson) {
                navigate("/lesson", {
                  state: {
                    lesson: freshLesson,
                    clinicalProfile,
                    skipDailyCheck: true,
                    autoStart: true,
                  },
                });
              } else {
                setUiMode("patient");
              }
              setAssessmentOrigin(null);
            } else {
              toast.success("Assessment complete! Start an exercise when you're ready.");
              setAssessmentOrigin(null);
            }
          }}
          onExit={() => {
            setShowCapabilityAssessment(false);
            setAssessmentOrigin(null);
          }}
        />
      )}

      {/* Adaptive Loop Debug Panel (dev/admin only) */}
      {import.meta.env.DEV && user?.id && (
        <AdaptiveLoopDebugPanel
          userId={user.id}
          profileId={activeProfile?.id}
          className="mx-4 mb-4"
        />
      )}

      {/* Quick Action FAB */}
      <QuickActionFAB
        activeTab={activeTab}
        onStartAssessment={() => setShowCapabilityAssessment(true)}
        onShowTour={() => setShowQuickTour(true)}
        recommendedExercises={recommendedExercises}
        hasRecoverySummary={!!recoverySummary}
      />
    </div>
  );
};

export default Dashboard;
