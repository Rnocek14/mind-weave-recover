import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Play, Trophy, Camera, Hand, MessageSquare, 
  TrendingUp, Flame, Award, ChevronRight, Loader2, History, Settings, Brain
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { calculateStreak, getTotalReps, getTodayProgress } from "@/hooks/useStreakCalculation";
import { supabase } from "@/integrations/supabase/client";
import { ExerciseStatsTile } from "@/components/ExerciseStatsTile";
import { getExerciseRecommendations, ClinicalProfile } from "@/lib/clinicalProfileMapper";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ClinicalProfileForm from "@/components/ClinicalProfileForm";
import { MechanismSessionPlanner } from "@/components/MechanismSessionPlanner";

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

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      loadDashboardData();
      checkAdminStatus();
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

      // Load clinical profile
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
      
      // Reload dashboard to show updated recommendations
      loadDashboardData();
    } catch (error) {
      console.error('Error saving clinical profile:', error);
    }
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
      title: "Word Practice",
      icon: MessageSquare,
      category: "Speech",
      duration: "5-7 min",
      difficulty: "Easy",
      color: "bg-gradient-healing"
    }
  ];

  // Get personalized recommendations if profile exists
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

        {/* Today's Progress */}
        <Card className="p-6 mb-8 shadow-card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Today's Progress</h2>
            <span className="text-sm font-medium text-primary">{todayProgress}%</span>
          </div>
          <Progress value={todayProgress} className="h-3 mb-2" />
          <p className="text-sm text-muted-foreground">
            Goal: 20 minutes of therapy • {Math.round((todayProgress / 100) * 20)} min completed
          </p>
        </Card>

        {/* Mechanism-Based Session Planner */}
        {clinicalProfile && (clinicalProfile as any).stroke_mechanism && (
          <div className="mb-8">
            <MechanismSessionPlanner profile={clinicalProfile} />
          </div>
        )}

        {/* Exercises */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">
              {clinicalProfile ? 'Recommended Exercises' : "Today's Exercises"}
            </h2>
            {clinicalProfile && (
              <Badge variant="secondary" className="gap-1">
                <Brain className="w-3 h-3" />
                Personalized
              </Badge>
            )}
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {recommendedExercises.map((exercise) => {
              const Icon = exercise.icon;
              const recommendation = recommendations.find(r => r.slug === exercise.id);
              return (
                <Card 
                  key={exercise.id}
                  className="p-6 shadow-card hover:shadow-glow transition-smooth cursor-pointer border-2 hover:border-primary group"
                  onClick={() => navigate(`/exercise/${exercise.id}`)}
                >
                  <div className="space-y-4">
                    <div className={`w-14 h-14 rounded-full ${exercise.color} flex items-center justify-center group-hover:scale-110 transition-smooth`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium px-2 py-1 bg-primary-glow text-primary rounded-full">
                          {exercise.category}
                        </span>
                        {recommendation && (
                          <Badge variant="outline" className="text-xs">
                            {recommendation.priority} priority
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-lg mb-1">{exercise.title}</h3>
                      {recommendation ? (
                        <p className="text-sm text-muted-foreground">{recommendation.reason}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Difficulty: {exercise.difficulty}
                        </p>
                      )}
                    </div>
                    <Button 
                      className="w-full bg-gradient-healing hover:opacity-90"
                      size="lg"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      Start Exercise
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Exercise Performance Analytics */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Your Performance</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <ExerciseStatsTile
              userId={user?.id}
              exerciseSlug="photo-naming"
              exerciseTitle="Photo Naming"
            />
            <ExerciseStatsTile
              userId={user?.id}
              exerciseSlug="reach-tap"
              exerciseTitle="Reach & Tap"
            />
          </div>
        </div>

        {/* Recent Achievements */}
        <Card className="p-6 shadow-card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Recent Achievements</h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate("/history")}
            >
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="space-y-3">
            {recentAchievements.map((achievement, i) => {
              const Icon = achievement.icon;
              return (
                <div 
                  key={i} 
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted transition-smooth"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-celebrate flex items-center justify-center">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{achievement.label}</div>
                    <div className="text-sm text-muted-foreground">{achievement.date}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
