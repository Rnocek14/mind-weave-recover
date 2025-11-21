import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy, Camera, Hand, MessageSquare, Target, TrendingUp, Flame, Award, Loader2, 
  Settings, Brain, FileText, Activity, LineChart, Stethoscope, AlertCircle, Lightbulb, Volume2, List
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
import { useRecoverySummary } from "@/hooks/useRecoverySummary";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [streak, setStreak] = useState(0);
  const [totalReps, setTotalReps] = useState(0);
  const [achievementCount, setAchievementCount] = useState(0);
  const [todayProgress, setTodayProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clinicalProfile, setClinicalProfile] = useState<ClinicalProfile | null>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showCapabilityAssessment, setShowCapabilityAssessment] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('dashboard-active-tab') || 'overview';
  });
  
  const { flags: redFlags, isLoading: flagsLoading } = useRedFlagDetection(user?.id || null);
  const { doseCap } = useDoseCap(user?.id);
  const { learningRates, clusterComparisons, isLoading: learningRatesLoading } = useLearningRate(user?.id || null);
  const { currentAssessment, previousAssessment, fetchLatestAssessment } = useCapabilityAssessment(user?.id);
  const { checkExerciseAccess, getAdaptations, hasAssessment, hasSoftOverride } = useExerciseGating(user?.id);
  const { lesson } = useDailyLesson(user?.id || undefined, clinicalProfile);
  const { getLatestSummary } = useRecoverySummary(user?.id || '', 'progress');
  const recoverySummary = getLatestSummary('progress');

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

  const exercises = [
    {
      id: "semantic-features",
      title: "Semantic Feature Analysis",
      icon: Lightbulb,
      category: "Language",
      duration: "10-15 min",
      difficulty: "Medium",
      color: "bg-gradient-primary"
    },
    {
      id: "phonological-awareness",
      title: "Phonological Awareness",
      icon: Volume2,
      category: "Language",
      duration: "10-15 min",
      difficulty: "Medium",
      color: "bg-gradient-primary"
    },
    {
      id: "sentence-construction",
      title: "Sentence Construction",
      icon: List,
      category: "Language",
      duration: "10-15 min",
      difficulty: "Medium",
      color: "bg-gradient-primary"
    },
    {
      id: "photo-naming",
      title: "Name That Photo",
      icon: Camera,
      category: "Speech",
      duration: "5-7 min",
      difficulty: "Easy",
      color: "bg-gradient-healing"
    },
    {
      id: "reach-tap",
      title: "Reach & Tap",
      icon: Hand,
      category: "Motor",
      duration: "8-10 min",
      difficulty: "Medium",
      color: "bg-gradient-healing"
    },
    {
      id: "word-practice",
      title: "Phrase Practice",
      icon: MessageSquare,
      category: "Speech",
      duration: "5-7 min",
      difficulty: "Easy",
      color: "bg-gradient-healing"
    },
    {
      id: "left-side-hunt",
      title: "Left-Side Hunt",
      icon: Target,
      category: "Attention",
      duration: "8-10 min",
      difficulty: "Medium",
      color: "bg-gradient-healing"
    }
  ];

  const recommendations = clinicalProfile ? getExerciseRecommendations(clinicalProfile) : [];
  const recommendedExercises = recommendations.length > 0 
    ? exercises.filter(ex => recommendations.some(r => r.slug === ex.id))
    : exercises;

  const recentAchievements = [
    { label: "First Session Complete", icon: Trophy, date: "Today" },
    { label: "3-Day Streak", icon: Flame, date: "Today" },
    { label: "50 Reps Milestone", icon: Award, date: "Yesterday" }
  ];

  return (
    <div className="min-h-screen bg-gradient-calm">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              Welcome Back! 👋
            </h1>
            <p className="text-muted-foreground">
              Ready to continue your recovery journey?
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/clinical-documents")}
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              Documents
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate("/photo-library")}
              className="gap-2"
            >
              <Camera className="w-4 h-4" />
              Photo Library
            </Button>

            <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Brain className="w-4 h-4" />
                  {clinicalProfile ? 'Update Profile' : 'Set Clinical Profile'}
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
                className="gap-2"
              >
                <Settings className="w-4 h-4" />
                Admin Panel
              </Button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="p-6 shadow-card border-2 hover:border-primary transition-smooth">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-celebrate flex items-center justify-center">
                <Flame className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-3xl font-bold text-foreground">{streak}</div>
                <div className="text-sm text-muted-foreground">Day Streak 🔥</div>
              </div>
            </div>
          </Card>

          <Card className="p-6 shadow-card border-2 hover:border-primary transition-smooth">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-healing flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-3xl font-bold text-foreground">{totalReps}</div>
                <div className="text-sm text-muted-foreground">Total Reps</div>
              </div>
            </div>
          </Card>

          <Card className="p-6 shadow-card border-2 hover:border-primary transition-smooth">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-success flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-3xl font-bold text-foreground">{achievementCount}</div>
                <div className="text-sm text-muted-foreground">Achievements</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabbed Dashboard */}
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
            {user && (
              <OverviewTab
                userId={user.id}
                todayProgress={todayProgress}
                doseCap={doseCap}
                redFlags={redFlags}
                clinicalProfile={clinicalProfile}
                exercises={exercises}
                recommendations={recommendations}
                recommendedExercises={recommendedExercises}
                lesson={lesson}
                checkExerciseAccess={checkExerciseAccess}
                getAdaptations={getAdaptations}
                hasAssessment={hasAssessment}
                hasSoftOverride={hasSoftOverride}
                onStartAssessment={() => setShowCapabilityAssessment(true)}
              />
            )}
          </TabsContent>

          <TabsContent value="analytics">
            {user && (
              <AnalyticsTab
                userId={user.id}
                streak={streak}
                clinicalProfile={clinicalProfile}
                learningRates={learningRates}
                clusterComparisons={clusterComparisons}
                learningRatesLoading={learningRatesLoading}
                currentAssessment={currentAssessment}
                previousAssessment={previousAssessment}
                onStartAssessment={() => setShowCapabilityAssessment(true)}
                recentAchievements={recentAchievements}
              />
            )}
          </TabsContent>

          <TabsContent value="clinical">
            {user && (
              <ClinicalTab
                userId={user.id}
                clinicalProfile={clinicalProfile}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Capability Assessment Modal */}
      {showCapabilityAssessment && user && (
        <CapabilityAssessment
          userId={user.id}
          clinicalProfile={clinicalProfile}
          onComplete={(result: AssessmentResult) => {
            console.log('Assessment completed:', result);
            setShowCapabilityAssessment(false);
            fetchLatestAssessment();
          }}
          onExit={() => setShowCapabilityAssessment(false)}
        />
      )}

      {/* Quick Action FAB */}
      <QuickActionFAB
        activeTab={activeTab}
        onStartAssessment={() => setShowCapabilityAssessment(true)}
        recommendedExercises={recommendedExercises}
        hasRecoverySummary={!!recoverySummary}
      />
    </div>
  );
};

export default Dashboard;
