/**
 * Caregiver Portal - Thin wrapper over shared Dashboard/Insights
 * 
 * This provides caregivers with a branded "portal" entry point while
 * reusing all the same components. No duplicate data surfaces.
 * 
 * Behavior:
 * - Sets uiMode to 'caregiver' on mount
 * - Shows caregiver-branded header
 * - Defaults to Alerts tab if alerts exist, else Overview
 * - All actual content comes from shared components
 */

import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Heart, Bell, LayoutGrid } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useUiMode } from "@/hooks/useUiMode";
import { useRedFlagDetection } from "@/hooks/useRedFlagDetection";

// Shared insight sections (same as Insights page)
import { 
  OverviewSection,
  AlertsSection,
  ProgressSection,
  StrategiesSection 
} from "@/components/insights";

// Caregiver-specific components
import { SessionAdherenceTracker } from "@/components/SessionAdherenceTracker";
import { CaregiverStatusHero, HowYouCanHelpCard } from "@/components/caregiver/CaregiverStatusHero";
import { calculateStreak } from "@/hooks/useStreakCalculation";

export default function CaregiverPortal() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { uiMode, setUiMode, isAtLeast } = useUiMode();
  const { flags: redFlags, isLoading: flagsLoading } = useRedFlagDetection(user?.id || null);
  
  const [currentStreak, setCurrentStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('overview');
  
  // Refs to prevent re-triggering effects
  const prevModeRef = useRef(uiMode);
  const didInitTab = useRef(false);

  // Set caregiver mode on mount, restore previous on unmount
  useEffect(() => {
    setUiMode('caregiver');
    return () => setUiMode(prevModeRef.current);
  }, [setUiMode]);
  
  // Auto-set tab only once on initial flags load (don't fight user clicks)
  useEffect(() => {
    if (!flagsLoading && !didInitTab.current) {
      setActiveTab(redFlags.length > 0 ? 'alerts' : 'overview');
      didInitTab.current = true;
    }
  }, [flagsLoading, redFlags.length]);

  // Gate: redirect patients away from caregiver portal
  const isCaregiverPlus = isAtLeast('caregiver');
  
  useEffect(() => {
    if (!authLoading && user && !isCaregiverPlus) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, user, isCaregiverPlus, navigate]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (user) {
      loadStreak();
    }
  }, [user, authLoading, navigate]);

  const loadStreak = async () => {
    if (!user) return;
    try {
      const streak = await calculateStreak(user.id);
      setCurrentStreak(streak);
    } catch (error) {
      console.error('Error loading streak:', error);
    } finally {
      setLoading(false);
    }
  };


  // Short-circuit for patients - avoid rendering caregiver UI while redirect runs
  if (!authLoading && user && !isCaregiverPlus) {
    return null;
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-calm">
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-5xl">
        {/* Caregiver-branded header */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-gradient-healing flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold">Caregiver View</h1>
                <Badge variant="secondary" className="text-xs">
                  Support Mode
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Monitor progress, manage uploads, review alerts
              </p>
            </div>
          </div>
          
          {/* Quick action buttons - only show to caregivers+ */}
          {isCaregiverPlus && (
            <div className="flex flex-wrap gap-2 mt-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/photo-library')}
              >
                Upload Photos
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/clinical-documents')}
              >
                Clinical Documents
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/profile-history')}
              >
                Profile History
              </Button>
            </div>
          )}
        </div>

        {/* Main content tabs - reusing shared components */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-auto flex flex-wrap gap-1 bg-muted/80 backdrop-blur-sm p-1 mb-4">
            <TabsTrigger value="overview" className="gap-1.5 flex-1">
              <LayoutGrid className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-1.5 flex-1">
              <Bell className="w-4 h-4" />
              Alerts
              {!flagsLoading && redFlags.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                  {redFlags.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Overview - shared component */}
          <TabsContent value="overview" className="space-y-6">
            <OverviewSection userId={user!.id} />
            
            {/* Adherence tracker - caregiver-specific but not duplicated elsewhere */}
            <Card className="p-6">
              <SessionAdherenceTracker userId={user!.id} currentStreak={currentStreak} />
            </Card>
          </TabsContent>

          {/* Alerts - shared component */}
          <TabsContent value="alerts" className="space-y-6">
            <AlertsSection userId={user!.id} />
            
            {/* Link to full insights for deep dives */}
            <Card className="p-4 border-dashed">
              <p className="text-sm text-muted-foreground text-center">
                Want more detail?{' '}
                <Button 
                  variant="link" 
                  className="p-0 h-auto" 
                  onClick={() => navigate('/insights')}
                >
                  View full Insights →
                </Button>
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
