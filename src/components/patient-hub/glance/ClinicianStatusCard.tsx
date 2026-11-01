/**
 * A review queue, not a diagnostic "stable/declining" classification.
 * The automation points clinicians to evidence; it never prescribes therapy.
 */
import { Card } from "@/components/ui/card";
import { Activity, AlertTriangle, ClipboardCheck, FileQuestion } from "lucide-react";
import { clinicianReviewSummary } from "@/lib/clinical/clinicianReviewPolicy";

interface ClinicianStatusCardProps {
  patientName: string;
  redFlagCount: number;
  orangeFlagCount: number;
  unacknowledgedAlerts: number;
  accuracySlope: number | null; // Retained for older callers, never used for recommendations.
  activeDays: number;
  lastActiveDate: string | null;
  scoredRecent?: number;
  scoredPrior?: number;
  practiceDeltaPp?: number | null;
}

export function ClinicianStatusCard({
  patientName, redFlagCount, orangeFlagCount, unacknowledgedAlerts,
  activeDays, lastActiveDate, scoredRecent = 0, scoredPrior = 0,
  practiceDeltaPp = null,
}: ClinicianStatusCardProps) {
  const summary = clinicianReviewSummary({
    criticalAlerts: redFlagCount,
    otherAlerts: Math.max(orangeFlagCount, unacknowledgedAlerts),
    activeDays7d: activeDays,
    lastActiveDate,
    scoredRecent,
    scoredPrior,
    practiceDeltaPp,
  });
  const Icon = summary.priority === "alert" ? AlertTriangle
    : summary.priority === "follow_up" ? Activity
    : summary.priority === "measurement" ? FileQuestion : ClipboardCheck;
  const accent = summary.priority === "alert"
    ? "border-destructive/50"
    : summary.priority === "follow_up" ? "border-amber-500/50" : "border-border";

  return (
    <Card className={"min-w-0 p-4 sm:p-5 border " + accent} aria-label={"Practice review for " + patientName}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon aria-hidden="true" className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap justify-between items-center gap-x-3 gap-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Review priority · {patientName}
            </p>
            {lastActiveDate && <p className="text-xs text-muted-foreground">Last activity: {lastActiveDate}</p>}
          </div>
          <h2 className="text-lg font-semibold leading-snug text-foreground">{summary.title}</h2>
          <p className="text-sm text-foreground">{summary.reason}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            <strong className="text-foreground">To review:</strong> {summary.nextStep}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            These are app-practice signals, not a diagnosis or validated recovery status.
            A clinician decides whether any therapy change is appropriate.
          </p>
        </div>
      </div>
    </Card>
  );
}
