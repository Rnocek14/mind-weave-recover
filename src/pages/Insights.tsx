import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Activity, MessageSquare, Brain, Stethoscope, 
  Loader2, AlertCircle, Zap
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";

// Overview tab components
import { SessionAdherenceTracker } from "@/components/SessionAdherenceTracker";
import { LearningRateCard } from "@/components/LearningRateCard";
import { WeeklyTrendsChart } from "@/components/WeeklyTrendsChart";
import { TodaysSessionStats } from "@/components/TodaysSessionStats";
import { RedFlagAlerts } from "@/components/RedFlagAlerts";
import { RecoverySummaryCard } from "@/components/RecoverySummaryCard";

// Speech Analysis tab components
import { ErrorPatternDashboard } from "@/components/ErrorPatternDashboard";

// Cross-Domain Intelligence tab
import { CrossDomainInsightsDashboard } from "@/components/CrossDomainInsightsDashboard";
import { ClusterComparisonDashboard } from "@/components/ClusterComparisonDashboard";

// Clinical tab components
import { StrokeProfileSummary } from "@/components/StrokeProfileSummary";
import { BrainMap } from "@/components/BrainMap";
import { MechanismSessionPlanner } from "@/components/MechanismSessionPlanner";

// Hooks
import { useLearningRate } from "@/hooks/useLearningRate";
import { useRedFlagDetection } from "@/hooks/useRedFlagDetection";
import { calculateStreak } from "@/hooks/useStreakCalculation";
import { ClinicalProfile } from "@/lib/clinicalProfileMapper";

export default function Insights() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activeProfile } = useProfile();
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('insights-active-tab') || 'overview';
  });
  const [clinicalProfile, setClinicalProfile] = useState<ClinicalProfile | null>(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const { learningRates, clusterComparisons, isLoading: learningRatesLoading } = useLearningRate(user?.id || null);
  const { flags: redFlags, isLoading: flagsLoading } = useRedFlagDetection(user?.id || null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      loadData();
    }
  }, [user, authLoading, navigate]);

  const loadData = async () => {
    if (!user) return;
    
    try {
      const [streakVal, profileData] = await Promise.all([
        calculateStreak(user.id),
        supabase
          .from('profiles')
          .select('clinical_profile')
          .eq('user_id', user.id)
          .single()
      ]);

      setStreak(streakVal);
      if (profileData.data?.clinical_profile) {
        setClinicalProfile(profileData.data.clinical_profile as unknown as ClinicalProfile);
      }
    } catch (error) {
      console.error('Failed to load insights data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    localStorage.setItem('insights-active-tab', value);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-calm">
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2">
                Insights & Analytics
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Comprehensive view of your recovery progress and patterns
              </p>
            </div>
            
            {!flagsLoading && redFlags.length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="w-3 h-3" />
                {redFlags.length} Alert{redFlags.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="overview" className="gap-2 text-xs md:text-sm">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="speech" className="gap-2 text-xs md:text-sm">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Speech</span>
            </TabsTrigger>
            <TabsTrigger value="intelligence" className="gap-2 text-xs md:text-sm">
              <Brain className="w-4 h-4" />
              <span className="hidden sm:inline">Intelligence</span>
            </TabsTrigger>
            <TabsTrigger value="clinical" className="gap-2 text-xs md:text-sm">
              <Stethoscope className="w-4 h-4" />
              <span className="hidden sm:inline">Clinical</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Red Flags at top if any */}
            {!flagsLoading && redFlags.length > 0 && (
              <RedFlagAlerts flags={redFlags} />
            )}

            {/* Today's Stats + Streak */}
            <div className="grid gap-4 md:grid-cols-2">
              <TodaysSessionStats />
              <SessionAdherenceTracker userId={user!.id} currentStreak={streak} />
            </div>

            {/* Weekly Trends */}
            <WeeklyTrendsChart />

            {/* Learning Rates */}
            {!learningRatesLoading && learningRates.length > 0 && (
              <LearningRateCard 
                learningRates={learningRates}
                clusterComparisons={clusterComparisons}
                timeWindow={14}
              />
            )}

            {/* Recovery Summary */}
            {user && (
              <RecoverySummaryCard
                userId={user.id}
                summaryType="progress"
                title="Recovery Progress Summary"
                description="AI-generated summary of your therapy progress"
              />
            )}
          </TabsContent>

          {/* Speech Analysis Tab */}
          <TabsContent value="speech" className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <MessageSquare className="w-6 h-6 text-primary" />
              <div>
                <h2 className="text-xl font-semibold">Speech Analysis</h2>
                <p className="text-sm text-muted-foreground">
                  Error patterns, cue efficacy, and fluency metrics
                </p>
              </div>
            </div>

            <ErrorPatternDashboard userId={user!.id} weeksBack={12} />
          </TabsContent>

          {/* Cross-Domain Intelligence Tab */}
          <TabsContent value="intelligence" className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-6 h-6 text-primary" />
              <div>
                <h2 className="text-xl font-semibold">Cross-Domain Intelligence</h2>
                <p className="text-sm text-muted-foreground">
                  Smart correlations between capability, speech, and learning patterns
                </p>
              </div>
            </div>

            {/* Cross-Domain Insights */}
            <CrossDomainInsightsDashboard 
              userId={user!.id} 
              profileId={activeProfile?.id}
            />

            {/* Cluster Comparison */}
            {clinicalProfile && (
              <ClusterComparisonDashboard
                userId={user!.id}
                clinicalProfile={clinicalProfile}
              />
            )}

            {!clinicalProfile && (
              <Card className="p-8 text-center">
                <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Complete Your Clinical Profile</h3>
                <p className="text-muted-foreground mb-4">
                  Set up your clinical profile to unlock outcome predictions and cluster comparisons.
                </p>
                <Button onClick={() => navigate('/dashboard')}>
                  Go to Dashboard
                </Button>
              </Card>
            )}
          </TabsContent>

          {/* Clinical Tab */}
          <TabsContent value="clinical" className="space-y-6">
            {!clinicalProfile ? (
              <Card className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Clinical Profile</h3>
                <p className="text-muted-foreground mb-4">
                  Set up your clinical stroke profile to view personalized clinical information.
                </p>
                <Button onClick={() => navigate('/dashboard')}>
                  Set Up Profile
                </Button>
              </Card>
            ) : (
              <>
                {/* Stroke Profile Summary */}
                <StrokeProfileSummary profile={clinicalProfile} />

                {/* Brain Map */}
                <BrainMap profile={{ clinical_profile: clinicalProfile }} userId={user!.id} />

                {/* Mechanism-Based Planner */}
                {(clinicalProfile as any).stroke_mechanism && (
                  <MechanismSessionPlanner profile={clinicalProfile} />
                )}

                {/* Quick links */}
                <Card className="p-4">
                  <h3 className="font-medium mb-3">Clinical Documents</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigate('/clinical-documents')}>
                      View Documents
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigate('/profile-history')}>
                      Profile History
                    </Button>
                  </div>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}