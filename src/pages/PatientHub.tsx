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
import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useProfile } from "@/hooks/useProfile";
import { useWeeklyRecoverySnapshot } from "@/hooks/useWeeklyRecoverySnapshot";
import { useWeeklySessionTimeline } from "@/hooks/useWeeklySessionTimeline";
import { useWeeklySessionStats } from "@/hooks/useWeeklySessionStats";
import { useRecoveryAlerts } from "@/hooks/useRecoveryAlerts";
import { calculateStreak } from "@/hooks/useStreakCalculation";
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
  const { user } = useAuth();
  const { isAdmin } = useUserPermissions(user?.id);
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id;

  const [windowSize, setWindowSize] = useState<WindowSize>(7);
  // Tab values: "overview" (sessions + intel), "review" (session review + speech), "plan" (patient info)
  const [activeTab, setActiveTab] = useState("overview");
  const [streak, setStreak] = useState(0);

  const { timeline, flags, lastActiveDate, isLoading: snapshotLoading } =
    useWeeklyRecoverySnapshot(profileId, windowSize);
  const { isLoading: timelineLoading } = useWeeklySessionTimeline(profileId, windowSize);
  const sessionStats = useWeeklySessionStats(profileId);

  const alertSessionStats = useMemo(() => {
    if (sessionStats.isLoading) return undefined;
    return {
      recentAvgAccuracy: sessionStats.avgAccuracy,
      priorAvgAccuracy: sessionStats.priorAvgAccuracy,
      accuracySlope: sessionStats.accuracySlope,
      recentTrialCount: sessionStats.trialCount,
      recentSessionCount: sessionStats.sessionCount,
      priorTrialCount: sessionStats.trialCount,
    };
  }, [sessionStats]);
  const { alerts, unacknowledgedCount } = useRecoveryAlerts(
    profileId,
    timeline,
    alertSessionStats,
  );

  const isLoading = snapshotLoading || timelineLoading || sessionStats.isLoading;

  useEffect(() => {
    if (user?.id) calculateStreak(user.id).then(setStreak);
  }, [user?.id]);

  // Engagement + flag breakdown for the cards
  const recent7 = timeline.slice(-7);
  const activeDays = recent7.filter((d) => d.hasAnySignal).length;
  const redFlagCount = (flags || []).filter((f: any) => f.severity === "red").length;
  const orangeFlagCount = (flags || []).filter((f: any) => f.severity === "orange").length;
  const engagement = useMemo(
    () => (timeline.length > 0 ? computeEngagementScore(timeline) : null),
    [timeline]
  );

  const lastActiveLabel = useMemo(() => {
    if (!lastActiveDate) return null;
    const d = new Date(lastActiveDate);
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.round((today.getTime() - d.setHours(0,0,0,0)) / 86_400_000);
    if (diff === 0) return "today";
    if (diff === 1) return "yesterday";
    if (diff < 7) return `${diff}d ago`;
    return new Date(lastActiveDate).toLocaleDateString();
  }, [lastActiveDate]);

  const progressNote = useMemo(() => {
    if (isLoading) return null;
    return generateProgressNote({
      timeline, flags: flags || [], alerts, lastActiveDate, engagement,
      accuracySlope: sessionStats.accuracySlope,
      trialCount: sessionStats.trialCount,
      sessionCount: sessionStats.sessionCount,
      avgAccuracy: sessionStats.avgAccuracy,
      priorAvgAccuracy: sessionStats.priorAvgAccuracy,
      prescribedDays: null,
      profileName: activeProfile?.profile_name || undefined,
    });
  }, [timeline, flags, alerts, lastActiveDate, engagement, sessionStats, isLoading, activeProfile]);

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

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const patientName = activeProfile?.profile_name || "Patient";

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6 pb-24 space-y-4 print:py-0">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/clinician/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold flex items-center gap-2 text-foreground">
              <Stethoscope className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{patientName}</span>
            </h1>
            <p className="text-[11px] text-muted-foreground">Patient Hub</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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

      <ProfileCompletenessBanner
        profile={activeProfile}
        onEditProfile={() => setActiveTab("plan")}
      />

      {/* === The five Glance Cards === */}
      <ClinicianStatusCard
        patientName={patientName}
        redFlagCount={redFlagCount}
        orangeFlagCount={orangeFlagCount}
        unacknowledgedAlerts={unacknowledgedCount}
        accuracySlope={sessionStats.accuracySlope}
        activeDays={activeDays}
        lastActiveDate={lastActiveLabel}
      />

      <ClinicianPracticeCard
        timeline={timeline as any}
        trialCount={sessionStats.trialCount}
        sessionCount={sessionStats.sessionCount}
        streak={streak}
      />

      <ClinicianListenCard userId={user?.id || ""} />

      <ClinicianProgressCard
        userId={user?.id || ""}
        accuracySlope={sessionStats.accuracySlope}
        recentTrials={sessionStats.trialCount}
        priorTrials={sessionStats.trialCount /* prior unavailable from this hook */}
      />

      <ClinicianLevelsCard userId={user?.id || ""} />

      {/* === One drawer: everything deeper === */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full py-3 min-h-[44px] border-t border-border mt-2 print:hidden">
          <span className="font-medium">Clinical Detail</span>
          <ChevronDown className="w-4 h-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <Card className="p-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-5">
                <TabsTrigger value="sessions">Sessions</TabsTrigger>
                <TabsTrigger value="review">Review</TabsTrigger>
                <TabsTrigger value="speech">Speech</TabsTrigger>
                <TabsTrigger value="patient">Patient</TabsTrigger>
                <TabsTrigger value="intelligence">Intel</TabsTrigger>
              </TabsList>

              <TabsContent value="sessions">
                <SessionsTab userId={user?.id || ""} profileId={profileId} windowSize={windowSize} timeline={timeline} />
              </TabsContent>
              <TabsContent value="review">
                <SessionReviewTab profileId={profileId} />
              </TabsContent>
              <TabsContent value="speech">
                <SpeechProfileTab userId={user?.id || ""} profileId={profileId} windowSize={windowSize} />
              </TabsContent>
              <TabsContent value="patient">
                <PatientInfoTab userId={user?.id || ""} profileId={profileId} timeline={timeline} />
              </TabsContent>
              <TabsContent value="intelligence">
                <IntelligenceTab userId={user?.id || ""} profileId={profileId} windowSize={windowSize} />
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
            <Button size="sm" variant="outline" onClick={handleCopyEHR} className="gap-1.5 h-8">
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
