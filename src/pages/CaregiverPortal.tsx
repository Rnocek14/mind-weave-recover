/**
 * Caregiver Home — unified single-page caregiver surface.
 * 
 * Answers: "Are they okay, and how can I help?"
 * 
 * Layout (scroll order):
 *   1. Status Hero (above the fold)
 *   2. How You Can Help
 *   3. Concerns (conditional)
 *   4. Adherence
 *   5. Progress Summary
 *   6. Session History (collapsible)
 *   7. Quick Actions
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Heart, ChevronDown, Camera, FileText, History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUiMode } from "@/hooks/useUiMode";
import { useRedFlagDetection } from "@/hooks/useRedFlagDetection";
import { calculateStreak } from "@/hooks/useStreakCalculation";

import { CaregiverStatusHero, HowYouCanHelpCard } from "@/components/caregiver/CaregiverStatusHero";
import { WeeklyChangeCard } from "@/components/caregiver/WeeklyChangeCard";
import { CaregiverReassuranceCard } from "@/components/caregiver/CaregiverReassuranceCard";
import { SessionAdherenceTracker } from "@/components/SessionAdherenceTracker";
import { OverviewSection } from "@/components/insights";
import { SessionHistoryList } from "@/components/patient/SessionHistoryList";

export default function CaregiverPortal() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activeProfile } = useProfile();
  const { isAtLeast } = useUiMode();
  const { flags: redFlags, isLoading: flagsLoading } = useRedFlagDetection(user?.id || null);

  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const isCaregiverPlus = isAtLeast("caregiver");

  // Gate: redirect patients away
  useEffect(() => {
    if (!authLoading && user && !isCaregiverPlus) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, user, isCaregiverPlus, navigate]);

  // Auth gate + load streak
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (user) {
      calculateStreak(user.id).then(setStreak).finally(() => setLoading(false));
    }
  }, [user, authLoading, navigate]);

  if (!authLoading && user && !isCaregiverPlus) return null;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const patientName = activeProfile?.profile_name || "your loved one";

  const alertCount = redFlags.filter(
    (f) => f.severity === "red" || f.severity === "orange"
  ).length;

  return (
    <div className="min-h-screen bg-gradient-calm">
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-5xl space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Heart className="w-5 h-5 text-pink-500" />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Caregiver Home</h1>
            {!flagsLoading && alertCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {alertCount} concern{alertCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            How {patientName} is doing, what to watch, and how you can help.
          </p>
        </div>

        {/* 1. Status Hero — warm greeting + status */}
        <CaregiverStatusHero userId={user!.id} streak={streak} patientName={patientName} />

        {/* 2. Reassurance — validates caregiver effort */}
        <CaregiverReassuranceCard userId={user!.id} patientName={patientName} streak={streak} />

        {/* 3. How You Can Help */}
        <HowYouCanHelpCard userId={user!.id} patientName={patientName} />

        {/* 4. Concerns — only if they exist */}
        {!flagsLoading && redFlags.length > 0 && (
          <Card className="p-5 border-2 border-destructive/20 space-y-3">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-destructive" />
              Concerns
            </h3>
            <div className="space-y-2">
              {redFlags.map((flag, i) => (
                <div key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className={`shrink-0 mt-1 w-1.5 h-1.5 rounded-full ${
                    flag.severity === "red" ? "bg-destructive" : "bg-amber-500"
                  }`} />
                  <span>{flag.message}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 5. What Changed This Week */}
        <WeeklyChangeCard userId={user!.id} patientName={patientName} />

        {/* 6. Adherence */}
        <Card className="p-6">
          <SessionAdherenceTracker userId={user!.id} currentStreak={streak} />
        </Card>

        {/* 7. Progress Summary */}
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground px-1">Progress Summary</h3>
          <OverviewSection userId={user!.id} profileId={activeProfile?.id} />
        </div>

        {/* 6. Session History — collapsible */}
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors w-full py-3 min-h-[48px]">
            <span>Session History</span>
            <ChevronDown className="w-4 h-4" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SessionHistoryList userId={user!.id} />
          </CollapsibleContent>
        </Collapsible>

        {/* 7. Quick Actions */}
        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Quick Actions</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/photo-library')}>
              <Camera className="w-4 h-4 mr-1.5" />
              Upload Photos
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/clinical-documents')}>
              <FileText className="w-4 h-4 mr-1.5" />
              Medical Documents
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/profile-history')}>
              <History className="w-4 h-4 mr-1.5" />
              Profile History
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
