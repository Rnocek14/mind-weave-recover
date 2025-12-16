import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Activity, Brain, Stethoscope, 
  Loader2, AlertCircle, ChevronDown, ChevronUp
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Recovery Snapshot (primary intelligence view)
import { RecoverySnapshot } from "@/components/RecoverySnapshot";

// Speech Analysis components (for Deep Dive)
import { ErrorPatternDashboard } from "@/components/ErrorPatternDashboard";

// Cross-Domain Intelligence (for Deep Dive)
import { CrossDomainInsightsDashboard } from "@/components/CrossDomainInsightsDashboard";
import { ClusterComparisonDashboard } from "@/components/ClusterComparisonDashboard";

// Clinical tab components
import { StrokeProfileSummary } from "@/components/StrokeProfileSummary";
import { BrainMap } from "@/components/BrainMap";
import { MechanismSessionPlanner } from "@/components/MechanismSessionPlanner";

// Hooks
import { useRedFlagDetection } from "@/hooks/useRedFlagDetection";
import { ClinicalProfile } from "@/lib/clinicalProfileMapper";

export default function Insights() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activeProfile } = useProfile();
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('insights-active-tab') || 'snapshot';
  });
  const [clinicalProfile, setClinicalProfile] = useState<ClinicalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [speechExpanded, setSpeechExpanded] = useState(false);
  const [intelligenceExpanded, setIntelligenceExpanded] = useState(false);

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
      const { data: profileData } = await supabase
        .from('profiles')
        .select('clinical_profile')
        .eq('user_id', user.id)
        .single();

      if (profileData?.clinical_profile) {
        setClinicalProfile(profileData.clinical_profile as unknown as ClinicalProfile);
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
                Your Recovery
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Understand your progress and what's working for you
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

        {/* Tabbed Content - Simplified to 3 tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="snapshot" className="gap-2 text-xs md:text-sm">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Snapshot</span>
            </TabsTrigger>
            <TabsTrigger value="deep-dive" className="gap-2 text-xs md:text-sm">
              <Brain className="w-4 h-4" />
              <span className="hidden sm:inline">Deep Dive</span>
            </TabsTrigger>
            <TabsTrigger value="clinical" className="gap-2 text-xs md:text-sm">
              <Stethoscope className="w-4 h-4" />
              <span className="hidden sm:inline">Clinical</span>
            </TabsTrigger>
          </TabsList>

          {/* Recovery Snapshot Tab (Primary) */}
          <TabsContent value="snapshot" className="space-y-6">
            <RecoverySnapshot userId={user!.id} />
          </TabsContent>

          {/* Deep Dive Tab (Merged Speech + Intelligence) */}
          <TabsContent value="deep-dive" className="space-y-6">
            {/* Speech Analysis Section */}
            <Collapsible open={speechExpanded} onOpenChange={setSpeechExpanded}>
              <Card className="overflow-hidden">
                <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Activity className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold">Speech Analysis</h3>
                      <p className="text-sm text-muted-foreground">
                        Error patterns, cue efficacy, and fluency metrics
                      </p>
                    </div>
                  </div>
                  {speechExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-4 pt-0 border-t">
                    <ErrorPatternDashboard userId={user!.id} weeksBack={12} />
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Cross-Domain Intelligence Section */}
            <Collapsible open={intelligenceExpanded} onOpenChange={setIntelligenceExpanded}>
              <Card className="overflow-hidden">
                <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Brain className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold">Cross-Domain Intelligence</h3>
                      <p className="text-sm text-muted-foreground">
                        Correlations between capabilities and speech patterns
                      </p>
                    </div>
                  </div>
                  {intelligenceExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-4 pt-0 border-t space-y-6">
                    <CrossDomainInsightsDashboard 
                      userId={user!.id} 
                      profileId={activeProfile?.id}
                    />
                    
                    {clinicalProfile && (
                      <ClusterComparisonDashboard
                        userId={user!.id}
                        clinicalProfile={clinicalProfile}
                      />
                    )}

                    {!clinicalProfile && (
                      <Card className="p-6 text-center border-dashed">
                        <Brain className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                        <h4 className="font-medium mb-1">Clinical Profile Required</h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          Set up your profile to unlock cluster comparisons.
                        </p>
                        <Button size="sm" variant="outline" onClick={() => navigate('/dashboard')}>
                          Go to Dashboard
                        </Button>
                      </Card>
                    )}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
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
