/**
 * Patient Hub — Clinician Glance redesign.
 *
 * Top of page: 5 Glance Cards (same model as caregiver, clinical depth).
 *   1. Triage     — Should I worry?
 *   2. Practice   — Are they getting therapeutic dose?
 *   3. Voice      — What does the deficit sound like?
 *   4. Trajectory — Which way are they trending?
 *   5. Levels     — Where is the engine putting them, is it appropriate?
 *
 * One expandable "Clinical Detail" drawer below holds the existing
 * Sessions / Speech Profile / Patient Info / Intelligence tabs.
 *
 * Sticky documentation bar (Copy Note / EHR / Print) is preserved.
 */
import { useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RoleHelpButton } from "@/components/RoleHelpButton";
import { DashboardTour } from "@/components/tour/DashboardTour";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft, Stethoscope, ClipboardList, Copy, Printer, FileText, Users, ChevronDown,
  Activity, Headphones, Target, Brain, BarChart3,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useProfile } from "@/hooks/useProfile";
import { ProfileContext, type Profile } from "@/contexts/profile-context-value";
import { useQuery } from "@tanstack/react-query";
import { useWeeklyRecoverySnapshot } from "@/hooks/useWeeklyRecoverySnapshot";
import { comparablePracticeDelta } from "@/lib/clinical/clinicianReviewPolicy";
import { useWeeklySessionStats } from "@/hooks/useWeeklySessionStats";
import { useRecoveryAlerts } from "@/hooks/useRecoveryAlerts";

import { formatEhrSummary } from "@/lib/formatEhrSummary";
import { generateProgressNote } from "@/lib/generateProgressNote";
import { computeEngagementScore } from "@/lib/computeEngagementScore";
import { toast } from "sonner";

import { SessionsTab } from "@/components/patient-hub/SessionsTab";
import { SessionReviewTab } from "@/components/patient-hub/SessionReviewTab";
import { SpeechProfileTab } from "@/components/patient-hub/SpeechProfileTab";
import { PatientInfoTab } from "@/components/patient-hub/PatientInfoTab";
import { IntelligenceTab } from "@/components/patient-hub/IntelligenceTab";
import { ProfileCompletenessBanner } from "@/components/patient-hub/ProfileCompletenessBanner";

import { ClinicianStatusCard } from "@/components/patient-hub/glance/ClinicianStatusCard";
import { ClinicianPracticeCard } from "@/components/patient-hub/glance/ClinicianPracticeCard";
import { ClinicianListenCard } from "@/components/patient-hub/glance/ClinicianListenCard";
import { ClinicianProgressCard } from "@/components/patient-hub/glance/ClinicianProgressCard";
import { ClinicianLevelsCard } from "@/components/patient-hub/glance/ClinicianLevelsCard";

type WindowSize = 7 | 14 | 30;

export default function PatientHub() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requested = searchParams.get("profile");
  const { user } = useAuth();
  const permissions = useUserPermissions(user?.id);
  const viewer = useProfile();
  const selection = useQuery({
    queryKey: ["clinician-review-profile", user?.id, requested, permissions.isAdmin],
    enabled: !!requested && !!user?.id && !permissions.isLoading,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: async () => {
      if (!permissions.isAdmin) {
        const assignment = await supabase.rpc("is_assigned_clinician", {
          _clinician_id: user!.id, _profile_id: requested!,
        });
        if (assignment.error) throw assignment.error;
        if (!assignment.data) return null;
      }
      const { data, error } = await supabase.from("profiles").select("*")
        .eq("id", requested!).eq("profile_kind", "patient").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const subject = requested ? selection.data : null;
  const pending = permissions.isLoading || (!!requested && selection.isPending);
  if (pending) return <div className="container max-w-3xl mx-auto p-6" role="status">Opening patient record…</div>;
  if (selection.isError || !subject?.user_id || subject.profile_kind !== "patient") {
    return <div className="container max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">{selection.isError ? "Patient record unavailable" : "Choose a patient"}</h1>
      <p>{selection.isError ? "The patient lookup failed. Try opening the record again." :
        requested !== null ? "This patient is not available to your caseload." : "Open a patient from your caseload to review their practice."}</p>
      {selection.isError && <Button variant="outline" onClick={() => selection.refetch()}>Retry lookup</Button>}
      <Button onClick={() => navigate("/clinician/dashboard")}>Back to caseload</Button>
    </div>;
  }
  // Read-side hooks in the hub must see the subject even when siblings share an account.
  // The signed-in actor remains in AuthContext for permissions, attribution and writes.
  return <ProfileContext.Provider value={{ ...viewer, activeProfile: subject, allProfiles: [subject] }}>
    <SelectedPatientHub key={subject.id} subject={subject} patientUserId={subject.user_id} isAdmin={permissions.isAdmin} />
  </ProfileContext.Provider>;
}

function SelectedPatientHub({ subject, patientUserId, isAdmin }: {
  subject: Profile; patientUserId: string; isAdmin: boolean;
}) {
  const navigate = useNavigate();
  const profileId = subject.id;

  const [windowSize, setWindowSize] = useState<WindowSize>(7);
  // Tab values: "overview" (sessions + intel), "review" (session review + speech), "plan" (patient info)
  const [activeTab, setActiveTab] = useState("overview");
  const [detailOpen, setDetailOpen] = useState(false);
  const [retry, setRetry] = useState(0);

  const { timeline, flags, lastActiveDate, error: snapshotError, refetch: refetchSnapshot, isLoading: snapshotLoading } =
    useWeeklyRecoverySnapshot(profileId, windowSize);

  const sessionStats = useWeeklySessionStats(profileId, retry);

  const alertSessionStats = useMemo(() => {
    if (sessionStats.isLoading || sessionStats.readError) return undefined;
    return {
      recentAvgAccuracy: sessionStats.avgAccuracy,
      priorAvgAccuracy: sessionStats.priorAvgAccuracy,
      accuracySlope: sessionStats.accuracySlope,
      recentTrialCount: sessionStats.trialCount,
      recentSessionCount: sessionStats.sessionCount,
      priorTrialCount: sessionStats.priorTrialCount,
    };
  }, [sessionStats]);
  const { alerts, unacknowledgedCount, readError: alertsError, isLoading: alertsLoading, refetch: refetchAlerts } = useRecoveryAlerts(
    profileId,
    timeline,
    alertSessionStats, false,
  );

  const isLoading = snapshotLoading || sessionStats.isLoading || alertsLoading;
  const unavailable = !!snapshotError || sessionStats.readError || alertsError;
  const activeDays = sessionStats.days.length;
  const lastPracticeDate = sessionStats.days.at(-1) ?? null;
  const pendingAlerts = alerts.filter(a => !a.acknowledged_at);
  const redFlagCount = pendingAlerts.filter(a => a.severity === "critical").length;
  const orangeFlagCount = pendingAlerts.length - redFlagCount;
  const engagement = useMemo(
    () => (timeline.length > 0 ? computeEngagementScore(timeline) : null),
    [timeline]
  );

  const lastActiveLabel = useMemo(() => {
    if (!lastPracticeDate) return null;
    const d = new Date(lastPracticeDate + "T12:00:00");
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.round((today.getTime() - d.setHours(0,0,0,0)) / 86_400_000);
    if (diff === 0) return "today";
    if (diff === 1) return "yesterday";
    if (diff < 7) return `${diff}d ago`;
    return d.toLocaleDateString();
  }, [lastPracticeDate]);

  const progressNote = useMemo(() => {
    if (isLoading || unavailable) return null;
    return generateProgressNote({
      timeline, flags: flags || [], alerts, lastActiveDate, engagement,
      accuracySlope: sessionStats.accuracySlope,
      trialCount: sessionStats.trialCount,
      sessionCount: sessionStats.sessionCount,
      avgAccuracy: sessionStats.avgAccuracy,
      priorAvgAccuracy: sessionStats.priorAvgAccuracy,
      prescribedDays: null,
      profileName: subject?.profile_name || undefined,
    });
  }, [timeline, flags, alerts, lastActiveDate, engagement, sessionStats, isLoading, unavailable, subject]);

  const handleCopyEHR = useCallback(() => {
    const s = formatEhrSummary({ timeline, flags: flags || [], alerts, lastActiveDate, engagement });
    navigator.clipboard.writeText(s);
    toast.success("EHR summary copied");
  }, [timeline, flags, alerts, lastActiveDate, engagement]);

  const handleCopyNote = useCallback(() => {
    if (!progressNote) return;
    navigator.clipboard.writeText(progressNote.narrative);
    toast.success("Progress note copied");
  }, [progressNote]);

  const openDetail = (tab: string) => {
    setActiveTab(tab);
    setDetailOpen(true);
    requestAnimationFrame(() => document.getElementById("clinical-detail")?.scrollIntoView({ block: "start" }));
  };

  const patientName = subject?.profile_name || "Patient";

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6 pb-24 space-y-4 print:py-0">
      <DashboardTour tourId="patient-hub" ready={!!subject} />
      {/* Header */}
      <div data-tour="ph-header" className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" aria-label="Back to dashboard" onClick={() => navigate("/clinician/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold flex items-center gap-2 text-foreground">
              <Stethoscope className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{patientName}</span>
            </h1>
            <p className="text-[11px] text-muted-foreground">Patient Hub</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <RoleHelpButton role="clinician" spotlight spotlightTourId="patient-hub" />
          {isAdmin && (
            <Button
              variant="outline" size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={() => navigate("/admin/cohort-research")}
            >
              <Users className="w-3.5 h-3.5" />
              Cohort
            </Button>
          )}
          <Select value={String(windowSize)} onValueChange={(v) => setWindowSize(Number(v) as WindowSize)}>
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <nav aria-label="Patient review" className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => openDetail("review")}>Review attempts</Button>
        <Button variant="outline" size="sm" onClick={() => openDetail("plan")}>Open patient plan</Button>
      </nav>
      <div data-tour="ph-status">
        {isLoading ? <div role="status" className="text-sm text-muted-foreground">Loading weekly review…</div> :
          unavailable ? <Card className="p-4" role="alert">Weekly review unavailable.
            <Button size="sm" variant="link" onClick={() => { setRetry(n => n + 1); void refetchSnapshot(); void refetchAlerts(); }}>Retry weekly review</Button>
          </Card> : <ClinicianStatusCard patientName={patientName} redFlagCount={redFlagCount} orangeFlagCount={orangeFlagCount}
            unacknowledgedAlerts={unacknowledgedCount} accuracySlope={sessionStats.accuracySlope} activeDays={activeDays}
            lastActiveDate={lastActiveLabel} scoredRecent={sessionStats.trialCount} scoredPrior={sessionStats.priorTrialCount}
            practiceDeltaPp={comparablePracticeDelta(sessionStats.avgAccuracy, sessionStats.priorAvgAccuracy, sessionStats.trialCount, sessionStats.priorTrialCount)} />}
      </div>
      <div data-tour="ph-levels"><ClinicianLevelsCard userId={patientUserId} profileId={profileId} /></div>
      <div data-tour="ph-practice">
        {sessionStats.isLoading ? <Skeleton aria-label="Loading practice" className="h-24" /> : sessionStats.readError ?
          <p role="alert">Practice totals unavailable. <Button variant="link" size="sm" onClick={() => setRetry(n => n + 1)}>Retry practice totals</Button></p> :
          <ClinicianPracticeCard days={sessionStats.days} recorded={sessionStats.recordedEventCount} minutes={sessionStats.minutes}
            trialCount={sessionStats.trialCount} sessionCount={sessionStats.sessionCount} />}
      </div>

      <div data-tour="ph-listen">
        <ClinicianListenCard userId={patientUserId} profileId={profileId} />
      </div>

      <div data-tour="ph-progress">
        <ClinicianProgressCard
          userId={patientUserId}
          profileId={profileId}
        />
      </div>

      <ProfileCompletenessBanner profile={subject} onEditProfile={() => openDetail("plan")} />
      {/* === One drawer: everything deeper === */}
      <Collapsible id="clinical-detail" open={detailOpen} onOpenChange={setDetailOpen}>
        <CollapsibleTrigger data-tour="ph-detail" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full py-3 min-h-[44px] border-t border-border mt-2 print:hidden">
          <span className="font-medium">Clinical Detail</span>
          <ChevronDown className="w-4 h-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <Card className="p-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="overview" data-tour="ph-tab-overview" title="Triage — should I worry?">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="review" data-tour="ph-tab-review" title="Listen — what does it sound like?">
                  Review
                </TabsTrigger>
                <TabsTrigger value="plan" data-tour="ph-tab-plan" title="Decide — what do I do next?">
                  Plan
                </TabsTrigger>

              </TabsList>

              {/* === Overview — Triage === */}
              <TabsContent value="overview" className="space-y-5 pt-4">
                <p className="text-xs text-muted-foreground -mt-1">
                  Status and trends — should I worry?
                </p>
                {/* Jump-to chips */}
                <div className="flex flex-wrap gap-1.5 pb-1 border-b border-border">
                  <a href="#overview-sessions" className="text-[11px] px-2 py-1 rounded-md bg-muted hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground">
                    Sessions
                  </a>
                  <a href="#overview-intel" className="text-[11px] px-2 py-1 rounded-md bg-muted hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground">
                    Intelligence
                  </a>
                </div>

                <section id="overview-sessions" className="scroll-mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Sessions</h3>
                    <span className="text-[11px] text-muted-foreground">Recent activity & accuracy</span>
                  </div>
                  <SessionsTab userId={patientUserId} profileId={profileId} windowSize={windowSize} timeline={timeline} />
                </section>

                <section id="overview-intel" className="scroll-mt-4 border-t border-border pt-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Intelligence</h3>
                    <span className="text-[11px] text-muted-foreground">Learning rate, cohort, predictions</span>
                  </div>
                  <IntelligenceTab userId={patientUserId} profileId={profileId} windowSize={windowSize} />
                </section>
              </TabsContent>

              {/* === Review — Listen + analyze === */}
              <TabsContent value="review" className="space-y-5 pt-4">
                <p className="text-xs text-muted-foreground -mt-1">
                  Voice clips and error patterns — what does it sound like?
                </p>
                <div className="flex flex-wrap gap-1.5 pb-1 border-b border-border">
                  <a href="#review-session" className="text-[11px] px-2 py-1 rounded-md bg-muted hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground">
                    Session Review
                  </a>
                  <a href="#review-speech" className="text-[11px] px-2 py-1 rounded-md bg-muted hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground">
                    Speech Profile
                  </a>
                </div>

                <section id="review-session" className="scroll-mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Headphones className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Session Review</h3>
                    <span className="text-[11px] text-muted-foreground">Voice clips, errors, cue response</span>
                  </div>
                  <SessionReviewTab profileId={profileId} />
                </section>

                <section id="review-speech" className="scroll-mt-4 border-t border-border pt-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Speech Profile</h3>
                    <span className="text-[11px] text-muted-foreground">Phoneme patterns & fade trajectory</span>
                  </div>
                  <SpeechProfileTab userId={patientUserId} profileId={profileId} windowSize={windowSize} />
                </section>
              </TabsContent>

              {/* === Plan — Decide === */}
              <TabsContent value="plan" className="space-y-5 pt-4">
                <p className="text-xs text-muted-foreground -mt-1">
                  Profile, goals, deficits, notes — what do I do next?
                </p>

                <section id="plan-recovery" className="scroll-mt-4">
                  <ClinicianLevelsCard userId={patientUserId} profileId={profileId} />
                </section>

                <section id="plan-info" className="scroll-mt-4 border-t border-border pt-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Patient Plan</h3>
                  </div>
                  <PatientInfoTab userId={patientUserId} profileId={profileId} timeline={timeline} />
                </section>
              </TabsContent>
            </Tabs>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Sticky Documentation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border shadow-lg print:hidden">
        <div className="container mx-auto max-w-3xl px-4 py-2.5 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block">
            <FileText className="w-3 h-3 inline mr-1" />
            Documentation
          </span>
          <div className="flex flex-wrap gap-2 ml-auto">
            <Button size="sm" onClick={handleCopyNote} className="gap-1.5 h-8" disabled={!progressNote}>
              <ClipboardList className="w-3.5 h-3.5" />
              Copy Note
            </Button>
            <Button size="sm" variant="outline" onClick={handleCopyEHR} disabled={isLoading || unavailable} className="gap-1.5 h-8">
              <Copy className="w-3.5 h-3.5" />
              Copy EHR
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5 h-8">
              <Printer className="w-3.5 h-3.5" />
              Print
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
