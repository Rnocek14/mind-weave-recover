import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  HelpCircle,
  Clock,
  Brain,
  Calendar,
  BarChart3,
} from "lucide-react";
import type { CaseloadPatient } from "@/hooks/useClinicianCaseload";

interface PatientCardProps {
  patient: CaseloadPatient;
  onClick?: (profileId: string) => void;
}

function TrendIcon({ trend }: { trend: CaseloadPatient["trend"] }) {
  switch (trend) {
    case "up":
      return <TrendingUp className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />;
    case "down":
      return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
    case "flat":
      return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
    default:
      return <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

function trendLabel(trend: CaseloadPatient["trend"]): string {
  switch (trend) {
    case "up": return "Improving";
    case "down": return "Declining";
    case "flat": return "Stable";
    default: return "Insufficient data";
  }
}

function daysSinceLabel(dateStr: string | null): string {
  if (!dateStr) return "No activity";
  const days = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function adherenceColor(days: number): string {
  if (days >= 5) return "text-green-600 dark:text-green-400";
  if (days >= 3) return "text-amber-600 dark:text-amber-400";
  return "text-red-500";
}

function adherenceProgressColor(days: number): string {
  if (days >= 5) return "[&>div]:bg-green-500";
  if (days >= 3) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-red-500";
}

export function PatientCard({ patient, onClick }: PatientCardProps) {
  const {
    name,
    daysPostStroke,
    aphasiaLabel,
    trials7d,
    priorTrials7d,
    adherenceDays7d,
    avgAccuracy7d,
    accuracyDelta7d,
    activeAlertCount,
    criticalAlertCount,
    lastActiveDate,
    trend,
  } = patient;

  const hasCritical = criticalAlertCount > 0;
  const hasAlerts = activeAlertCount > 0;
  const daysSinceActive = lastActiveDate
    ? Math.floor((Date.now() - new Date(lastActiveDate).getTime()) / (1000 * 60 * 60 * 24))
    : Infinity;
  const isInactive = daysSinceActive >= 3;

  const hasSufficientTrials = trials7d >= 10 && priorTrials7d >= 10;
  const trialDelta = hasSufficientTrials && priorTrials7d > 0
    ? Math.round(((trials7d - priorTrials7d) / priorTrials7d) * 100)
    : null;
  const lowData = !hasSufficientTrials;

  // Composite triage status
  type TriageStatus = "needs_attention" | "monitor" | "re_engage" | "on_track";
  const triageStatus: TriageStatus = hasCritical
    ? "needs_attention"
    : daysSinceActive >= 5
    ? "re_engage"
    : trend === "down" && hasSufficientTrials
    ? "monitor"
    : "on_track";

  const triageConfig: Record<TriageStatus, { label: string; className: string }> = {
    needs_attention: { label: "Needs attention", className: "bg-destructive/10 text-destructive border-destructive/30" },
    monitor: { label: "Monitor", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-400/30" },
    re_engage: { label: "Re-engage", className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30" },
    on_track: { label: "On track", className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30" },
  };

  return (
    <Card
      className={`p-0 cursor-pointer transition-all hover:shadow-md hover:bg-accent/30 overflow-hidden ${
        hasCritical
          ? "border-destructive/50 shadow-destructive/5"
          : isInactive
          ? "border-amber-400/40"
          : ""
      }`}
      onClick={() => onClick?.(patient.profileId)}
    >
      {/* Header bar */}
      <div className={`px-4 py-3 border-b ${
        hasCritical ? "bg-destructive/5" : "bg-muted/30"
      }`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate">{name}</h3>
              <Badge variant="outline" className={`text-xs px-1.5 py-0 shrink-0 ${triageConfig[triageStatus].className}`}>
                {triageConfig[triageStatus].label}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              {daysPostStroke !== null && (
                <span className="flex items-center gap-0.5">
                  <Calendar className="w-3 h-3" />
                  {daysPostStroke}d post-stroke
                </span>
              )}
              {aphasiaLabel && (
                <>
                  {daysPostStroke !== null && <span>·</span>}
                  <span className="flex items-center gap-0.5">
                    <Brain className="w-3 h-3" />
                    {aphasiaLabel}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Alert badges */}
          <div className="flex items-center gap-1 shrink-0">
            {hasCritical && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0.5 gap-0.5">
                <AlertTriangle className="w-3 h-3" />
                {criticalAlertCount} critical
              </Badge>
            )}
            {hasAlerts && !hasCritical && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0.5 gap-0.5">
                <AlertTriangle className="w-3 h-3" />
                {activeAlertCount}
              </Badge>
            )}
            {hasCritical && activeAlertCount - criticalAlertCount > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                +{activeAlertCount - criticalAlertCount}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Metrics body */}
      <div className="px-4 py-3 space-y-3">
        {/* Row 1: Accuracy + Trend */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground mb-0.5">Accuracy (7d)</div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold tabular-nums">
                {avgAccuracy7d !== null ? `${avgAccuracy7d}%` : "—"}
              </span>
              {accuracyDelta7d !== null && accuracyDelta7d !== 0 && (
                <span
                  className={`text-xs font-medium ${
                    accuracyDelta7d > 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-500"
                  }`}
                >
                  {accuracyDelta7d > 0 ? "+" : ""}{accuracyDelta7d}%
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground mb-0.5">Trend</div>
            <div className="flex items-center gap-1 justify-end">
              <TrendIcon trend={trend} />
              <span className={`text-xs font-medium ${
                trend === "up" ? "text-green-600 dark:text-green-400" :
                trend === "down" ? "text-red-500" : "text-muted-foreground"
              }`}>
                {trendLabel(trend)}
              </span>
              {lowData && trend !== "unknown" && (
                <Badge variant="outline" className="text-xs px-1 py-0 text-muted-foreground border-muted-foreground/30">
                  &lt;10 trials
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Adherence bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Days practiced</span>
            <span className={`text-xs font-semibold tabular-nums ${adherenceColor(adherenceDays7d)}`}>
              {adherenceDays7d}/7 days
            </span>
          </div>
          <Progress
            value={(adherenceDays7d / 7) * 100}
            className={`h-1.5 bg-muted ${adherenceProgressColor(adherenceDays7d)}`}
          />
        </div>

        {/* Row 3: Trials + Volume change */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Trials (7d)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold tabular-nums">{trials7d}</span>
            {trialDelta !== null && (
              <span className={`text-xs ${
                trialDelta > 0
                  ? "text-green-600 dark:text-green-400"
                  : trialDelta < 0
                  ? "text-red-500"
                  : "text-muted-foreground"
              }`}>
                {trialDelta > 0 ? "+" : ""}{trialDelta}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer: Last active */}
      <div className="px-4 py-2 border-t bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>Last active: {daysSinceLabel(lastActiveDate)}</span>
        </div>
        {isInactive && lastActiveDate && (
          <Badge variant="outline" className="text-xs px-1.5 py-0 text-amber-600 dark:text-amber-400 border-amber-400/40">
            Inactive
          </Badge>
        )}
        {!lastActiveDate && (
          <Badge variant="outline" className="text-xs px-1.5 py-0 text-muted-foreground">
            Never active
          </Badge>
        )}
      </div>
    </Card>
  );
}
