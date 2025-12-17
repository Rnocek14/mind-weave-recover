import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ArrowLeft, Activity, Brain, Stethoscope, 
  Loader2, AlertCircle, ChevronDown, ChevronUp, AudioWaveform, FileText, Lightbulb, CheckCircle2, Wrench
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUiMode } from "@/hooks/useUiMode";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ViewModeSelector } from "@/components/ViewModeSelector";

// Recovery Snapshot (primary intelligence view)
import { RecoverySnapshot } from "@/components/RecoverySnapshot";

// Speech Analysis components (for Deep Dive)
import { ErrorPatternDashboard } from "@/components/ErrorPatternDashboard";
import { SpeechLabPanel } from "@/components/SpeechLabPanel";
import { MicroFluencyCard } from "@/components/MicroFluencyCard";
import { PronunciationScoreCard } from "@/components/PronunciationScoreCard";

// Cross-Domain Intelligence (for Deep Dive)
import { CrossDomainInsightsDashboard } from "@/components/CrossDomainInsightsDashboard";
import { CueTelemetryDashboard } from "@/components/CueTelemetryDashboard";
import { CueTelemetryHealth } from "@/components/CueTelemetryHealth";
import { ClusterComparisonDashboard } from "@/components/ClusterComparisonDashboard";

// Clinical tab components
import { StrokeProfileSummary } from "@/components/StrokeProfileSummary";
import { BrainMap } from "@/components/BrainMap";
import { MechanismSessionPlanner } from "@/components/MechanismSessionPlanner";

// Hooks
import { useRedFlagDetection } from "@/hooks/useRedFlagDetection";
import { useCapabilitySpeechCorrelation } from "@/hooks/useCapabilitySpeechCorrelation";
import { ClinicalProfile } from "@/lib/clinicalProfileMapper";

export default function Insights() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activeProfile } = useProfile();
  const { uiMode, isAtLeast } = useUiMode();
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('insights-active-tab') || 'snapshot';
  });
  const [clinicalProfile, setClinicalProfile] = useState<ClinicalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Collapsible states for Deep Dive
  const [speechExpanded, setSpeechExpanded] = useState(() => isAtLeast('clinician'));
  const [speechLabExpanded, setSpeechLabExpanded] = useState(false);
  const [intelligenceExpanded, setIntelligenceExpanded] = useState(false);
  const [diagnosticsExpanded, setDiagnosticsExpanded] = useState(false);

  const { flags: redFlags, isLoading: flagsLoading } = useRedFlagDetection(user?.id || null);
  
  // PHASE 3: Fetch recommendations for top-level display
  const { analytics: crossDomainAnalytics } = useCapabilitySpeechCorrelation(
    user?.id || '', 
    activeProfile?.id
  );

  // Gate tabs based on view mode
  const showDeepDive = isAtLeast('clinician');
  const showClinical = isAtLeast('clinician');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      loadData();
    }
  }, [user, authLoading, navigate]);

  // Reset to snapshot tab if current tab is hidden
  useEffect(() => {
    if (!showDeepDive && activeTab === 'deep-dive') {
      setActiveTab('snapshot');
    }
    if (!showClinical && activeTab === 'clinical') {
      setActiveTab('snapshot');
    }
  }, [showDeepDive, showClinical, activeTab]);

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

  // Calculate grid columns based on visible tabs
  const tabCount = 1 + (showDeepDive ? 1 : 0) + (showClinical ? 1 : 0);
  const gridCols = tabCount === 1 ? 'grid-cols-1' : tabCount === 2 ? 'grid-cols-2' : 'grid-cols-3';

  // PHASE 3: Extract recommendations
  const recommendations = crossDomainAnalytics?.recommendations || [];

  return (
    <div className="min-h-screen bg-gradient-calm">
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
            
            {/* View Mode Selector */}
            <ViewModeSelector />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2">
                Your Recovery
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                {uiMode === 'patient' && "See how you're doing"}
                {uiMode === 'caregiver' && "Track progress and support recovery"}
                {uiMode === 'clinician' && "Diagnostic analysis and clinical insights"}
                {uiMode === 'admin' && "Full system access and diagnostics"}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {isAtLeast('clinician') && (
                <Button variant="outline" size="sm" asChild className="gap-2">
                  <Link to="/clinician/report">
                    <FileText className="w-4 h-4" />
                    <span className="hidden sm:inline">Export Report</span>
                  </Link>
                </Button>
              )}
              
              {!flagsLoading && redFlags.length > 0 && isAtLeast('caregiver') && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {redFlags.length} Alert{redFlags.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Tabbed Content - Dynamic based on view mode */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          {/* Phase 1: Hide tab bar when only 1 tab visible (patient/caregiver) */}
          {tabCount > 1 && (
            <TabsList className={`grid w-full ${gridCols} mb-8`}>
              <TabsTrigger value="snapshot" className="gap-2 text-xs md:text-sm">
                <Activity className="w-4 h-4" />
                <span className="hidden sm:inline">Snapshot</span>
              </TabsTrigger>
              {showDeepDive && (
                <TabsTrigger value="deep-dive" className="gap-2 text-xs md:text-sm">
                  <Brain className="w-4 h-4" />
                  <span className="hidden sm:inline">Deep Dive</span>
                </TabsTrigger>
              )}
              {showClinical && (
                <TabsTrigger value="clinical" className="gap-2 text-xs md:text-sm">
                  <Stethoscope className="w-4 h-4" />
                  <span className="hidden sm:inline">Clinical</span>
                </TabsTrigger>
              )}
            </TabsList>
          )}

          {/* Recovery Snapshot Tab (Primary - Always visible) */}
          <TabsContent value="snapshot" className="space-y-6">
            <RecoverySnapshot userId={user!.id} />
          </TabsContent>

          {/* Deep Dive Tab (Clinician+) */}
          {showDeepDive && (
            <TabsContent value="deep-dive" className="space-y-6">
              {/* P0: Cue Telemetry Health Banner (admin-only) */}
              {uiMode === 'admin' && (
                <CueTelemetryHealth userId={user!.id} daysBack={30} />
              )}

              {/* PHASE 3: Smart Recommendations (Always visible at top) */}
              {recommendations.length > 0 && (
                <Card className="p-4 border-primary/50 bg-primary/5">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Smart Recommendations</h3>
                  </div>
                  <div className="space-y-2">
                    {recommendations.slice(0, 3).map((rec, i) => (
                      <Alert key={i} className="border-primary/20 py-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <AlertDescription className="text-sm">{rec}</AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </Card>
              )}
              
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

              {/* Pronunciation & Fluency (Secondary, collapsed) */}
              <Collapsible open={speechLabExpanded} onOpenChange={setSpeechLabExpanded}>
                <Card className="overflow-hidden">
                  <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        <AudioWaveform className="w-5 h-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold">Pronunciation & Fluency</h3>
                        <p className="text-sm text-muted-foreground">
                          Phoneme accuracy and micro-fluency patterns
                        </p>
                      </div>
                    </div>
                    {speechLabExpanded ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0 border-t space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <PronunciationScoreCard userId={user!.id} daysBack={7} />
                        <MicroFluencyCard userId={user!.id} daysBack={7} />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Cross-Domain Details (Secondary, collapsed) */}
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
                      {/* Hide recommendations from CrossDomain since they're now at top */}
                      <CrossDomainInsightsDashboard 
                        userId={user!.id} 
                        profileId={activeProfile?.id}
                        hideRecommendations={true}
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

              {/* PHASE 4: Diagnostics (Admin only, consolidated) */}
              {uiMode === 'admin' && (
                <Collapsible open={diagnosticsExpanded} onOpenChange={setDiagnosticsExpanded}>
                  <Card className="overflow-hidden">
                    <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-amber-500/10">
                          <Wrench className="w-5 h-5 text-amber-500" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold">Diagnostics</h3>
                          <p className="text-sm text-muted-foreground">
                            Pipeline status, cue telemetry, and debug tools
                          </p>
                        </div>
                        <Badge variant="outline" className="ml-2">Admin</Badge>
                      </div>
                      {diagnosticsExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="p-4 pt-0 border-t space-y-6">
                        <SpeechLabPanel userId={user!.id} daysBack={7} />
                        <CueTelemetryDashboard userId={user!.id} daysBack={7} />
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}
            </TabsContent>
          )}

          {/* Clinical Tab (Clinician+) */}
          {showClinical && (
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
                    <h3 className="font-medium mb-3">Clinical Documents & Reports</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigate('/clinical-documents')}>
                        View Documents
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate('/profile-history')}>
                        Profile History
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/clinician/report" className="gap-2">
                          <FileText className="w-4 h-4" />
                          Export Report
                        </Link>
                      </Button>
                    </div>
                  </Card>
                </>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
