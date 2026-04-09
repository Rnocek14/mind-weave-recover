/**
 * Patient Hub — Unified 4-tab clinician/caregiver dashboard.
 * Replaces WeeklyPatientReview, consolidates all patient data surfaces.
 * Route: /clinician/review
 */
import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Stethoscope, ClipboardList, Copy, Printer, FileText, Users
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUiMode } from "@/hooks/useUiMode";
import { useWeeklyRecoverySnapshot } from "@/hooks/useWeeklyRecoverySnapshot";
import { useWeeklySessionTimeline } from "@/hooks/useWeeklySessionTimeline";
import { useWeeklySessionStats } from "@/hooks/useWeeklySessionStats";
import { useRecoveryAlerts } from "@/hooks/useRecoveryAlerts";
import { formatEhrSummary } from "@/lib/formatEhrSummary";
import { generateProgressNote } from "@/lib/generateProgressNote";
import { computeEngagementScore } from "@/lib/computeEngagementScore";
import { toast } from "sonner";

import { SessionsTab } from "@/components/patient-hub/SessionsTab";
import { SpeechProfileTab } from "@/components/patient-hub/SpeechProfileTab";
import { PatientInfoTab } from "@/components/patient-hub/PatientInfoTab";
import { IntelligenceTab } from "@/components/patient-hub/IntelligenceTab";
import { ClinicianSummaryHeader } from "@/components/patient-hub/ClinicianSummaryHeader";
import { ProfileCompletenessBanner } from "@/components/patient-hub/ProfileCompletenessBanner";

type WindowSize = 7 | 14 | 30;

export default function PatientHub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const { isAtLeast } = useUiMode();
  const profileId = activeProfile?.id;

  const [windowSize, setWindowSize] = useState<WindowSize>(7);
  const [activeTab, setActiveTab] = useState("sessions");

  // Summary data for header bar
  const { timeline, flags, lastActiveDate, isLoading: snapshotLoading } = useWeeklyRecoverySnapshot(profileId, windowSize);
  const { summary, isLoading: timelineLoading } = useWeeklySessionTimeline(profileId, windowSize);
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
  const { alerts, unacknowledgedCount } = useRecoveryAlerts(profileId, timeline, alertSessionStats);

  const isLoading = snapshotLoading || timelineLoading || sessionStats.isLoading;

  const recent7 = timeline.slice(-7);
  const activeDays = recent7.filter((d) => d.hasAnySignal).length;
  const avgFatigue = useMemo(() => {
    const rated = recent7.filter((d) => d.fatigueRating !== null);
    return rated.length > 0
      ? (rated.reduce((s, d) => s + d.fatigueRating!, 0) / rated.length).toFixed(1)
      : null;
  }, [recent7]);

  const accuracyDelta = useMemo(() => {
    if (sessionStats.avgAccuracy === null || sessionStats.priorAvgAccuracy === null) return null;
    return Math.round(sessionStats.avgAccuracy - sessionStats.priorAvgAccuracy);
  }, [sessionStats]);

  const engagement = useMemo(
    () => (timeline.length > 0 ? computeEngagementScore(timeline) : null),
    [timeline]
  );

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
    toast.success("EHR summary copied to clipboard");
  }, [timeline, flags, alerts, lastActiveDate, engagement]);

  const handleCopyNote = useCallback(() => {
    if (!progressNote) return;
    navigator.clipboard.writeText(progressNote.narrative);
    toast.success("Progress note copied to clipboard");
  }, [progressNote]);

  // Guard temporarily disabled for dev/testing
  // TODO: Re-enable before production: if (!isAtLeast("caregiver")) { ... }

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 pb-24 space-y-4 print:py-0">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/clinician/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              Patient Hub
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeProfile?.profile_name || "Patient"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => navigate('/admin/cohort-research')}>
            <Users className="w-3.5 h-3.5" />
            Cohort
          </Button>
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

      {/* Clinician Summary Header — 10-second understanding */}
      <ClinicianSummaryHeader
        userId={user?.id || ""}
        profileId={profileId}
        timeline={timeline}
        flags={flags || []}
        alerts={alerts}
        avgAccuracy={sessionStats.avgAccuracy}
        priorAvgAccuracy={sessionStats.priorAvgAccuracy}
        accuracySlope={sessionStats.accuracySlope}
        activeDays={activeDays}
        unacknowledgedCount={unacknowledgedCount}
      />

      {/* 4-Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="speech">Speech Profile</TabsTrigger>
          <TabsTrigger value="patient">Patient Info</TabsTrigger>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <SessionsTab userId={user?.id || ""} profileId={profileId} windowSize={windowSize} timeline={timeline} />
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

      {/* Sticky Documentation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border shadow-lg print:hidden">
        <div className="container mx-auto max-w-5xl px-4 py-2.5 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block">
            <FileText className="w-3 h-3 inline mr-1" />
            Documentation
          </span>
          <div className="flex flex-wrap gap-2 ml-auto">
            <Button size="sm" onClick={handleCopyNote} className="gap-1.5 h-8" disabled={!progressNote}>
              <ClipboardList className="w-3.5 h-3.5" />
              Copy Progress Note
            </Button>
            <Button size="sm" variant="outline" onClick={handleCopyEHR} className="gap-1.5 h-8">
              <Copy className="w-3.5 h-3.5" />
              Copy EHR Summary
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
