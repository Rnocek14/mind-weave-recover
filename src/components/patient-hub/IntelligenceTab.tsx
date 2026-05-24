/**
 * Intelligence Tab — Restructured into 4 clear sections:
 * 1. What's Happening (summary)
 * 2. What to Do (PRIMARY — actions)
 * 3. Why (explanations, collapsed)
 * 4. Deep Data (collapsed)
 */
import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Brain, Pill, CheckCircle2, AlertTriangle, ArrowRight, Shield,
  TrendingUp, TrendingDown, Minus, Info, Activity, Target,
  ChevronDown
} from "lucide-react";
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
import { useRecoveryScore } from "@/hooks/useRecoveryScore";
import { useCueIndependence } from "@/hooks/useCueIndependence";
import { useLearningRate } from "@/hooks/useLearningRate";
import { useFunctionalGoals } from "@/hooks/useFunctionalGoals";
import { ClinicalInterpretation } from "@/components/clinician/ClinicalInterpretation";
import { ActionableNextSteps } from "@/components/clinician/ActionableNextSteps";
import { TherapyIntelligenceReport } from "@/components/clinician/TherapyIntelligenceReport";
import { AdaptationProfileCard } from "@/components/patient-hub/AdaptationProfileCard";
import { OutcomePredictionCard } from "@/components/clinician/OutcomePredictionCard";
import { WeekComparisonRow } from "@/components/clinician/WeekComparisonRow";
import { ClinicianStrategyControls } from "@/components/clinician/ClinicianStrategyControls";
import { PendingSuggestions } from "@/components/clinician/PendingSuggestions";
import { LongitudinalUtteranceComparison } from "@/components/clinician/LongitudinalUtteranceComparison";
import { selectTherapyStrategy } from "@/lib/therapyStrategyEngine";
import { generateNextActions } from "@/lib/generateNextActions";
import { loadWordHistory, getRetentionDifficultyHint } from "@/lib/smartCoach/crossSessionRetention";
import { cn } from "@/lib/utils";

interface IntelligenceTabProps {
  userId: string;
  profileId: string | undefined;
  windowSize: number;
}

function CollapsibleSection({ title, icon: Icon, defaultOpen = false, children, badge }: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/40 transition-colors">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{title}</span>
            {badge}
          </div>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
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
  const { profile: intelligenceProfile, isLoading: intelligenceLoading } = usePatientIntelligence(userId, profileId);
  const { suggestedOverrides, refetch: refetchOverrides } = useClinicianOverrides(profileId);
  const { comparisons: doseComparisons, isLoading: doseLoading } = useDoseTargets(profileId, windowSize);
  const { score: recoveryScore, breakdown: rsBreakdown, confidence: rsConfidence, loading: rsLoading } = useRecoveryScore(userId, profileId);
  const { currentScore: cueScore, trend: cueTrend, loading: cueLoading } = useCueIndependence(userId);
  const { learningRates, isLoading: lrLoading } = useLearningRate(userId);
  const { goals, loading: goalsLoading } = useFunctionalGoals(userId, profileId);

  // Retention data for readiness signal
  const [retentionRate, setRetentionRate] = useState<number | null>(null);
  useEffect(() => {
    if (!userId) return;
    loadWordHistory(userId, 100).then((history) => {
      const hint = getRetentionDifficultyHint(history);
      const tracked = history.filter(w => w.sessionCount >= 2).length;
      setRetentionRate(tracked > 0 ? Math.round((hint.retainedWords.length / tracked) * 100) : null);
    });
  }, [userId]);

  const { currentDayGroups, priorDayGroups, currentTimeline, priorTimelineSplit } = useMemo(() => {
    const cutoff = allDayGroups.length - windowSize;
    return {
      currentDayGroups: dayGroups,
      priorDayGroups: allDayGroups.slice(0, Math.max(0, cutoff)),
      currentTimeline: timeline,
      priorTimelineSplit: priorTimeline.slice(0, Math.max(0, priorTimeline.length - windowSize)),
    };
  }, [allDayGroups, dayGroups, timeline, priorTimeline, windowSize]);

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

  // Readiness / Discharge Signal
  const readinessSignal = useMemo(() => {
    const signals: { label: string; value: number | null; weight: number }[] = [
      { label: "Recovery Score", value: recoveryScore, weight: 0.3 },
      { label: "Cue Independence", value: cueScore, weight: 0.25 },
      { label: "Retention Rate", value: retentionRate, weight: 0.25 },
      { label: "Accuracy Trend", value: sessionStats.accuracySlope != null ? (sessionStats.accuracySlope > 0.01 ? 80 : sessionStats.accuracySlope > -0.01 ? 60 : 30) : null, weight: 0.2 },
    ];
    const validSignals = signals.filter(s => s.value != null);
    if (validSignals.length < 2) return { level: "insufficient" as const, score: null, signals };
    const weighted = validSignals.reduce((sum, s) => sum + (s.value! * s.weight), 0) / validSignals.reduce((sum, s) => sum + s.weight, 0);
    const level = weighted >= 80 ? "ready" as const : weighted >= 65 ? "stable" as const : weighted >= 45 ? "improving" as const : "plateau" as const;
    return { level, score: Math.round(weighted), signals };
  }, [recoveryScore, cueScore, retentionRate, sessionStats.accuracySlope]);

  // Functional communication links
  const functionalLinks = useMemo(() => {
    const links: { exercise: string; functional: string; signal: string }[] = [];
    const avgAcc = sessionStats.avgAccuracy;
    if (avgAcc != null) {
      if (avgAcc >= 70) {
        links.push({ exercise: "Photo Naming / Category Fluency", functional: "Object identification in daily life", signal: `${Math.round(avgAcc)}% naming accuracy → functional word retrieval improving` });
      }
      if (sessionStats.accuracySlope != null && sessionStats.accuracySlope > 0) {
        links.push({ exercise: "Response speed trend", functional: "Conversational flow & participation", signal: "Faster responses → improved real-time communication" });
      }
    }
    if (cueScore != null && cueScore >= 60) {
      links.push({ exercise: "Cue independence", functional: "Independent communication", signal: `${cueScore}% independence → less support needed in daily interactions` });
    }
    if (retentionRate != null && retentionRate >= 50) {
      links.push({ exercise: "Word retention", functional: "Vocabulary carryover", signal: `${retentionRate}% retention → practiced words transferring to daily use` });
    }
    const activeGoals = goals.filter(g => !g.archived_at);
    activeGoals.forEach(g => {
      links.push({ exercise: `Goal: ${g.target_domain}`, functional: g.goal_text, signal: `Active goal — ${g.baseline_status}` });
    });
    return links;
  }, [sessionStats, cueScore, retentionRate, goals]);

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
      {/* ═══════ SECTION 1: WHAT'S HAPPENING ═══════ */}
      <ClinicalInterpretation
        current={currentSummaryWoW}
        prior={priorSummaryWoW}
        hasPriorData={hasPriorData}
        alerts={alerts}
        accuracySlope={sessionStats.accuracySlope}
        profileName={activeProfile?.profile_name || "Patient"}
      />

      <WeekComparisonRow
        deltas={deltas}
        windowSize={windowSize}
        hasPriorData={hasPriorData}
      />

      {/* ═══════ SECTION 2: WHAT TO DO (PRIMARY) ═══════ */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 px-1">
          <Target className="w-4 h-4 text-primary" />
          What to Do Next
        </h3>

        <ActionableNextSteps
          actions={nextActions}
          profileName={activeProfile?.profile_name || "Patient"}
          userId={userId}
          profileId={profileId}
          clinicianId={user?.id}
          onActionComplete={refetchOverrides}
        />

        <PendingSuggestions
          suggestions={suggestedOverrides}
          userId={userId}
          profileId={profileId || ""}
          clinicianId={user?.id || ""}
          onActionComplete={refetchOverrides}
        />
      </div>

      {/* Adaptation Profile — why the system is adapting per patient */}
      {profileId && <AdaptationProfileCard profileId={profileId} />}


      <Card className="border-border/50">
        <CollapsibleSection title="Why — Clinical Reasoning" icon={Brain} defaultOpen={false}>
          <div className="space-y-3 pb-3">
            {intelligenceProfile ? (
              <TherapyIntelligenceReport profile={intelligenceProfile} />
            ) : !intelligenceLoading ? (
              <p className="text-sm text-muted-foreground px-3">
                No intelligence data yet. Will appear after therapy sessions.
              </p>
            ) : null}

            <OutcomePredictionCard userId={userId} profileId={profileId} />

            {/* Readiness Signal */}
            {readinessSignal.score != null && (
              <Card className={cn("border-l-4 mx-1", readinessSignal.level === "ready" ? "border-l-success" : readinessSignal.level === "stable" ? "border-l-primary" : readinessSignal.level === "improving" ? "border-l-amber-500" : "border-l-destructive")}>
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Readiness Signal
                    <Badge variant={readinessSignal.level === "ready" ? "default" : "secondary"} className="text-xs capitalize">
                      {readinessSignal.level === "ready" ? "Ready for step-down" : readinessSignal.level}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 space-y-2">
                  <div className="space-y-1.5">
                    {readinessSignal.signals.map((s) => (
                      <div key={s.label} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{s.label}</span>
                        <span className="font-medium">{s.value != null ? `${s.value}%` : "—"}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Composite of recovery score, cue independence, retention, and accuracy trend
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Functional Communication Transfer */}
            {functionalLinks.length > 0 && (
              <Card className="mx-1">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    Functional Communication Impact
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 space-y-2">
                  {functionalLinks.map((link, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs p-2 rounded bg-muted/20">
                      <ArrowRight className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                      <div>
                        <div className="font-medium">{link.exercise} → {link.functional}</div>
                        <div className="text-muted-foreground">{link.signal}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </CollapsibleSection>
      </Card>

      {/* ═══════ SECTION 4: DEEP DATA (collapsible, collapsed) ═══════ */}
      <Card className="border-border/30">
        <CollapsibleSection title="Deep Data & Controls" icon={Activity} defaultOpen={false}>
          <div className="space-y-3 pb-3">
            {/* Dose Compliance */}
            {doseComparisons.length > 0 && (
              <Card className="mx-1">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Pill className="w-4 h-4 text-primary" />
                    Dose Compliance
                    <Badge variant="secondary" className="text-xs">{windowSize}d</Badge>
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
                            <Badge variant={d.ratio >= 0.8 ? "default" : d.ratio >= 0.5 ? "secondary" : "destructive"} className="text-xs">
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
              <div className="mx-1">
                <LongitudinalUtteranceComparison
                  currentRecordings={recordings}
                  priorRecordings={priorRecordings}
                  windowSize={windowSize}
                />
              </div>
            )}

            {/* Strategy Controls */}
            {user?.id && profileId && (
              <div className="mx-1">
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
              </div>
            )}

            {/* Data window summary */}
            <Card className="border-border/30 mx-1">
              <CardContent className="py-3 space-y-3 text-xs">
                <div className="space-y-1">
                  <span className="font-medium">Data window: {windowSize} days</span>
                  <div className="text-xs text-muted-foreground">
                    {sessionStats.sessionCount} sessions · {sessionStats.trialCount} trials · {activeDays}/7 active days
                  </div>
                </div>
                {sessionStats.accuracySlope != null && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Accuracy trend:</span>
                    {sessionStats.accuracySlope > 0.01 ? (
                      <span className="text-success flex items-center gap-1"><TrendingUp className="w-3 h-3" /> +{(sessionStats.accuracySlope * 100).toFixed(1)}%/day</span>
                    ) : sessionStats.accuracySlope < -0.01 ? (
                      <span className="text-destructive flex items-center gap-1"><TrendingDown className="w-3 h-3" /> {(sessionStats.accuracySlope * 100).toFixed(1)}%/day</span>
                    ) : (
                      <span className="text-muted-foreground flex items-center gap-1"><Minus className="w-3 h-3" /> Stable</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </CollapsibleSection>
      </Card>
    </div>
  );
}
