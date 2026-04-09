/**
 * Intelligence Tab — Clinical interpretation, predictions, strategy, next actions,
 * longitudinal utterance comparison, dose compliance.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Pill, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { usePatientIntelligence } from "@/hooks/usePatientIntelligence";
import { useWeeklyRecoverySnapshot } from "@/hooks/useWeeklyRecoverySnapshot";
import { useWeeklySessionTimeline } from "@/hooks/useWeeklySessionTimeline";
import { useWeeklySessionStats } from "@/hooks/useWeeklySessionStats";
import { useRecoveryAlerts } from "@/hooks/useRecoveryAlerts";
import { useWeekOverWeek } from "@/hooks/useWeekOverWeek";
import { useClinicianOverrides } from "@/hooks/useClinicianOverrides";
import { useDoseTargets } from "@/hooks/useDoseTargets";
import { ClinicalInterpretation } from "@/components/clinician/ClinicalInterpretation";
import { ActionableNextSteps } from "@/components/clinician/ActionableNextSteps";
import { TherapyIntelligenceReport } from "@/components/clinician/TherapyIntelligenceReport";
import { OutcomePredictionCard } from "@/components/clinician/OutcomePredictionCard";
import { WeekComparisonRow } from "@/components/clinician/WeekComparisonRow";
import { ClinicianStrategyControls } from "@/components/clinician/ClinicianStrategyControls";
import { PendingSuggestions } from "@/components/clinician/PendingSuggestions";
import { LongitudinalUtteranceComparison } from "@/components/clinician/LongitudinalUtteranceComparison";
import { selectTherapyStrategy } from "@/lib/therapyStrategyEngine";
import { generateNextActions } from "@/lib/generateNextActions";

interface IntelligenceTabProps {
  userId: string;
  profileId: string | undefined;
  windowSize: number;
}

export function IntelligenceTab({ userId, profileId, windowSize }: IntelligenceTabProps) {
  const { user } = useAuth();
  const { activeProfile } = useProfile();

  const { timeline, flags, isLoading: snapshotLoading } = useWeeklyRecoverySnapshot(profileId, windowSize);
  const { dayGroups, summary, recordings, isLoading: timelineLoading } = useWeeklySessionTimeline(profileId, windowSize);
  const sessionStats = useWeeklySessionStats(profileId);
  const { timeline: priorTimeline } = useWeeklyRecoverySnapshot(profileId, windowSize * 2);
  const { dayGroups: allDayGroups, recordings: priorRecordingsAll } = useWeeklySessionTimeline(profileId, windowSize * 2);

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

  const { alerts } = useRecoveryAlerts(profileId, timeline, alertSessionStats);
  const { profile: intelligenceProfile, isLoading: intelligenceLoading } = usePatientIntelligence(userId);
  const { suggestedOverrides, refetch: refetchOverrides } = useClinicianOverrides(profileId);
  const { comparisons: doseComparisons, isLoading: doseLoading } = useDoseTargets(profileId, windowSize);

  const { currentDayGroups, priorDayGroups, currentTimeline, priorTimelineSplit } = useMemo(() => {
    const cutoff = allDayGroups.length - windowSize;
    return {
      currentDayGroups: dayGroups,
      priorDayGroups: allDayGroups.slice(0, Math.max(0, cutoff)),
      currentTimeline: timeline,
      priorTimelineSplit: priorTimeline.slice(0, Math.max(0, priorTimeline.length - windowSize)),
    };
  }, [allDayGroups, dayGroups, timeline, priorTimeline, windowSize]);

  // Split recordings into current and prior for utterance comparison
  const priorRecordings = useMemo(() => {
    const currentIds = new Set(recordings.map((r) => r.attemptId));
    return priorRecordingsAll.filter((r) => !currentIds.has(r.attemptId));
  }, [recordings, priorRecordingsAll]);

  const hasPriorData = priorDayGroups.some((d) => d.sessions.length > 0);
  const { current: currentSummaryWoW, prior: priorSummaryWoW, deltas } = useWeekOverWeek(
    currentDayGroups, priorDayGroups, currentTimeline, priorTimelineSplit
  );

  const recent7 = timeline.slice(-7);
  const activeDays = recent7.filter((d) => d.hasAnySignal).length;

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

  const isLoading = snapshotLoading || timelineLoading || sessionStats.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Clinical Interpretation */}
      <ClinicalInterpretation
        current={currentSummaryWoW}
        prior={priorSummaryWoW}
        hasPriorData={hasPriorData}
        alerts={alerts}
        accuracySlope={sessionStats.accuracySlope}
        profileName={activeProfile?.profile_name || "Patient"}
      />

      {/* Therapy Intelligence */}
      {intelligenceProfile ? (
        <TherapyIntelligenceReport profile={intelligenceProfile} />
      ) : !intelligenceLoading ? (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              Therapy Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No intelligence data yet. Will appear after therapy sessions.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Outcome Prediction */}
      <OutcomePredictionCard userId={userId} profileId={profileId} />

      {/* Dose Compliance */}
      {doseComparisons.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Pill className="w-4 h-4 text-primary" />
              Dose Compliance
              <Badge variant="secondary" className="text-[10px]">{windowSize}d</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="space-y-3">
              {doseComparisons.map((d) => (
                <div key={d.domainSlug} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium capitalize">{d.domainLabel}</span>
                    <div className="flex items-center gap-2">
                      {d.ratio >= 0.8 ? (
                        <CheckCircle2 className="w-3 h-3 text-success" />
                      ) : d.ratio >= 0.5 ? (
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-destructive" />
                      )}
                      <span className="text-muted-foreground">
                        {d.completedPerDay}m / {d.prescribed}m daily
                      </span>
                      <Badge variant={d.ratio >= 0.8 ? "default" : d.ratio >= 0.5 ? "secondary" : "destructive"} className="text-[10px]">
                        {Math.round(d.ratio * 100)}%
                      </Badge>
                    </div>
                  </div>
                  <Progress value={Math.min(d.ratio * 100, 100)} className="h-1.5" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Longitudinal Utterance Comparison */}
      {recordings.length > 0 && priorRecordings.length > 0 && (
        <LongitudinalUtteranceComparison
          currentRecordings={recordings}
          priorRecordings={priorRecordings}
          windowSize={windowSize}
        />
      )}

      {/* Week-over-Week */}
      <WeekComparisonRow
        deltas={deltas}
        windowSize={windowSize}
        hasPriorData={hasPriorData}
      />

      {/* Strategy Controls */}
      {user?.id && profileId && (
        <ClinicianStrategyControls
          profileId={profileId}
          userId={userId}
          clinicianId={user.id}
          currentStrategy={(() => {
            const { strategy } = selectTherapyStrategy({ patientProfile: intelligenceProfile ?? null, todayFocus: null, sessionSnapshot: null });
            return strategy;
          })()}
          onOverrideApplied={refetchOverrides}
        />
      )}

      {/* Pending Suggestions */}
      <PendingSuggestions
        suggestions={suggestedOverrides}
        userId={userId}
        profileId={profileId || ""}
        clinicianId={user?.id || ""}
        onActionComplete={refetchOverrides}
      />

      {/* Next Actions */}
      <ActionableNextSteps
        actions={nextActions}
        profileName={activeProfile?.profile_name || "Patient"}
        userId={userId}
        profileId={profileId}
        clinicianId={user?.id}
        onActionComplete={refetchOverrides}
      />
    </div>
  );
}
