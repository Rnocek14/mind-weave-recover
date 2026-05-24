/**
 * ClinicianSummaryHeader — 10-second patient understanding layer.
 * Sits above tabs in PatientHub. Derived entirely from existing data.
 */
import { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, ArrowRight,
  Activity, Target, Shield, Zap, Brain
} from "lucide-react";
import { useRecoveryScore } from "@/hooks/useRecoveryScore";
import { useCueIndependence } from "@/hooks/useCueIndependence";
import { loadWordHistory, getRetentionDifficultyHint } from "@/lib/smartCoach/crossSessionRetention";
import { cn } from "@/lib/utils";
import type { SnapshotDay, RecoveryFlag } from "@/hooks/useWeeklyRecoverySnapshot";
import type { RecoveryAlert } from "@/hooks/useRecoveryAlerts";

interface ClinicianSummaryHeaderProps {
  userId: string;
  profileId: string | undefined;
  timeline: SnapshotDay[];
  flags: RecoveryFlag[];
  alerts: RecoveryAlert[];
  avgAccuracy: number | null;
  priorAvgAccuracy: number | null;
  accuracySlope: number | null;
  activeDays: number;
  unacknowledgedCount: number;
}

type PatientStatus = "improving" | "stable" | "plateau" | "declining" | "insufficient";

interface PrimaryIssue {
  label: string;
  detail: string;
  action: string;
}

const STATUS_CONFIG: Record<PatientStatus, { icon: typeof TrendingUp; label: string; className: string }> = {
  improving: { icon: TrendingUp, label: "Improving", className: "text-green-600 dark:text-green-400" },
  stable: { icon: Minus, label: "Stable", className: "text-blue-600 dark:text-blue-400" },
  plateau: { icon: Minus, label: "Plateau", className: "text-amber-600 dark:text-amber-400" },
  declining: { icon: TrendingDown, label: "Declining", className: "text-red-600 dark:text-red-400" },
  insufficient: { icon: Activity, label: "Insufficient Data", className: "text-muted-foreground" },
};

export function ClinicianSummaryHeader({
  userId, profileId, timeline, flags, alerts,
  avgAccuracy, priorAvgAccuracy, accuracySlope, activeDays, unacknowledgedCount,
}: ClinicianSummaryHeaderProps) {

  const { score: recoveryScore, loading: rsLoading } = useRecoveryScore(userId, profileId);
  const { currentScore: cueScore, trend: cueTrend, loading: cueLoading } = useCueIndependence(userId, { profileId });

  const [retentionRate, setRetentionRate] = useState<number | null>(null);
  useEffect(() => {
    if (!userId) return;
    loadWordHistory(userId, 100).then((history) => {
      const hint = getRetentionDifficultyHint(history);
      const tracked = history.filter(w => w.sessionCount >= 2).length;
      setRetentionRate(tracked > 0 ? Math.round((hint.retainedWords.length / tracked) * 100) : null);
    });
  }, [userId]);

  // --- Derive patient status ---
  const status: PatientStatus = useMemo(() => {
    const hasRedFlags = flags.some(f => f.type === "fatigue_spike" || f.type === "no_signal");
    const criticalAlerts = alerts.filter(a => a.severity === "critical" && !a.acknowledged_at);
    const accDeclining = avgAccuracy != null && priorAvgAccuracy != null && avgAccuracy < priorAvgAccuracy - 8;
    const accImproving = avgAccuracy != null && priorAvgAccuracy != null && avgAccuracy > priorAvgAccuracy + 3;
    const slopeUp = accuracySlope != null && accuracySlope > 0.3;
    const slopeDown = accuracySlope != null && accuracySlope < -0.3;
    const goodRetention = retentionRate != null && retentionRate >= 60;
    const lowRetention = retentionRate != null && retentionRate < 40;
    const goodCue = cueScore != null && cueScore >= 0.6;

    if (activeDays === 0 && timeline.length < 3) return "insufficient";
    if ((criticalAlerts.length > 0 || accDeclining || slopeDown) && !accImproving) return "declining";
    if (hasRedFlags && !accImproving && !slopeUp) return "plateau";
    if ((accImproving || slopeUp) && (goodRetention || goodCue)) return "improving";
    if (accImproving || slopeUp) return "improving";
    if (lowRetention && activeDays <= 2) return "plateau";
    return "stable";
  }, [flags, alerts, avgAccuracy, priorAvgAccuracy, accuracySlope, retentionRate, cueScore, activeDays, timeline]);

  // --- Status reason ---
  const statusReason = useMemo(() => {
    const parts: string[] = [];
    if (retentionRate != null) {
      if (retentionRate >= 60) parts.push("strong retention");
      else if (retentionRate < 40) parts.push("low retention");
    }
    if (cueScore != null) {
      const pct = Math.round(cueScore * 100);
      if (pct >= 70) parts.push("good cue independence");
      else if (pct < 40) parts.push("high cue reliance");
      else parts.push("moderate cue reliance");
    }
    if (accuracySlope != null) {
      if (accuracySlope > 0.3) parts.push("accuracy trending up");
      else if (accuracySlope < -0.3) parts.push("accuracy declining");
    }
    if (activeDays <= 2 && activeDays > 0) parts.push("low engagement");
    return parts.length > 0 ? parts.join(", ") : "limited data for summary";
  }, [retentionRate, cueScore, accuracySlope, activeDays]);

  // --- Primary issue + recommended action ---
  const primaryIssue: PrimaryIssue | null = useMemo(() => {
    // Priority order: retention → cue dependence → accuracy → latency → engagement
    if (retentionRate != null && retentionRate < 40) {
      return {
        label: "Low word retention across sessions",
        detail: `Only ${retentionRate}% of practiced words retained`,
        action: "Increase spaced repetition intervals and re-expose lost words",
      };
    }
    if (cueScore != null && cueScore < 0.4) {
      return {
        label: "High cue dependence in naming tasks",
        detail: `${Math.round(cueScore * 100)}% cue independence`,
        action: "Gradually reduce cue support; focus on independent retrieval",
      };
    }
    if (avgAccuracy != null && priorAvgAccuracy != null && avgAccuracy < priorAvgAccuracy - 8) {
      return {
        label: "Accuracy declining vs prior period",
        detail: `${Math.round(avgAccuracy)}% → was ${Math.round(priorAvgAccuracy)}%`,
        action: "Review difficulty level and consider stepping down task complexity",
      };
    }
    if (activeDays <= 2 && activeDays > 0) {
      return {
        label: "Low practice adherence",
        detail: `Only ${activeDays}/7 active days`,
        action: "Schedule outreach and set specific daily practice targets",
      };
    }
    if (avgAccuracy != null && avgAccuracy >= 90 && activeDays >= 3) {
      return {
        label: "Exercises may be too easy",
        detail: `${Math.round(avgAccuracy)}% accuracy — ceiling effect possible`,
        action: "Consider increasing difficulty or introducing new exercise types",
      };
    }
    return null;
  }, [retentionRate, cueScore, avgAccuracy, priorAvgAccuracy, activeDays]);

  // --- Active alerts ---
  const activeAlerts = useMemo(() => {
    const items: string[] = [];
    const critical = alerts.filter(a => a.severity === "critical" && !a.acknowledged_at);
    if (critical.length > 0) items.push(`${critical.length} critical alert${critical.length > 1 ? "s" : ""}`);
    if (flags.some(f => f.type === "fatigue_spike")) items.push("Fatigue spike detected");
    if (flags.some(f => f.type === "no_signal")) items.push("Extended gap in activity");
    return items;
  }, [alerts, flags]);

  // --- Accuracy trend arrow ---
  const accDelta = avgAccuracy != null && priorAvgAccuracy != null
    ? Math.round(avgAccuracy - priorAvgAccuracy) : null;
  const accTrendLabel = accDelta != null
    ? (accDelta > 0 ? `+${accDelta}%` : `${accDelta}%`) : null;

  const StatusIcon = STATUS_CONFIG[status].icon;
  const isDataLoading = rsLoading || cueLoading;

  const cuePercent = cueScore != null ? Math.round(cueScore * 100) : null;

  return (
    <Card className="border-primary/30 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent overflow-hidden">
      <CardContent className="pt-4 pb-4 space-y-3">
        {/* Row 1: Status Line */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatusIcon className={cn("w-5 h-5", STATUS_CONFIG[status].className)} />
          <span className={cn("font-semibold text-base", STATUS_CONFIG[status].className)}>
            {STATUS_CONFIG[status].label}
          </span>
          <span className="text-sm text-muted-foreground">— {statusReason}</span>
          {activeAlerts.length > 0 && (
            <div className="ml-auto flex gap-1.5">
              {activeAlerts.map((a, i) => (
                <Badge key={i} variant="destructive" className="gap-1 text-xs">
                  <AlertTriangle className="w-3 h-3" /> {a}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Row 2: Core Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricTile
            icon={<Brain className="w-4 h-4 text-primary" />}
            label="Recovery"
            value={recoveryScore != null ? `${recoveryScore}` : "—"}
            loading={isDataLoading}
          />
          <MetricTile
            icon={<Shield className="w-4 h-4 text-primary" />}
            label="Retention"
            value={retentionRate != null ? `${retentionRate}%` : "—"}
          />
          <MetricTile
            icon={<Zap className="w-4 h-4 text-primary" />}
            label="Cue Indep."
            value={cuePercent != null ? `${cuePercent}%` : "—"}
            loading={cueLoading}
          />
          <MetricTile
            icon={<Target className="w-4 h-4 text-primary" />}
            label="Accuracy"
            value={avgAccuracy != null ? `${Math.round(avgAccuracy)}%` : "—"}
            trend={accTrendLabel}
            trendPositive={accDelta != null ? accDelta > 0 : undefined}
          />
        </div>

        {/* Row 3: Primary Issue + Action */}
        {primaryIssue && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-muted/50 rounded-lg px-3 py-2.5 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-foreground shrink-0">Primary Focus:</span>
              <span className="text-muted-foreground truncate">{primaryIssue.label}</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground hidden sm:block shrink-0" />
            <div className="flex items-center gap-1.5 text-primary font-medium shrink-0">
              <span className="text-xs uppercase tracking-wide">Next:</span>
              <span className="text-sm">{primaryIssue.action}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricTile({
  icon, label, value, trend, trendPositive, loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: string | null;
  trendPositive?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 bg-background/60 rounded-lg px-3 py-2 border border-border/50">
      {icon}
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground leading-none mb-0.5">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="font-bold text-lg leading-none text-foreground">
            {loading ? "…" : value}
          </span>
          {trend && (
            <span className={cn(
              "text-xs font-medium",
              trendPositive ? "text-green-600 dark:text-green-400" : trendPositive === false ? "text-red-500" : "text-muted-foreground"
            )}>
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
