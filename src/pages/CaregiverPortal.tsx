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
import { Heart, ChevronDown, Camera, FileText, History, Play } from "lucide-react";
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
import { RoleHelpButton } from "@/components/RoleHelpButton";
import { DashboardTour } from "@/components/tour/DashboardTour";

import { SessionAdherenceTracker } from "@/components/SessionAdherenceTracker";
import { SessionHistoryList } from "@/components/patient/SessionHistoryList";

export default function CaregiverPortal() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activeProfile, loading: profileLoading } = useProfile();
  const { setUiMode } = useUiMode();
  const { flags: redFlags } = useRedFlagDetection(user?.id || null, {}, activeProfile?.id ?? null);

  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!authLoading && user) setUiMode("caregiver");
  }, [authLoading, user, setUiMode]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  // Compute the streak in the background — never blanks the page while it loads.
  useEffect(() => {
    let cancelled = false;
    if (user && activeProfile) {
      calculateStreak(user.id, activeProfile.id).then((s) => {
        if (!cancelled) setStreak(s);
      });
    } else if (user && !profileLoading) {
      setStreak(0);
    }
    return () => {
      cancelled = true;
    };
  }, [user, activeProfile?.id, profileLoading]);

  // Redirect/auth/profile settling — keep this page from flashing a full-screen loader.
  if (authLoading || !user || (profileLoading && !activeProfile)) return null;

  // No patient profile yet — guide the caregiver to set up the person they're
  // helping rather than showing empty monitoring cards (no dead-end).
  if (!activeProfile) {
    return (
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 space-y-6 text-center">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Heart className="w-7 h-7 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Let's get started</h1>
            <p className="text-muted-foreground">
              Add the person you're helping to set up their practice.
            </p>
          </div>
          <Button size="lg" className="w-full gap-2" onClick={() => navigate("/caregiver/setup")}>
            Who are you helping?
            <Play className="w-4 h-4" />
          </Button>
        </Card>
      </div>
    );
  }

  const patientName = activeProfile?.profile_name || "your loved one";
  const visibleConcerns = redFlags.filter(
    (f) => f.severity === "red" || f.severity === "orange"
  );

  const startPracticeForPatient = () => {
    // The active profile is already the patient; /today is the canonical
    // session entry and builds the lesson scoped to that profile.
    navigate("/today");
  };

  return (
    <div className="min-h-screen bg-gradient-calm">
      <DashboardTour role="caregiver" ready={!!activeProfile} />
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-2xl space-y-4">
        {/* Header — small, doesn't compete with the cards */}
        <header className="flex items-center gap-2 px-1">
          <Heart className="w-4 h-4 text-pink-500" />
          <h1 className="text-base font-semibold text-foreground">Caregiver Home</h1>
          <div className="ml-auto flex items-center gap-1">
            <RoleHelpButton role="caregiver" spotlight />
            <ProfileSwitcher />
          </div>
        </header>

        {/* Primary action — start a real session for the person recovering */}
        <Button
          size="lg"
          className="w-full gap-2 text-base h-14"
          onClick={startPracticeForPatient}
        >
          <Play className="w-5 h-5" />
          Start practice for {patientName}
        </Button>


        {/* The five Glance Cards */}
        <div data-tour="cg-status">
          <StatusCard userId={user!.id} patientName={patientName} profileId={activeProfile?.id ?? null} />
        </div>
        <div data-tour="cg-practice">
          <PracticeCard userId={user!.id} streak={streak} profileId={activeProfile?.id ?? null} />
        </div>
        <div data-tour="cg-listen">
          <ListenCard userId={user!.id} profileId={activeProfile?.id ?? null} />
        </div>
        <div data-tour="cg-progress">
          <ProgressCard userId={user!.id} profileId={activeProfile?.id ?? null} />
        </div>
        <div data-tour="cg-levels">
          <LevelsCard userId={user!.id} profileId={activeProfile?.id ?? null} />
        </div>

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
          <CollapsibleTrigger data-tour="cg-more" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full py-3 min-h-[44px] border-t border-border mt-2">
            <span>More detail</span>
            <ChevronDown className="w-4 h-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            <Card data-tour="cg-more-history" className="p-5">
              <SessionAdherenceTracker userId={user!.id} currentStreak={streak} />
            </Card>

            <Card className="p-1">
              <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Session History
              </div>
              <SessionHistoryList userId={user!.id} profileId={activeProfile?.id ?? null} />
            </Card>

            <Card data-tour="cg-more-actions" className="p-4 space-y-3">

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
