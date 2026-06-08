/**
 * Weekly Patient Review — Clinician-first single-screen decision surface.
 * 
 * Layout: 5 visible sections + collapsible rest + sticky documentation.
 * Single narrative layer: ClinicalInterpretation.
 * Route: /clinician/review
 */

import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ArrowLeft, Stethoscope, Calendar, Clock, Target, TrendingUp, TrendingDown,
  Volume2, AlertTriangle, ClipboardList, Copy, Printer, FileText, ChevronDown,
  ChevronRight, Activity, Flame, Lightbulb, Mic, CheckCircle,
  XCircle, Zap, Brain, User
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUiMode } from "@/hooks/useUiMode";
import { useWeeklyRecoverySnapshot } from "@/hooks/useWeeklyRecoverySnapshot";
import { useWeeklySessionTimeline, type DayGroup } from "@/hooks/useWeeklySessionTimeline";
import { useWeeklySessionStats } from "@/hooks/useWeeklySessionStats";
import { useRecoveryAlerts } from "@/hooks/useRecoveryAlerts";
import { useRedFlagDetection } from "@/hooks/useRedFlagDetection";
import { useDailyReadiness } from "@/hooks/useDailyReadiness";
import { useDoseTargets } from "@/hooks/useDoseTargets";
import { useCuratedAudioSamples } from "@/hooks/useCuratedAudioSamples";
import { useWeekOverWeek } from "@/hooks/useWeekOverWeek";
import { formatEhrSummary } from "@/lib/formatEhrSummary";
import { generateProgressNote } from "@/lib/generateProgressNote";
import { computeEngagementScore } from "@/lib/computeEngagementScore";
import { generateNextActions } from "@/lib/generateNextActions";
import { AudioPlaybackWithWaveform } from "@/components/AudioPlaybackWithWaveform";
import { HelpLabel } from "@/components/HelpTooltip";
import { WeekComparisonRow } from "@/components/clinician/WeekComparisonRow";
import { ClinicalRecordingPicks } from "@/components/clinician/ClinicalRecordingPicks";
import { ClinicalInterpretation } from "@/components/clinician/ClinicalInterpretation";
import { ActionableNextSteps } from "@/components/clinician/ActionableNextSteps";
import { LongitudinalUtteranceComparison } from "@/components/clinician/LongitudinalUtteranceComparison";
import { ProfileSummaryCard } from "@/components/clinician/ProfileSummaryCard";
import { WhyThisPlan } from "@/components/clinician/WhyThisPlan";
import { PendingSuggestions } from "@/components/clinician/PendingSuggestions";
import { AccuracySparkline } from "@/components/clinician/AccuracySparkline";
import { SuccessBandIndicator } from "@/components/clinician/SuccessBandIndicator";
import { ExerciseStruggleCard } from "@/components/clinician/ExerciseStruggleCard";
import { GoalTrackingCard } from "@/components/clinician/GoalTrackingCard";
import { OutcomePredictionCard } from "@/components/clinician/OutcomePredictionCard";
import { ProbeTrendCard } from "@/components/probe/ProbeTrendCard";
import { aggregateTrialsByDomain } from "@/lib/exerciseDomainMap";
import { usePatientIntelligence } from "@/hooks/usePatientIntelligence";
import { TherapyIntelligenceReport } from "@/components/clinician/TherapyIntelligenceReport";
import { ClinicianStrategyControls } from "@/components/clinician/ClinicianStrategyControls";
import { selectTherapyStrategy } from "@/lib/therapyStrategyEngine";
import { useClinicianOverrides } from "@/hooks/useClinicianOverrides";
import { useAdaptationTimeline } from "@/hooks/useAdaptationTimeline";
import { reverseOverride } from "@/lib/clinicianQuickActions";
import { toast } from "sonner";

type WindowSize = 7 | 14 | 30;

function deriveSpeechLabel(cp: Record<string, any> | null): string | null {
  if (!cp) return null;
  const speech: string[] = cp?.impairments?.speech || [];
  const n = speech.map((s) => s.toLowerCase().replace(/[^a-z]/g, ""));
  if (n.some((s) => s.includes("broca") || s === "expressive")) return "Expressive aphasia";
  if (n.some((s) => s.includes("wernicke") || s === "receptive")) return "Receptive aphasia";
  if (n.some((s) => s.includes("global"))) return "Global aphasia";
  if (n.some((s) => s.includes("anomic"))) return "Anomic aphasia";
  if (speech.length > 0) return speech[0].replace(/_/g, " ");
  return null;
}

function formatSlug(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function WeeklyPatientReview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const { isAtLeast } = useUiMode();
  const profileId = activeProfile?.id;

  const [windowSize, setWindowSize] = useState<WindowSize>(7);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // Data hooks
  const { timeline, flags, lastActiveDate, isLoading: snapshotLoading } = useWeeklyRecoverySnapshot(profileId, windowSize);
  const { dayGroups, recordings, exerciseSlugs, summary, isLoading: timelineLoading } = useWeeklySessionTimeline(profileId, windowSize);
  const sessionStats = useWeeklySessionStats(profileId);
  const { timeline: priorTimeline, isLoading: priorSnapshotLoading } = useWeeklyRecoverySnapshot(profileId, windowSize * 2);
  const { dayGroups: allDayGroups, recordings: allRecordings, isLoading: priorTimelineLoading } = useWeeklySessionTimeline(profileId, windowSize * 2);

  const { currentDayGroups, priorDayGroups, currentTimeline, priorTimelineSplit } = useMemo(() => {
    const cutoff = allDayGroups.length - windowSize;
    return {
      currentDayGroups: dayGroups,
      priorDayGroups: allDayGroups.slice(0, Math.max(0, cutoff)),
      currentTimeline: timeline,
      priorTimelineSplit: priorTimeline.slice(0, Math.max(0, priorTimeline.length - windowSize)),
    };
  }, [allDayGroups, dayGroups, timeline, priorTimeline, windowSize]);

  const { priorRecordings } = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - windowSize);
    const cutoffStr = cutoffDate.toISOString();
    return { priorRecordings: allRecordings.filter((r) => r.createdAt < cutoffStr) };
  }, [allRecordings, windowSize]);

  const { current: currentSummaryWoW, prior: priorSummaryWoW, deltas } = useWeekOverWeek(
    currentDayGroups, priorDayGroups, currentTimeline, priorTimelineSplit
  );
  const hasPriorData = priorDayGroups.some((d) => d.sessions.length > 0);

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
  const { alerts, unacknowledgedCount, acknowledgeAlert, resolveAlert } = useRecoveryAlerts(profileId, timeline, alertSessionStats);
  const { flags: redFlags } = useRedFlagDetection(user?.id || null, {}, profileId);
  const { todayCheckin } = useDailyReadiness(profileId);
  const { comparisons: doseComparisons, isLoading: doseLoading } = useDoseTargets(profileId, windowSize);
  const { samples: audioSamples, loading: audioLoading } = useCuratedAudioSamples(user?.id, windowSize, profileId);
  const { activeOverrides, suggestedOverrides, recentOverrides, isLoading: overridesLoading, refetch: refetchOverrides } = useClinicianOverrides(profileId);
  const { events: adaptationEvents } = useAdaptationTimeline(user?.id, windowSize, 100, profileId);

  const { profile: intelligenceProfile, isLoading: intelligenceLoading } = usePatientIntelligence(user?.id, profileId);

  const isLoading = snapshotLoading || timelineLoading || sessionStats.isLoading;

  const clinicalProfile = activeProfile?.clinical_profile as Record<string, any> | null;
  const runtimeConfig = (activeProfile as any)?.runtime_config as Record<string, any> | null;
  const speechLabel = deriveSpeechLabel(clinicalProfile);
  const strokeDate = activeProfile?.stroke_date ?? null;
  const daysPostOnset = strokeDate
    ? Math.floor((Date.now() - new Date(strokeDate).getTime()) / 86_400_000)
    : null;

  const engagement = useMemo(
    () => (timeline.length > 0 ? computeEngagementScore(timeline) : null),
    [timeline]
  );

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

  const nextActions = useMemo(
    () =>
      generateNextActions({
        timeline, flags, alerts,
        avgAccuracy: sessionStats.avgAccuracy,
        priorAvgAccuracy: sessionStats.priorAvgAccuracy,
        activeDays,
        accuracySlope: sessionStats.accuracySlope,
      }),
    [timeline, flags, alerts, sessionStats, activeDays]
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

  const trialsByDomain = useMemo(() => {
    const allExercises: { slug: string; trials: number }[] = [];
    dayGroups.forEach((d) => {
      d.sessions.forEach((s) => {
        s.exercises.forEach((e) => {
          allExercises.push({ slug: e.slug, trials: e.trials });
        });
      });
    });
    return aggregateTrialsByDomain(allExercises);
  }, [dayGroups]);

  // Handlers
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

  // Guard
  if (!isAtLeast("clinician")) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Stethoscope className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Clinician Access Required</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Switch to Clinician or Admin mode to access this page.
            </p>
            <Button variant="outline" onClick={() => navigate("/clinician/caseload")}>
              Return to Caseload
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 pb-24 space-y-4 print:py-0">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Go back" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              Weekly Review
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeProfile?.profile_name || "Patient"}
            </p>
          </div>
        </div>
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

      {/* ═══════════════════════════════════════════════════
          VISIBLE SECTIONS (always open)
          ═══════════════════════════════════════════════════ */}

      {/* ─── 1. SUMMARY BAR ─── */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Active:</span>
              <span className={`font-semibold ${activeDays >= 5 ? "text-green-600 dark:text-green-400" : activeDays >= 3 ? "text-amber-600 dark:text-amber-400" : "text-red-500"}`}>
                {activeDays}/7d
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Sessions:</span>
              <span className="font-semibold">{summary.totalSessions}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Accuracy:</span>
              <span className="font-semibold">{summary.avgAccuracy !== null ? `${summary.avgAccuracy}%` : "—"}</span>
              {accuracyDelta !== null && (
                <span className={`text-xs ${accuracyDelta > 0 ? "text-green-600" : accuracyDelta < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                  {accuracyDelta > 0 ? "+" : ""}{accuracyDelta}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Practice:</span>
              <span className="font-semibold">{summary.totalMinutes}min</span>
              <span className="text-xs text-muted-foreground">({summary.totalTrials} trials)</span>
            </div>
            {avgFatigue && (
              <div className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Fatigue:</span>
                <span className={`font-semibold ${Number(avgFatigue) >= 4 ? "text-red-500" : ""}`}>{avgFatigue}/5</span>
              </div>
            )}
            {unacknowledgedCount > 0 && (
              <Badge variant="destructive" className="gap-1 ml-auto">
                <AlertTriangle className="w-3 h-3" />
                {unacknowledgedCount} alert{unacknowledgedCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Accuracy Sparkline (visual confirmation of trajectory) ─── */}
      {(() => {
        const sparkData = dayGroups.map((dg) => {
          const totalTrials = dg.sessions.reduce((s, ses) => s + ses.totalTrials, 0);
          const weightedAcc = dg.sessions.reduce((s, ses) => s + ses.avgAccuracy * ses.totalTrials, 0);
          const daySnap = recent7.find((d) => d.date === dg.date);
          return {
            date: dg.date,
            accuracy: totalTrials > 0 ? Math.round(weightedAcc / totalTrials) : null,
            fatigueRating: daySnap?.fatigueRating ?? null,
            trials: totalTrials,
          };
        });
        return sparkData.filter((d) => d.accuracy !== null).length >= 2 ? (
          <Card className="border-border/50">
            <CardContent className="py-2 px-4">
              <AccuracySparkline timeline={sparkData} />
            </CardContent>
          </Card>
        ) : null;
      })()}

      {/* ─── SUCCESS BAND + STRUGGLES + GOALS + PREDICTIONS ─── */}
      <div className="grid md:grid-cols-2 gap-3">
        <SuccessBandIndicator dayData={dayGroups.map((dg) => ({
          accuracy: dg.avgAccuracy,
          trials: dg.totalTrials,
        }))} />
        <ExerciseStruggleCard dayGroups={dayGroups} />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <GoalTrackingCard userId={user?.id || ""} profileId={profileId} />
        <OutcomePredictionCard userId={user?.id || ""} profileId={profileId} />
      </div>

      {/* ─── 2. CLINICAL INTERPRETATION (THE narrative) ─── */}
      <ClinicalInterpretation
        current={currentSummaryWoW}
        prior={priorSummaryWoW}
        hasPriorData={hasPriorData}
        alerts={alerts}
        accuracySlope={sessionStats.accuracySlope}
        profileName={activeProfile?.profile_name || "Patient"}
      />

      {/* ─── THERAPY INTELLIGENCE REPORT ─── */}
      {intelligenceProfile ? (
        <TherapyIntelligenceReport profile={intelligenceProfile} />
      ) : (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              Therapy Intelligence Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {intelligenceLoading ? "Loading intelligence data…" : "No session intelligence data yet. The report will appear after the patient completes conversational therapy sessions with Maya."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── CLINICIAN STRATEGY CONTROLS ─── */}
      {user?.id && profileId && (
        <ClinicianStrategyControls
          profileId={profileId}
          userId={user?.id || ""}
          clinicianId={user?.id || ""}
          currentStrategy={(() => {
            const { strategy } = selectTherapyStrategy({ patientProfile: intelligenceProfile ?? null, todayFocus: null, sessionSnapshot: null });
            return strategy;
          })()}
          onOverrideApplied={refetchOverrides}
        />
      )}

      {/* ─── 3. PENDING SUGGESTIONS (decision gate) ─── */}
      <PendingSuggestions
        suggestions={suggestedOverrides}
        userId={user?.id || ""}
        profileId={profileId || ""}
        clinicianId={user?.id || ""}
        onActionComplete={refetchOverrides}
      />

      {/* ─── 4. WEEK-OVER-WEEK DELTAS ─── */}
      <WeekComparisonRow
        deltas={deltas}
        windowSize={windowSize}
        hasPriorData={hasPriorData}
      />

      {/* ─── 5. NEXT ACTIONS (primary CTA area) ─── */}
      <ActionableNextSteps
        actions={nextActions}
        profileName={activeProfile?.profile_name || "Patient"}
        userId={user?.id}
        profileId={profileId}
        clinicianId={user?.id}
        onActionComplete={refetchOverrides}
      />

      {/* ═══════════════════════════════════════════════════
          COLLAPSIBLE SECTIONS (all default closed)
          ═══════════════════════════════════════════════════ */}

      {/* ─── 🎧 Recordings ─── */}
      <CollapsibleSection
        icon={<Mic className="h-4 w-4 text-primary" />}
        title="Recordings"
        badge={recordings.length > 0 ? String(recordings.length) : undefined}
      >
        <ClinicalRecordingPicks
          curatedChallenging={audioSamples.challenging.slice(0, 1)}
          curatedBest={audioSamples.best.slice(0, 1)}
          allRecordings={recordings}
        />
        {recordings.length > 2 && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-2 mt-2">
              <ChevronDown className="w-3 h-3" />
              View all {recordings.length} recordings
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1.5 mt-2">
              {recordings.slice(0, 30).map((r) => (
                <div key={r.attemptId} className="flex items-center gap-3 p-2 rounded bg-muted/30 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize truncate">{r.targetWord || formatSlug(r.exerciseSlug)}</span>
                      {r.isCorrect === true && <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />}
                      {r.isCorrect === false && <XCircle className="w-3 h-3 text-red-500 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatSlug(r.exerciseSlug)} · {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      {r.errorType && ` · ${r.errorType.replace(/_/g, " ")}`}
                    </div>
                  </div>
                  <AudioPlaybackWithWaveform storagePath={r.audioPath} showWaveform={false} />
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CollapsibleSection>

      {/* ─── 🚨 Alerts ─── */}
      {(unacknowledgedCount > 0 || redFlags.length > 0) && (
        <CollapsibleSection
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          title="Active Alerts"
          badge={String(unacknowledgedCount + redFlags.length)}
          badgeVariant="destructive"
        >
          <div className="space-y-3">
            {alerts
              .filter((a) => !a.resolved_at)
              .map((alert) => (
                <div key={alert.id} className="flex items-start gap-2 text-sm border rounded-lg p-3 bg-card">
                  <Badge
                    variant={alert.severity === "critical" ? "destructive" : "secondary"}
                    className="text-[10px] shrink-0 mt-0.5"
                  >
                    {alert.severity}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{alert.title}</p>
                    {alert.description && <p className="text-xs text-muted-foreground">{alert.description}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      {!alert.acknowledged_at ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            acknowledgeAlert(alert.id);
                            toast.success("Alert acknowledged");
                          }}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" /> Acknowledge
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Acknowledged
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => {
                          const notes = prompt("Resolution notes (optional):");
                          resolveAlert(alert.id, notes || undefined);
                          toast.success("Alert resolved");
                        }}
                      >
                        <XCircle className="h-3 w-3 mr-1" /> Resolve
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            {redFlags.map((f) => (
              <div key={f.type + f.message} className="flex items-start gap-2 text-sm border rounded-lg p-3 bg-card">
                <Badge variant="outline" className={`text-[10px] shrink-0 mt-0.5 ${f.severity === "red" ? "border-destructive text-destructive" : "border-amber-400 text-amber-600"}`}>
                  {f.severity}
                </Badge>
                <p>{f.message}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* ─── 🧠 Patient & Plan (merged section) ─── */}
      <CollapsibleSection
        icon={<Brain className="h-4 w-4 text-primary" />}
        title="Patient & Plan"
      >
        <div className="space-y-4">
          <ProfileSummaryCard
            clinicalProfile={clinicalProfile}
            strokeDate={strokeDate}
            daysPostOnset={daysPostOnset}
            profileName={activeProfile?.profile_name || "Patient"}
            speechLabel={speechLabel}
          />
          <WhyThisPlan
            clinicalProfile={clinicalProfile}
            runtimeConfig={runtimeConfig}
            activeExerciseSlugs={exerciseSlugs}
            adaptationEvents={adaptationEvents}
            activeOverrides={activeOverrides}
            recentOverrides={recentOverrides}
            onReverseOverride={async (overrideId) => {
              if (!user?.id || !profileId) return;
              const target = activeOverrides.find((o) => o.id === overrideId);
              const restoreDesc = target
                ? target.overrideType === "difficulty"
                  ? `Restore difficulty to level ${target.valueBefore?.difficulty_level ?? "default"}`
                  : target.overrideType === "dose_reduction"
                  ? `Restore dose to ${target.valueBefore?.target_value ?? "previous"}min`
                  : target.overrideType === "cue_level"
                  ? `Restore cue level to ${target.valueBefore?.cue_level ?? "Auto"}`
                  : `Reverse ${target.overrideType}`
                : "Reverse this override";
              if (!confirm(`${restoreDesc}?\n\nThis will undo the clinician override and restore the previous state.`)) return;
              const result = await reverseOverride(
                { userId: user.id, profileId, clinicianId: user.id },
                overrideId,
                "Reversed via weekly review"
              );
              if (result.success) {
                toast.success(result.message);
                refetchOverrides();
              } else {
                toast.error(result.message);
              }
            }}
          />
        </div>
      </CollapsibleSection>

      {/* ─── 📊 Session Timeline ─── */}
      <CollapsibleSection
        icon={<Calendar className="h-4 w-4 text-primary" />}
        title="Session Timeline"
        summary={`${summary.totalSessions} sessions across ${activeDays} days`}
      >
        <div className="space-y-1">
          {dayGroups.map((day) => (
            <DayRow
              key={day.date}
              day={day}
              isExpanded={expandedDay === day.date}
              onToggle={() => setExpandedDay(expandedDay === day.date ? null : day.date)}
            />
          ))}
        </div>
      </CollapsibleSection>

      {/* ─── 🔬 Deep Dive ─── */}
      <CollapsibleSection
        icon={<TrendingUp className="h-4 w-4 text-primary" />}
        title="Deep Dive"
      >
        <div className="space-y-4">
          <LongitudinalUtteranceComparison
            currentRecordings={recordings}
            priorRecordings={priorRecordings}
            windowSize={windowSize}
          />
          {doseComparisons.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm font-semibold">
                  <HelpLabel term="Dose Compliance">Prescribed vs. Completed</HelpLabel>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {doseComparisons.map((d) => {
                    const domainTrials = trialsByDomain[d.domainSlug] || 0;
                    const trialsPerDay = windowSize > 0 ? Math.round(domainTrials / windowSize) : 0;
                    return (
                      <div key={d.domainSlug} className="space-y-1.5 p-2.5 rounded-lg bg-muted/20">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium capitalize">{d.domainLabel}</span>
                          <span className={`font-semibold ${d.ratio >= 0.8 ? "text-green-600" : d.ratio >= 0.5 ? "text-amber-600" : "text-red-500"}`}>
                            {Math.round(d.ratio * 100)}%
                          </span>
                        </div>
                        <Progress value={Math.min(d.ratio * 100, 100)} className={`h-2 ${d.ratio >= 0.8 ? "[&>div]:bg-green-500" : d.ratio >= 0.5 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500"}`} />
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{d.completed}min / {d.prescribed * d.daysInWindow}min target</span>
                          <span>{d.completedPerDay}min/day avg</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] pt-0.5 border-t border-border/50">
                          <span className="text-muted-foreground">
                            <span className="font-medium text-foreground">{domainTrials}</span> trials
                          </span>
                          <span className="text-muted-foreground">
                            <span className="font-medium text-foreground">{trialsPerDay}</span> trials/day
                          </span>
                          {domainTrials > 0 && d.completed > 0 && (
                            <span className="text-muted-foreground">
                              <span className="font-medium text-foreground">
                                {(domainTrials / d.completed).toFixed(1)}
                              </span> trials/min
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════════
          STICKY DOCUMENTATION BAR
          ═══════════════════════════════════════════════════ */}
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
            <Button size="sm" variant="outline" onClick={() => navigate("/clinician/report?print=1")} className="gap-1.5 h-8">
              <Printer className="w-3.5 h-3.5" />
              Export PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Collapsible Section Wrapper ─── */
function CollapsibleSection({
  icon,
  title,
  badge,
  badgeVariant = "secondary",
  summary: summaryText,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  summary?: string;
  children: React.ReactNode;
}) {
  return (
    <Collapsible>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="pb-3 pt-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                {icon}
                {title}
                {badge && (
                  <Badge variant={badgeVariant} className="text-[10px]">
                    {badge}
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {summaryText && (
                  <span className="text-xs text-muted-foreground">{summaryText}</span>
                )}
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pb-3 pt-0">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/* ─── Day Row Component ─── */
function DayRow({
  day,
  isExpanded,
  onToggle,
}: {
  day: DayGroup;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasData = day.sessions.length > 0;

  return (
    <div className={`rounded-lg ${day.isToday ? "ring-1 ring-primary/30" : ""} ${!hasData ? "opacity-50" : ""}`}>
      <button
        onClick={hasData ? onToggle : undefined}
        disabled={!hasData}
        className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${hasData ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
      >
        <div className="w-28 shrink-0">
          <span className="font-medium text-xs">{day.dayLabel}</span>
          {day.isToday && <Badge variant="outline" className="ml-1.5 text-[9px] h-4">Today</Badge>}
        </div>
        {hasData ? (
          <>
            <div className="flex items-center gap-4 flex-1 text-xs text-muted-foreground">
              <span>{day.sessions.length} session{day.sessions.length > 1 ? "s" : ""}</span>
              <span>{day.totalTrials} trials</span>
              <span>{day.totalMinutes}min</span>
              {day.avgAccuracy !== null && (
                <span className={`font-medium ${day.avgAccuracy >= 70 ? "text-green-600 dark:text-green-400" : day.avgAccuracy >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-500"}`}>
                  {day.avgAccuracy}%
                </span>
              )}
            </div>
            <div className="hidden md:flex items-center gap-1 shrink-0">
              {day.sessions
                .flatMap((s) => s.exercises)
                .slice(0, 3)
                .map((ex, i) => (
                  <Badge key={i} variant="secondary" className="text-[9px] h-5">
                    {formatSlug(ex.slug).slice(0, 15)}
                    {ex.hasAudio && <Mic className="w-2.5 h-2.5 ml-0.5" />}
                  </Badge>
                ))}
            </div>
            <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
          </>
        ) : (
          <span className="text-xs text-muted-foreground italic">No session</span>
        )}
      </button>
      {isExpanded && hasData && (
        <div className="px-3 pb-2 space-y-1.5 ml-28">
          {day.sessions.map((session) => (
            <div key={session.id} className="rounded bg-muted/30 px-3 py-2 text-xs space-y-1">
              <div className="flex items-center gap-3 text-muted-foreground">
                <span>{new Date(session.startedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                <span>{session.durationMin}min</span>
                <span>{session.totalTrials} trials</span>
                <span className={`font-medium ${session.avgAccuracy >= 70 ? "text-green-600" : session.avgAccuracy >= 40 ? "text-amber-600" : "text-red-500"}`}>
                  {session.avgAccuracy}%
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {session.exercises.map((ex) => (
                  <div key={ex.slug} className="flex items-center gap-1 bg-background px-2 py-0.5 rounded text-[11px]">
                    <span className="font-medium">{formatSlug(ex.slug)}</span>
                    <span className="text-muted-foreground">({ex.trials}t, {ex.accuracy}%)</span>
                    {ex.hasAudio && <Mic className="w-2.5 h-2.5 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
