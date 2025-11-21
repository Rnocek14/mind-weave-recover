import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Play, Trophy, Camera, Hand, MessageSquare, Target,
  TrendingUp, Flame, Award, ChevronRight, Loader2, History, Settings, Brain, Lightbulb, Volume2, List, FileText
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { calculateStreak, getTotalReps, getTodayProgress } from "@/hooks/useStreakCalculation";
import { supabase } from "@/integrations/supabase/client";
import { ExerciseStatsTile } from "@/components/ExerciseStatsTile";
import { ExerciseProgressCard } from "@/components/ExerciseProgressCard";
import { getExerciseRecommendations, ClinicalProfile } from "@/lib/clinicalProfileMapper";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import ClinicalProfileForm from "@/components/ClinicalProfileForm";
import { MechanismSessionPlanner } from "@/components/MechanismSessionPlanner";
import { StrokeProfileSummary } from "@/components/StrokeProfileSummary";
import { SessionAdherenceTracker } from "@/components/SessionAdherenceTracker";
import { BrainMap } from "@/components/BrainMap";
import { RedFlagAlerts } from "@/components/RedFlagAlerts";
import { useRedFlagDetection } from "@/hooks/useRedFlagDetection";
import { useDoseCap } from "@/hooks/useDoseCap";
import { LearningRateCard } from "@/components/LearningRateCard";
import { useLearningRate } from "@/hooks/useLearningRate";
import { FunctionalGoalsWidget } from "@/components/FunctionalGoalsWidget";
import { GoalLearningCorrelationCard } from "@/components/GoalLearningCorrelationCard";
import { AssessmentTrendsCard } from "@/components/AssessmentTrendsCard";
import { CapabilityProfileCard } from "@/components/CapabilityProfileCard";
import { CapabilityAssessment } from "@/components/CapabilityAssessment";
import { useCapabilityAssessment } from "@/hooks/useCapabilityAssessment";
import type { AssessmentResult } from "@/lib/capabilityAssessor";
import { useExerciseGating } from "@/hooks/useExerciseGating";
import { ExerciseGatingBadge } from "@/components/ExerciseGatingBadge";
import { getAdaptationSummary } from "@/lib/exerciseGating";
import { CapabilityGatingInfo } from "@/components/CapabilityGatingInfo";
import { ClinicianCapabilityCard } from "@/components/ClinicianCapabilityCard";
import { TodaysPlanCard } from "@/components/TodaysPlanCard";
import { useDailyLesson } from "@/hooks/useDailyLesson";
import { RecoverySummaryCard } from "@/components/RecoverySummaryCard";
import { StrokeEducationPanel } from "@/components/StrokeEducationPanel";

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
  
  const { flags: redFlags, isLoading: flagsLoading, refresh: refreshFlags } = useRedFlagDetection(user?.id || null);
  const { doseCap } = useDoseCap(user?.id);
  const { learningRates, clusterComparisons, isLoading: learningRatesLoading } = useLearningRate(user?.id || null);
  const { currentAssessment, previousAssessment, fetchLatestAssessment } = useCapabilityAssessment(user?.id);
  const { checkExerciseAccess, getAdaptations, hasAssessment, hasSoftOverride } = useExerciseGating(user?.id);
  const { lesson } = useDailyLesson(user?.id || undefined, clinicalProfile);

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

        {/* Red Flag Alerts */}
        {!flagsLoading && redFlags.length > 0 && (
          <div className="mb-8">
            <RedFlagAlerts flags={redFlags} />
          </div>
        )}

        {/* Dose Cap Warning if approaching limit */}
        {doseCap.warningLevel !== 'safe' && doseCap.warningLevel !== 'limit' && doseCap.enforceCaps && (
          <div className="mb-8">
            <Card className="p-6 border-primary/50 bg-primary/5">
              <h3 className="font-semibold mb-2">Practice Progress Today</h3>
              <p className="text-sm text-muted-foreground mb-3">
                You've practiced for {doseCap.todayMinutes} minutes today. 
                {doseCap.minutesRemaining > 0 
                  ? ` About ${doseCap.minutesRemaining} minutes remaining before your daily goal.`
                  : ' Great work reaching your goal!'
                }
              </p>
              <Progress value={(doseCap.todayMinutes / doseCap.dailyCapMinutes) * 100} className="h-2" />
            </Card>
          </div>
        )}

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

        {/* Capability Profile Assessment */}
        {user && (
          <div className="mb-8 grid gap-4 md:grid-cols-2">
            {/* Patient-facing capability card */}
            <CapabilityProfileCard
              userId={user.id}
              currentAssessment={currentAssessment}
              previousAssessment={previousAssessment}
              onStartAssessment={() => setShowCapabilityAssessment(true)}
            />
            
            {/* Clinician view: expected vs measured */}
            <ClinicianCapabilityCard
              userId={user.id}
              clinicalProfile={clinicalProfile}
            />
          </div>
        )}

        {/* Today's Personalized Plan */}
        {user && (
          <div className="mb-8">
            <TodaysPlanCard
              userId={user.id}
              clinicalProfile={clinicalProfile}
              onStartAssessment={() => setShowCapabilityAssessment(true)}
            />
          </div>
        )}

        {/* Session Adherence Tracker */}
        <div className="mb-8">
          <SessionAdherenceTracker userId={user?.id || null} currentStreak={streak} />
        </div>

        {/* Learning Rate Intelligence */}
        {!learningRatesLoading && learningRates.length > 0 && (
          <div className="mb-8">
            <LearningRateCard 
              learningRates={learningRates}
              clusterComparisons={clusterComparisons}
              timeWindow={14}
            />
            
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                onClick={() => navigate('/analytics/cluster')}
              >
                View Detailed Cluster Analytics
              </Button>
            </div>
          </div>
        )}

        {/* Functional Goals */}
        {user && (
          <div className="mb-8 grid md:grid-cols-2 gap-4">
            <FunctionalGoalsWidget userId={user.id} />
            <GoalLearningCorrelationCard userId={user.id} />
          </div>
        )}

        {/* Standardized Assessments */}
        {user && (
          <div className="mb-8">
            <AssessmentTrendsCard userId={user.id} />
          </div>
        )}

        {/* AI Recovery Summaries */}
        {user && (
          <div className="mb-8 space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-2xl font-semibold">Recovery Intelligence</h2>
              <Badge variant="secondary" className="gap-1">
                <Lightbulb className="w-3 h-3" />
                AI-Powered
              </Badge>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-6">
              <RecoverySummaryCard
                userId={user.id}
                summaryType="progress"
                title="Your Progress Journey"
                description="AI analysis of your recovery trajectory, what's working, and areas of focus"
                autoGenerate={true}
              />
              
              <RecoverySummaryCard
                userId={user.id}
                summaryType="education"
                title="Understanding Your Stroke"
                description="Plain-language explanation of your stroke and its effects"
                autoGenerate={true}
              />
            </div>

            {/* Additional education panel for detailed impairment breakdown */}
            {clinicalProfile && (
              <div className="mt-6">
                <StrokeEducationPanel
                  strokeLocation={
                    Array.isArray(clinicalProfile.stroke_location)
                      ? clinicalProfile.stroke_location.join(', ')
                      : clinicalProfile.stroke_location || undefined
                  }
                  affectedSide={clinicalProfile.affected_side || undefined}
                  impairments={clinicalProfile.impairments}
                />
              </div>
            )}
          </div>
        )}

        {/* Brain & Recovery Map */}
        {clinicalProfile && user && (
          <div className="mb-8">
            <BrainMap profile={{ clinical_profile: clinicalProfile }} userId={user.id} />
          </div>
        )}

        {/* Stroke Profile Summary */}
        {clinicalProfile && (
          <div className="mb-8">
            <StrokeProfileSummary profile={clinicalProfile} />
          </div>
        )}

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
          
          {/* Capability Gating Info Banner */}
          <CapabilityGatingInfo
            hasAssessment={hasAssessment}
            lockedCount={recommendedExercises.filter(ex => !checkExerciseAccess(ex.id).accessible).length}
            adaptedCount={recommendedExercises.filter(ex => {
              const access = checkExerciseAccess(ex.id);
              const adaptations = getAdaptations(ex.id);
              return access.accessible && adaptations && getAdaptationSummary(adaptations).length > 0;
            }).length}
            hasSoftOverride={hasSoftOverride}
            onStartAssessment={() => setShowCapabilityAssessment(true)}
          />
          
          <div className="grid md:grid-cols-3 gap-4">
            {recommendedExercises.map((exercise) => {
              const Icon = exercise.icon;
              const recommendation = recommendations.find(r => r.slug === exercise.id);
              
              // Check capability-based access
              const accessCheck = checkExerciseAccess(exercise.id);
              const adaptations = getAdaptations(exercise.id);
              const adaptationSummary = adaptations ? getAdaptationSummary(adaptations) : [];
              const isLocked = !accessCheck.accessible;
              
              // Check if this exercise is in today's plan
              const inTodaysPlan = lesson?.blocks?.some(b => b.exerciseId === exercise.id);
              
              return (
                <Card 
                  key={exercise.id}
                  className={`p-6 shadow-card transition-smooth border-2 ${
                    isLocked 
                      ? 'opacity-60 cursor-not-allowed' 
                      : 'hover:shadow-glow cursor-pointer hover:border-primary'
                  } group`}
                  onClick={() => !isLocked && navigate(`/exercise/${exercise.id}`)}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className={`w-14 h-14 rounded-full ${exercise.color} flex items-center justify-center ${!isLocked && 'group-hover:scale-110'} transition-smooth`}>
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <ExerciseGatingBadge
                        isAccessible={accessCheck.accessible}
                        reason={accessCheck.reason}
                        alternative={accessCheck.alternative}
                        hasAdaptations={!!adaptations}
                        adaptationCount={adaptationSummary.length}
                      />
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
                        {inTodaysPlan && (
                          <Badge className="text-xs bg-blue-500 hover:bg-blue-600">
                            In today's plan
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
                      
                      {/* Show adaptations if present */}
                      {!isLocked && adaptationSummary.length > 0 && (
                        <div className="mt-2 pt-2 border-t">
                          <p className="text-xs font-medium text-primary mb-1">Active Adaptations:</p>
                          <ul className="text-xs text-muted-foreground space-y-0.5">
                            {adaptationSummary.slice(0, 3).map((adaptation, idx) => (
                              <li key={idx}>• {adaptation}</li>
                            ))}
                            {adaptationSummary.length > 3 && (
                              <li className="text-primary">+ {adaptationSummary.length - 3} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                    <Button 
                      className="w-full bg-gradient-healing hover:opacity-90"
                      size="lg"
                      disabled={isLocked}
                    >
                      <Play className="w-5 h-5 mr-2" />
                      {isLocked ? 'Locked' : 'Start Exercise'}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Language Recovery Progress */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Language Recovery Progress</h2>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2">
              <ExerciseProgressCard
                userId={user?.id}
                exerciseSlug="semantic-features"
                exerciseTitle="Semantic Feature Analysis"
                exerciseIcon={Lightbulb}
                targets="word-finding, semantic errors"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/analytics/semantic")}
                className="w-full"
              >
                View Detailed Analytics
              </Button>
            </div>
            <div className="space-y-2">
              <ExerciseProgressCard
                userId={user?.id}
                exerciseSlug="phonological-awareness"
                exerciseTitle="Phonological Awareness"
                exerciseIcon={Volume2}
                targets="phonemic paraphasias, sound discrimination"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/analytics/phoneme")}
                className="w-full"
              >
                View Detailed Analytics
              </Button>
            </div>
            <div className="space-y-2">
              <ExerciseProgressCard
                userId={user?.id}
                exerciseSlug="sentence-construction"
                exerciseTitle="Sentence Construction"
                exerciseIcon={List}
                targets="syntax, grammar, word order"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/analytics/grammar")}
                className="w-full"
              >
                View Detailed Analytics
              </Button>
            </div>
          </div>
        </div>

        {/* Exercise Performance Analytics */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Motor Performance</h2>
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
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate("/history")}
                className="gap-2"
              >
                <History className="w-4 h-4" />
                View History
              </Button>
            </div>
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
    </div>
  );
};

export default Dashboard;
