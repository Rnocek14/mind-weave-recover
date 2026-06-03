/**
 * Insights Page - Unified intelligence hub
 * 
 * Tab-based layout with patient-safe language:
 * - Overview (at-a-glance snapshot)
 * - Progress (am I improving?)
 * - What's Hard (challenges)
 * - What Helps (strategies)
 * - How It's Adapting (adaptations)
 * - Alerts (anything concerning?)
 */

import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { BackButton } from "@/components/layout/BackButton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, AlertCircle, FileText,
  LayoutGrid, Target, Lightbulb, AlertTriangle, Brain
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUiMode } from "@/hooks/useUiMode";
import { supabase } from "@/integrations/supabase/client";


// Question-based insight sections
import { 
  OverviewSection,
  ChallengesSection, 
  StrategiesSection, 
  AlertsSection,
  IntelligenceSection,
  TransferAnalyticsSection,
} from "@/components/insights";

// Clinical tab components (removed - now only in Weekly Review)
// Deep dive components removed from Insights - clinician data belongs in Weekly Review

import { useRedFlagDetection } from "@/hooks/useRedFlagDetection";
import { ClinicalProfile } from "@/lib/clinicalProfileMapper";

// Tab configuration — focused on pattern recognition, not progress (that's /recovery-progress)
const INSIGHT_TABS = [
  { id: 'overview', label: 'Overview', shortLabel: 'Overview', icon: LayoutGrid },
  { id: 'challenges', label: "What's Hard", shortLabel: 'Hard', icon: Target },
  { id: 'strategies', label: 'What Helps', shortLabel: 'Helps', icon: Lightbulb },
  { id: 'intelligence', label: 'Intelligence', shortLabel: 'Intel', icon: Brain },
  { id: 'alerts', label: 'Alerts', shortLabel: 'Alerts', icon: AlertTriangle },
] as const;

type InsightTabId = typeof INSIGHT_TABS[number]['id'];

export default function Insights() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { activeProfile } = useProfile();
  const { uiMode, isAtLeast } = useUiMode();
  
  // Parse tab from URL params (for deep linking)
  const searchParams = new URLSearchParams(location.search);
  const targetTab = searchParams.get('tab') as InsightTabId | 'clinical' | null;
  // Legacy support: map old ?section= to ?tab=
  const legacySection = searchParams.get('section');
  
  // Read default tab from URL, navigation state, or localStorage
  const [activeTab, setActiveTab] = useState<string>(() => {
    // Priority: URL param > legacy section > nav state > localStorage
    if (targetTab) return targetTab;
    if (legacySection && INSIGHT_TABS.some(t => t.id === legacySection)) return legacySection;
    const stateTab = (location.state as any)?.defaultTab;
    if (stateTab) return stateTab;
    return localStorage.getItem('insights-active-tab') || 'overview';
  });
  
  const [clinicalProfile, setClinicalProfile] = useState<ClinicalProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const { flags: redFlags, isLoading: flagsLoading } = useRedFlagDetection(user?.id || null);

  // Gate tabs based on view mode
  const showAdaptations = isAtLeast('caregiver');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      loadData();
    }
  }, [user, authLoading, navigate, activeProfile?.id]);

  // Sync URL tab param with state — redirect progress to Recovery Progress page
  useEffect(() => {
    if ((targetTab as string) === 'progress' || legacySection === 'progress') {
      navigate('/recovery-progress', { replace: true });
      return;
    }
    if (targetTab && targetTab !== activeTab) {
      setActiveTab(targetTab);
    }
  }, [targetTab, legacySection, navigate]);

  // Reset to overview if current tab is hidden
  useEffect(() => {
    if (!showAdaptations && activeTab === 'intelligence') {
      setActiveTab('overview');
    }
  }, [showAdaptations, activeTab]);

  const loadData = async () => {
    if (!user) return;
    
    try {
      // Must query the ACTIVE profile, not just any profile for this user
      const { data: profileData } = await supabase
        .from('profiles')
        .select('clinical_profile')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

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
    // Update URL without navigation
    const newParams = new URLSearchParams(location.search);
    newParams.set('tab', value);
    window.history.replaceState({}, '', `${location.pathname}?${newParams.toString()}`);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Filter tabs based on role
  const visibleTabs = INSIGHT_TABS.filter(tab => {
    if (tab.id === 'intelligence') return showAdaptations;
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-calm">
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-5xl">
      {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BackButton />
              <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
                Insights
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                What's hard, what helps, and how the system is adapting for you.
              </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isAtLeast('clinician') && (
                <Button variant="outline" size="sm" asChild className="gap-2">
                  <Link to="/clinician/review">
                    <FileText className="w-4 h-4" />
                    <span className="hidden sm:inline">Weekly Review</span>
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

        {/* Sticky Tab Navigation */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="sticky top-0 z-10 bg-gradient-calm pb-4 -mx-4 px-4">
            <TabsList className="w-full h-auto flex flex-wrap gap-1 bg-muted/80 backdrop-blur-sm p-1">
              {visibleTabs.map(tab => (
                <TabsTrigger 
                  key={tab.id}
                  value={tab.id} 
                  className="gap-1.5 text-xs md:text-sm flex-1 min-w-fit px-2 md:px-3"
                >
                  <tab.icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                  {tab.id === 'alerts' && !flagsLoading && redFlags.length > 0 && (
                    <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                      {redFlags.length}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4">
            <OverviewSection userId={user!.id} profileId={activeProfile?.id} />
          </TabsContent>


          {/* Challenges Tab (What's Hard) */}
          <TabsContent value="challenges" className="mt-4">
            <ChallengesSection userId={user!.id} profileId={activeProfile?.id} />
          </TabsContent>

          {/* Strategies Tab (What Helps) */}
          <TabsContent value="strategies" className="mt-4">
            <StrategiesSection userId={user!.id} profileId={activeProfile?.id} />
          </TabsContent>

          {/* Intelligence Tab - caregiver+ */}
          {showAdaptations && (
            <TabsContent value="intelligence" className="mt-4 space-y-6">
              <TransferAnalyticsSection userId={user!.id} />
              <IntelligenceSection userId={user!.id} profileId={activeProfile?.id} />
            </TabsContent>
          )}

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="mt-4">
            <AlertsSection userId={user!.id} />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}
