/**
 * Clinician Glance — Card 1: Status / Triage
 * Answers: "Should I worry about this patient?"
 *
 * Same traffic-light shape as the caregiver Status card, but the headline
 * names the *clinical reason* (slope, alerts, inactivity) so an SLP can
 * triage in 2 seconds.
 */
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Activity, AlertCircle } from "lucide-react";
import { useMemo } from "react";

interface ClinicianStatusCardProps {
  patientName: string;
  redFlagCount: number;
  orangeFlagCount: number;
  unacknowledgedAlerts: number;
  accuracySlope: number | null; // % per week
  activeDays: number; // last 7
  lastActiveDate: string | null;
}

type Tier = "stable" | "watch" | "attention";

export function ClinicianStatusCard({
  patientName,
  redFlagCount,
  orangeFlagCount,
  unacknowledgedAlerts,
  accuracySlope,
  activeDays,
  lastActiveDate,
}: ClinicianStatusCardProps) {
  const { tier, headline, reasons, suggestion } = useMemo(() => {
    const reasons: string[] = [];
    let tier: Tier = "stable";

    if (redFlagCount > 0 || (accuracySlope !== null && accuracySlope <= -10)) {
      tier = "attention";
    } else if (
      orangeFlagCount > 0 ||
      unacknowledgedAlerts > 0 ||
      activeDays < 2 ||
      (accuracySlope !== null && accuracySlope <= -5)
    ) {
      tier = "watch";
    }

    if (redFlagCount > 0) reasons.push(`${redFlagCount} red flag${redFlagCount === 1 ? "" : "s"}`);
    if (orangeFlagCount > 0) reasons.push(`${orangeFlagCount} amber signal${orangeFlagCount === 1 ? "" : "s"}`);
    if (unacknowledgedAlerts > 0) reasons.push(`${unacknowledgedAlerts} unread alert${unacknowledgedAlerts === 1 ? "" : "s"}`);
    if (accuracySlope !== null && accuracySlope <= -5) reasons.push(`${Math.round(accuracySlope)}% accuracy / wk`);
    if (activeDays < 2) reasons.push(`${activeDays}/7 active days`);

    const headline =
      tier === "attention"
        ? "Needs attention"
        : tier === "watch"
        ? "Monitor closely"
        : "Stable";

    // Lightweight clinician assist — what to do next
    let suggestion: string;
    if (tier === "attention") {
      if (accuracySlope !== null && accuracySlope <= -10) {
        suggestion = "Next: reduce difficulty one level and add cues; review struggle clip below.";
      } else {
        suggestion = "Next: review red flags before next session and consider scaling back challenge.";
      }
    } else if (tier === "watch") {
      if (activeDays < 2) {
        suggestion = "Next: outreach to caregiver — practice volume below dose target.";
      } else if (accuracySlope !== null && accuracySlope <= -5) {
        suggestion = "Next: hold current level, increase cueing, monitor cue dependency.";
      } else {
        suggestion = "Next: continue current plan, recheck after 2–3 sessions.";
      }
    } else {
      suggestion = "Next: continue current plan; consider stretching one exercise up a level.";
    }

    return { tier, headline, reasons, suggestion };
  }, [redFlagCount, orangeFlagCount, unacknowledgedAlerts, accuracySlope, activeDays]);

  const styles = {
    stable: { ring: "ring-emerald-500/30 bg-emerald-500/5", icon: CheckCircle2, color: "text-emerald-600", iconBg: "bg-emerald-500/10" },
    watch: { ring: "ring-amber-500/30 bg-amber-500/5", icon: Activity, color: "text-amber-600", iconBg: "bg-amber-500/10" },
    attention: { ring: "ring-destructive/30 bg-destructive/5", icon: AlertTriangle, color: "text-destructive", iconBg: "bg-destructive/10" },
  }[tier];

  const Icon = styles.icon;

  return (
    <Card className={`p-5 ring-1 ${styles.ring}`}>
      <div className="flex items-start gap-4">
        <div className={`shrink-0 w-12 h-12 rounded-full ${styles.iconBg} flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${styles.color}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
              Triage · {patientName}
            </div>
            {lastActiveDate && (
              <span className="text-[11px] text-muted-foreground">
                Last active {lastActiveDate}
              </span>
            )}
          </div>
          <div className={`text-xl font-bold ${styles.color} leading-tight`}>{headline}</div>
          {reasons.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {reasons.map((r, i) => (
                <Badge key={i} variant="outline" className="text-[10px] font-normal">
                  {r}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground mt-0.5">
              No flags. Slope and engagement within target.
            </div>
          )}
          <div className="mt-2 text-[12px] text-foreground/80 leading-snug">
            <span className="font-semibold text-foreground">Suggested: </span>
            {suggestion.replace(/^Next:\s*/, "")}
          </div>
        </div>
      </div>
    </Card>
  );
}
