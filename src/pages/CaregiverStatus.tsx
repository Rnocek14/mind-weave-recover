/**
 * Caregiver Status Page — caregiver-first progress + concerns view.
 * NOT a relabeled patient progress page.
 * 
 * Prioritizes: Status hero → How to help → Adherence → Concerns → Progress summary → Session history
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUiMode } from "@/hooks/useUiMode";
import { useRedFlagDetection } from "@/hooks/useRedFlagDetection";
import { calculateStreak } from "@/hooks/useStreakCalculation";

import { CaregiverStatusHero, HowYouCanHelpCard } from "@/components/caregiver/CaregiverStatusHero";
import { SessionAdherenceTracker } from "@/components/SessionAdherenceTracker";
import { OverviewSection } from "@/components/insights";
import { SessionHistoryList } from "@/components/patient/SessionHistoryList";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

export default function CaregiverStatus() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activeProfile } = useProfile();
  const { isAtLeast } = useUiMode();
  const { flags: redFlags, isLoading: flagsLoading } = useRedFlagDetection(user?.id || null);

  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const isCaregiverPlus = isAtLeast("caregiver");

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
      calculateStreak(user.id).then(setStreak).finally(() => setLoading(false));
    }
  }, [user, authLoading, navigate]);

  if (!authLoading && user && !isCaregiverPlus) return null;

  if (authLoading || loading) {
    return (
      <div className="min-h-dvh bg-gradient-calm flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const alertCount = redFlags.filter(
    (f) => f.severity === "red" || f.severity === "orange"
  ).length;

  return (
    <div className="min-h-dvh bg-gradient-calm">
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-5xl space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Heart className="w-5 h-5 text-pink-500" />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Status</h1>
            {!flagsLoading && alertCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {alertCount} concern{alertCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            How they're doing, what to watch, and how you can help.
          </p>
        </div>

        {/* 1. Status Hero — above the fold */}
        <CaregiverStatusHero userId={user!.id} streak={streak} />

        {/* 2. How You Can Help */}
        <HowYouCanHelpCard userId={user!.id} patientName={activeProfile?.profile_name || undefined} />

        {/* 3. Adherence */}
        <Card className="p-6">
          <SessionAdherenceTracker userId={user!.id} currentStreak={streak} />
        </Card>

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

        {/* 5. Progress Summary — compact overview */}
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
      </div>
    </div>
  );
}
