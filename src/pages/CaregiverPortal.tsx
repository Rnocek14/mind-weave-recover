/**
 * Caregiver Home — Glance Card model.
 *
 * Five cards. One screen. Mobile-first. Evidence over paragraphs.
 *   1. Status   — "Are they okay?"
 *   2. Practice — "Did they practice?"
 *   3. Listen   — "What did it sound like?"
 *   4. Progress — "Are they getting better?"
 *   5. Levels   — "What level are they playing at?"
 *
 * Anything deeper lives behind "More detail" at the bottom.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Heart, ChevronDown, Camera, FileText, History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUiMode } from "@/hooks/useUiMode";
import { useRedFlagDetection } from "@/hooks/useRedFlagDetection";
import { calculateStreak } from "@/hooks/useStreakCalculation";

import { StatusCard } from "@/components/caregiver/glance/StatusCard";
import { PracticeCard } from "@/components/caregiver/glance/PracticeCard";
import { ListenCard } from "@/components/caregiver/glance/ListenCard";
import { ProgressCard } from "@/components/caregiver/glance/ProgressCard";
import { LevelsCard } from "@/components/caregiver/glance/LevelsCard";
import { ProfileSwitcher } from "@/components/ProfileSwitcher";

import { SessionAdherenceTracker } from "@/components/SessionAdherenceTracker";
import { SessionHistoryList } from "@/components/patient/SessionHistoryList";

export default function CaregiverPortal() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activeProfile, loading: profileLoading } = useProfile();
  const { setUiMode } = useUiMode();
  const { flags: redFlags } = useRedFlagDetection(user?.id || null, {}, activeProfile?.id ?? null);

  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user) setUiMode("caregiver");
  }, [authLoading, user, setUiMode]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (user && activeProfile) {
      setLoading(true);
      calculateStreak(user.id, activeProfile.id).then(setStreak).finally(() => setLoading(false));
    } else if (user && !profileLoading) {
      setStreak(0);
      setLoading(false);
    }
  }, [user, activeProfile?.id, profileLoading, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const patientName = activeProfile?.profile_name || "your loved one";
  const visibleConcerns = redFlags.filter(
    (f) => f.severity === "red" || f.severity === "orange"
  );

  return (
    <div className="min-h-screen bg-gradient-calm">
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-2xl space-y-4">
        {/* Header — small, doesn't compete with the cards */}
        <header className="flex items-center gap-2 px-1">
          <Heart className="w-4 h-4 text-pink-500" />
          <h1 className="text-base font-semibold text-foreground">Caregiver Home</h1>
          <div className="ml-auto flex items-center gap-1">
            <RoleHelpButton role="caregiver" />
            <ProfileSwitcher />
          </div>
        </header>

        {/* The five Glance Cards */}
        <StatusCard userId={user!.id} patientName={patientName} profileId={activeProfile?.id ?? null} />
        <PracticeCard userId={user!.id} streak={streak} profileId={activeProfile?.id ?? null} />
        <ListenCard userId={user!.id} profileId={activeProfile?.id ?? null} />
        <ProgressCard userId={user!.id} profileId={activeProfile?.id ?? null} />
        <LevelsCard userId={user!.id} profileId={activeProfile?.id ?? null} />

        {/* Concerns — only when present, never above the cards */}
        {visibleConcerns.length > 0 && (
          <Card className="p-4 border-2 border-destructive/20 space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-destructive font-semibold">
              Concerns to review
            </div>
            <ul className="space-y-1.5">
              {visibleConcerns.map((flag, i) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span
                    className={`shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${
                      flag.severity === "red" ? "bg-destructive" : "bg-amber-500"
                    }`}
                  />
                  <span>{flag.message}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* More detail — collapsed by default. Everything that isn't glance-able. */}
        <Collapsible>
          <CollapsibleTrigger className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full py-3 min-h-[44px] border-t border-border mt-2">
            <span>More detail</span>
            <ChevronDown className="w-4 h-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            <Card className="p-5">
              <SessionAdherenceTracker userId={user!.id} currentStreak={streak} />
            </Card>

            <Card className="p-1">
              <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Session History
              </div>
              <SessionHistoryList userId={user!.id} profileId={activeProfile?.id ?? null} />
            </Card>

            <Card className="p-4 space-y-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Quick Actions
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate("/photo-library")}>
                  <Camera className="w-4 h-4 mr-1.5" />
                  Upload Photos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/clinical-documents")}
                >
                  <FileText className="w-4 h-4 mr-1.5" />
                  Medical Documents
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate("/profile-history")}>
                  <History className="w-4 h-4 mr-1.5" />
                  Profile History
                </Button>
              </div>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
