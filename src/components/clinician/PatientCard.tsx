import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  HelpCircle,
  Clock,
  Activity,
} from "lucide-react";
import type { CaseloadPatient } from "@/hooks/useClinicianCaseload";

interface PatientCardProps {
  patient: CaseloadPatient;
  onClick?: (profileId: string) => void;
}

function TrendIcon({ trend }: { trend: CaseloadPatient["trend"] }) {
  switch (trend) {
    case "up":
      return <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />;
    case "down":
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    case "flat":
      return <Minus className="w-4 h-4 text-muted-foreground" />;
    default:
      return <HelpCircle className="w-4 h-4 text-muted-foreground" />;
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

export function PatientCard({ patient, onClick }: PatientCardProps) {
  const {
    name,
    daysPostStroke,
    aphasiaLabel,
    trials7d,
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
  const isInactive = (() => {
    if (!lastActiveDate) return true;
    const days = Math.floor(
      (Date.now() - new Date(lastActiveDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    return days >= 3;
  })();

  return (
    <Card
      className={`p-4 cursor-pointer transition-colors hover:bg-accent/50 ${
        hasCritical
          ? "border-destructive/40"
          : isInactive
          ? "border-amber-400/40"
          : ""
      }`}
      onClick={() => onClick?.(patient.profileId)}
    >
      {/* Row 1: Name + Alerts */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm truncate">{name}</h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {daysPostStroke !== null && <span>{daysPostStroke}d post</span>}
            {aphasiaLabel && (
              <>
                {daysPostStroke !== null && <span>·</span>}
                <span>{aphasiaLabel}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <TrendIcon trend={trend} />
          {hasAlerts && (
            <Badge
              variant={hasCritical ? "destructive" : "secondary"}
              className="text-xs px-1.5 py-0"
            >
              <AlertTriangle className="w-3 h-3 mr-0.5" />
              {activeAlertCount}
            </Badge>
          )}
        </div>
      </div>

      {/* Row 2: Key metrics */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        {/* Accuracy */}
        <div className="text-center">
          <div className="text-muted-foreground mb-0.5">Accuracy</div>
          <div className="font-semibold">
            {avgAccuracy7d !== null ? (
              <span>
                {avgAccuracy7d}%
                {accuracyDelta7d !== null && accuracyDelta7d !== 0 && (
                  <span
                    className={
                      accuracyDelta7d > 0
                        ? "text-green-600 dark:text-green-400 ml-0.5"
                        : "text-red-500 ml-0.5"
                    }
                  >
                    {accuracyDelta7d > 0 ? "+" : ""}
                    {accuracyDelta7d}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>

        {/* Adherence */}
        <div className="text-center">
          <div className="text-muted-foreground mb-0.5">Adherence</div>
          <div
            className={`font-semibold ${
              adherenceDays7d >= 5
                ? "text-green-600 dark:text-green-400"
                : adherenceDays7d >= 3
                ? "text-amber-600 dark:text-amber-400"
                : "text-red-500"
            }`}
          >
            {adherenceDays7d}/7d
          </div>
        </div>

        {/* Trials */}
        <div className="text-center">
          <div className="text-muted-foreground mb-0.5">Trials</div>
          <div className="font-semibold">{trials7d}</div>
        </div>
      </div>

      {/* Row 3: Last active */}
      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t text-xs text-muted-foreground">
        <Clock className="w-3 h-3" />
        <span>{daysSinceLabel(lastActiveDate)}</span>
        {isInactive && lastActiveDate && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600 dark:text-amber-400 border-amber-400/40">
            Inactive
          </Badge>
        )}
      </div>
    </Card>
  );
}
