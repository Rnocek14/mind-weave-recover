/**
 * Insights Page - Deep dive intelligence
 * 
 * Question-based layout:
 * - Am I improving? (progress trends)
 * - What's hard for me? (challenges)
 * - What's helping? (strategies)
 * - How is the system adapting? (adaptations)
 * - Anything concerning? (alerts)
 */

import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Brain, Stethoscope, 
  Loader2, AlertCircle, FileText,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUiMode } from "@/hooks/useUiMode";
import { supabase } from "@/integrations/supabase/client";
import { ViewModeSelector } from "@/components/ViewModeSelector";

// Question-based insight sections
import { 
  ProgressSection, 
  ChallengesSection, 
  StrategiesSection, 
  AdaptationsSection,
  AlertsSection 
} from "@/components/insights";

// Clinical tab components
import { StrokeProfileSummary } from "@/components/StrokeProfileSummary";
import { BrainMap } from "@/components/BrainMap";
import { MechanismSessionPlanner } from "@/components/MechanismSessionPlanner";

// Deep dive components (for clinician+)
import { ErrorPatternDashboard } from "@/components/ErrorPatternDashboard";
import { SpeechLabPanel } from "@/components/SpeechLabPanel";
import { CrossDomainInsightsDashboard } from "@/components/CrossDomainInsightsDashboard";
import { CueTelemetryHealth } from "@/components/CueTelemetryHealth";

import { useRedFlagDetection } from "@/hooks/useRedFlagDetection";
import { ClinicalProfile } from "@/lib/clinicalProfileMapper";

export default function Insights() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { activeProfile } = useProfile();
  const { uiMode, isAtLeast } = useUiMode();
  
  // Parse section from URL params (for deep linking from Analytics cards)
  const searchParams = new URLSearchParams(location.search);
  const targetSection = searchParams.get('section');
  
  // Read default tab from navigation state or localStorage
  const [activeTab, setActiveTab] = useState(() => {
    const stateTab = (location.state as any)?.defaultTab;
    if (stateTab && ['insights', 'clinical'].includes(stateTab)) {
      return stateTab;
    }
    return localStorage.getItem('insights-active-tab') || 'insights';
  });
  const [clinicalProfile, setClinicalProfile] = useState<ClinicalProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const { flags: redFlags, isLoading: flagsLoading } = useRedFlagDetection(user?.id || null);

  // Gate tabs based on view mode
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

  // Scroll to section if specified in URL
  useEffect(() => {
    if (targetSection && !loading) {
      const element = document.getElementById(targetSection);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [targetSection, loading]);

  // Reset to insights tab if current tab is hidden
  useEffect(() => {
    if (!showClinical && activeTab === 'clinical') {
      setActiveTab('insights');
    }
  }, [showClinical, activeTab]);

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
  const tabCount = 1 + (showClinical ? 1 : 0);
  const gridCols = tabCount === 1 ? 'grid-cols-1' : 'grid-cols-2';

  return (
    <div className="min-h-screen bg-gradient-calm">
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-4xl">
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
                {uiMode === 'patient' && "Understand your progress and what's helping"}
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

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          {/* Only show tab bar if multiple tabs visible */}
          {tabCount > 1 && (
            <TabsList className={`grid w-full ${gridCols} mb-8`}>
              <TabsTrigger value="insights" className="gap-2 text-xs md:text-sm">
                <Brain className="w-4 h-4" />
                <span>Insights</span>
              </TabsTrigger>
              {showClinical && (
                <TabsTrigger value="clinical" className="gap-2 text-xs md:text-sm">
                  <Stethoscope className="w-4 h-4" />
                  <span>Clinical</span>
                </TabsTrigger>
              )}
            </TabsList>
          )}

          {/* Insights Tab - Question-based layout */}
          <TabsContent value="insights" className="space-y-6">
            {/* Q1: Am I improving? */}
            <ProgressSection userId={user!.id} />

            {/* Q2: What's hard for me? */}
            <ChallengesSection userId={user!.id} />

            {/* Q3: What's helping? */}
            <StrategiesSection userId={user!.id} />

            {/* Q4: How is the system adapting? (caregiver+) */}
            {isAtLeast('caregiver') && (
              <AdaptationsSection userId={user!.id} />
            )}

            {/* Q5: Anything concerning? */}
            <AlertsSection userId={user!.id} />

            {/* Detailed Speech Analysis - Available to caregivers+ */}
            {isAtLeast('caregiver') && (
              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Detailed Speech Analysis
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Breakdown of speech patterns, error types, and fluency metrics over time.
                </p>
                <ErrorPatternDashboard userId={user!.id} weeksBack={12} />
              </Card>
            )}

            {/* Cross-domain insights - Available to caregivers+ */}
            {isAtLeast('caregiver') && (
              <CrossDomainInsightsDashboard 
                userId={user!.id} 
                profileId={activeProfile?.id}
              />
            )}

            {/* Admin diagnostics */}
            {uiMode === 'admin' && (
              <CueTelemetryHealth userId={user!.id} daysBack={30} />
            )}
          </TabsContent>

          {/* Clinical Tab (Clinician+) */}
          {showClinical && (
            <TabsContent value="clinical" className="space-y-6">
              {/* Stroke Profile */}
              {activeProfile && clinicalProfile && (
                <>
                  <StrokeProfileSummary profile={clinicalProfile} />
                  <BrainMap profile={{ clinical_profile: clinicalProfile }} userId={user!.id} />
                  <MechanismSessionPlanner profile={clinicalProfile} />
                </>
              )}

              {!clinicalProfile && (
                <Card className="p-6 text-center border-dashed">
                  <Brain className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <h4 className="font-medium mb-1">Clinical Profile Required</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Set up the clinical profile to unlock stroke-specific insights.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => navigate('/dashboard')}>
                    Go to Dashboard
                  </Button>
                </Card>
              )}

              {/* Cross-domain intelligence */}
              <CrossDomainInsightsDashboard 
                userId={user!.id} 
                profileId={activeProfile?.id}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
