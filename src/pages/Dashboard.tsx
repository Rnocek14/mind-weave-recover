import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy, Camera, TrendingUp, Flame, Award, Loader2, 
  Settings, Brain, FileText, Activity, LineChart, Stethoscope, AlertCircle
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
import { AnalyticsTab } from "@/components/dashboard/AnalyticsTab";
import { ClinicalTab } from "@/components/dashboard/ClinicalTab";
import { QuickActionFAB } from "@/components/QuickActionFAB";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { useRecoverySummary } from "@/hooks/useRecoverySummary";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { EXERCISES } from "@/data/exercises";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { DashboardQuickTour } from "@/components/DashboardQuickTour";
import { useUiMode } from "@/hooks/useUiMode";
import { PatientModeView } from "@/components/PatientModeView";
import { UiModeToggle } from "@/components/UiModeToggle";
import { ProfileSwitcher } from "@/components/ProfileSwitcher";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { uiMode, setUiMode } = useUiMode();
  const [streak, setStreak] = useState(0);
  const [totalReps, setTotalReps] = useState(0);
  const [achievementCount, setAchievementCount] = useState(0);
  const [todayProgress, setTodayProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clinicalProfile, setClinicalProfile] = useState<ClinicalProfile | null>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showCapabilityAssessment, setShowCapabilityAssessment] = useState(false);
  const [showQuickTour, setShowQuickTour] = useState(false);
  const [assessmentOrigin, setAssessmentOrigin] = useState<'patient' | 'caregiver' | null>(null);
  const [pendingLessonNavigation, setPendingLessonNavigation] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('dashboard-active-tab') || 'overview';
  });
  
  const { flags: redFlags, isLoading: flagsLoading } = useRedFlagDetection(user?.id || null);
  const { doseCap } = useDoseCap(user?.id);
  const { learningRates, clusterComparisons, isLoading: learningRatesLoading } = useLearningRate(user?.id || null);
  
  // Get active profile from ProfileContext
  const [activeProfile, setActiveProfile] = useState<any>(null);
  
  useEffect(() => {
    const fetchActiveProfile = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();
      setActiveProfile(data);
    };
    fetchActiveProfile();
  }, [user?.id]);
  
  const { currentAssessment, previousAssessment, fetchLatestAssessment } = useCapabilityAssessment(user?.id, activeProfile?.id);
  const { checkExerciseAccess, getAdaptations, hasAssessment, hasSoftOverride } = useExerciseGating(user?.id, activeProfile?.id);
  const { lesson } = useDailyLesson(user?.id || undefined, activeProfile?.id, clinicalProfile);
  const { getLatestSummary } = useRecoverySummary(user?.id || '', 'progress');
  const recoverySummary = getLatestSummary('progress');
  const isMobile = useIsMobile();

  // Pull to refresh
  const { isRefreshing, pullDistance, pullProgress } = usePullToRefresh({
    onRefresh: async () => {
      await loadDashboardData();
      toast.success("Dashboard refreshed!");
    },
    enabled: isMobile,
  });

  // Swipe gestures for tab navigation
  const tabs = ['overview', 'analytics', 'clinical'];
  const currentTabIndex = tabs.indexOf(activeTab);

  useSwipeGesture({
    onSwipeLeft: () => {
      if (currentTabIndex < tabs.length - 1) {
        handleTabChange(tabs[currentTabIndex + 1]);
      }
    },
    onSwipeRight: () => {
      if (currentTabIndex > 0) {
        handleTabChange(tabs[currentTabIndex - 1]);
      }
    },
    enabled: isMobile,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      loadDashboardData();
      checkAdminStatus();
      fetchLatestAssessment();
    }
  }, [user, authLoading, navigate]);

  // Effect to handle pending lesson navigation after assessment completes
  useEffect(() => {
    if (pendingLessonNavigation && lesson && !showCapabilityAssessment) {
      console.log('[Dashboard] Lesson ready after assessment, navigating to /lesson');
      setPendingLessonNavigation(false);
      navigate("/lesson", { state: { lesson, clinicalProfile } });
    }
  }, [pendingLessonNavigation, lesson, showCapabilityAssessment, navigate]);

  const checkAdminStatus = async () => {
    if (!user) return;
    
    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      setIsAdmin(roles?.some(r => r.role === "admin") || false);
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  };

  const loadDashboardData = async () => {
    if (!user) return;
    
    try {
      const [streakVal, repsVal, progressVal] = await Promise.all([
        calculateStreak(user.id),
        getTotalReps(user.id),
        getTodayProgress(user.id, 20)
      ]);

      const { data: achievements } = await supabase
        .from('achievements')
        .select('id')
        .eq('user_id', user.id);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('clinical_profile')
        .eq('user_id', user.id)
        .single();

      if (profileData?.clinical_profile) {
        setClinicalProfile(profileData.clinical_profile as unknown as ClinicalProfile);
      }

      setStreak(streakVal);
      setTotalReps(repsVal);
      setTodayProgress(progressVal);
      setAchievementCount(achievements?.length || 0);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Memoize computed values for performance - MUST be before any conditional returns
  const recommendations = useMemo(
    () => clinicalProfile ? getExerciseRecommendations(clinicalProfile) : [],
    [clinicalProfile]
  );
  
  const recommendedExercises = useMemo(
    () => recommendations.length > 0 
      ? EXERCISES.filter(ex => recommendations.some(r => r.slug === ex.id))
      : EXERCISES,
    [recommendations]
  );

  const recentAchievements = useMemo(() => [
    { label: "First Session Complete", icon: Trophy, date: "Today" },
    { label: "3-Day Streak", icon: Flame, date: "Today" },
    { label: "50 Reps Milestone", icon: Award, date: "Yesterday" }
  ], []);

  // Create context value
  const dashboardContextValue = useMemo(() => ({
    userId: user?.id || '',
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
    redFlags,
    doseCap,
    learningRates,
    clusterComparisons,
    learningRatesLoading,
    currentAssessment,
    previousAssessment,
    onStartAssessment: () => setShowCapabilityAssessment(true),
    recentAchievements
  }), [
    user?.id,
    streak,
    totalReps,
    achievementCount,
    todayProgress,
    clinicalProfile,
    recommendations,
    recommendedExercises,
    checkExerciseAccess,
    getAdaptations,
    hasAssessment,
    hasSoftOverride,
    lesson,
    redFlags,
    doseCap,
    learningRates,
    clusterComparisons,
    learningRatesLoading,
    currentAssessment,
    previousAssessment,
    recentAchievements
  ]);

  const handleProfileSubmit = async (profile: ClinicalProfile) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ clinical_profile: profile as any })
        .eq('user_id', user!.id);

      if (error) throw error;

      setClinicalProfile(profile);
      setShowProfileDialog(false);
      loadDashboardData();
    } catch (error) {
      console.error('Error saving clinical profile:', error);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    localStorage.setItem('dashboard-active-tab', value);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Patient Mode: Simple one-button interface
  if (uiMode === 'patient') {
    return (
      <PatientModeView 
        userId={user!.id}
        profileId={activeProfile?.id || ""}
        clinicalProfile={clinicalProfile}
        onStartAssessment={() => {
          console.log('[Dashboard] Patient mode starting assessment');
          setAssessmentOrigin('patient');
          setShowCapabilityAssessment(true);
        }}
      />
    );
  }

  // Caregiver Mode: Full dashboard with all features
  return (
    <div className="min-h-screen bg-gradient-calm">
      <DashboardQuickTour open={showQuickTour} onOpenChange={setShowQuickTour} />
      
      {/* Pull to Refresh Indicator */}
      {isMobile && (
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
          pullProgress={pullProgress}
        />
      )}

      <div className="container mx-auto px-4 py-6 md:py-8 max-w-6xl touch-manipulation">
        {/* Header */}
        <div className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2">
              Welcome Back! 👋
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Ready to continue your recovery journey?
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <UiModeToggle />
            <ProfileSwitcher />
            
            <Button
              variant="outline"
              onClick={() => navigate("/clinical-documents")}
              className="gap-2 flex-1 md:flex-none touch-manipulation min-h-[44px]"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Documents</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate("/photo-library")}
              className="gap-2 flex-1 md:flex-none touch-manipulation min-h-[44px]"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Photo Library</span>
            </Button>

            <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 flex-1 md:flex-none touch-manipulation min-h-[44px]">
                  <Brain className="w-4 h-4" />
                  <span className="hidden sm:inline">{clinicalProfile ? 'Update' : 'Set'} Profile</span>
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

            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => navigate("/admin")}
                className="gap-2 touch-manipulation min-h-[44px]"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden lg:inline">Admin</span>
              </Button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
          <Card className="p-4 md:p-6 shadow-card border-2 hover:border-primary transition-smooth touch-manipulation">
            <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-celebrate flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div className="text-center md:text-left">
                <div className="text-2xl md:text-3xl font-bold text-foreground">{streak}</div>
                <div className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">Day Streak</div>
              </div>
            </div>
          </Card>

          <Card className="p-4 md:p-6 shadow-card border-2 hover:border-primary transition-smooth touch-manipulation">
            <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-healing flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div className="text-center md:text-left">
                <div className="text-2xl md:text-3xl font-bold text-foreground">{totalReps}</div>
                <div className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">Total Reps</div>
              </div>
            </div>
          </Card>

          <Card className="p-4 md:p-6 shadow-card border-2 hover:border-primary transition-smooth touch-manipulation">
            <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-success flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div className="text-center md:text-left">
                <div className="text-2xl md:text-3xl font-bold text-foreground">{achievementCount}</div>
                <div className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">Wins</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabbed Dashboard */}
        <DashboardProvider value={dashboardContextValue}>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="overview" className="gap-2">
                <Activity className="w-4 h-4" />
                Overview
                {!flagsLoading && redFlags.length > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {redFlags.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <LineChart className="w-4 h-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="clinical" className="gap-2">
                <Stethoscope className="w-4 h-4" />
                Clinical
                {!clinicalProfile && (
                  <Badge variant="secondary" className="ml-1">
                    <AlertCircle className="w-3 h-3" />
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab />
            </TabsContent>

            <TabsContent value="analytics">
              <AnalyticsTab />
            </TabsContent>

            <TabsContent value="clinical">
              <ClinicalTab />
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
            console.log('[Dashboard] Assessment completed:', result);
            const origin = assessmentOrigin;
            
            // Close modal first
            setShowCapabilityAssessment(false);
            
            // Await fresh assessment data to ensure capability scores are updated
            console.log('[Dashboard] Fetching latest assessment data...');
            await fetchLatestAssessment();
            console.log('[Dashboard] Assessment data refreshed');
            
            // If assessment started from patient mode, navigate back to patient mode and to lesson
            if (origin === 'patient') {
              console.log('[Dashboard] Assessment origin was patient mode, switching back and navigating to lesson');
              setUiMode('patient');
              setPendingLessonNavigation(true);
              setAssessmentOrigin(null);
            } else {
              // Caregiver mode: just show success toast
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
