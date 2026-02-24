import { localYYYYMMDD } from "@/lib/localDate";
import type { SnapshotDay } from "@/hooks/useWeeklyRecoverySnapshot";

export interface DetectedAlert {
  alert_type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  domain_slug: string | null;
  trigger_data: Record<string, unknown>;
}

/**
 * Pure function: evaluates a 14-day timeline and returns alerts to upsert.
 * No side effects — caller decides whether to persist.
 */
export function detectRecoveryAlerts(timeline: SnapshotDay[]): DetectedAlert[] {
  if (timeline.length < 3) return [];

  const alerts: DetectedAlert[] = [];

  // ── 1. Engagement failure: 3+ trailing days with no signal ──
  let noSignalStreak = 0;
  for (let i = timeline.length - 1; i >= 0; i--) {
    if (!timeline[i].hasAnySignal) noSignalStreak++;
    else break;
  }
  if (noSignalStreak >= 3) {
    const gapStart = timeline[timeline.length - noSignalStreak]?.date;
    alerts.push({
      alert_type: "engagement_failure",
      severity: noSignalStreak >= 5 ? "critical" : "warning",
      title: `${noSignalStreak}-day engagement gap`,
      description: `No speech, therapy, or readiness data recorded for ${noSignalStreak} consecutive days. Consider outreach.`,
      domain_slug: null,
      trigger_data: {
        streak_days: noSignalStreak,
        gap_start: gapStart,
        gap_end: localYYYYMMDD(),
      },
    });
  }

  // ── 2. Fatigue risk: fatigue ≥4 for 3+ of last 7 days AND dose dropped 30%+ ──
  const recent7 = timeline.slice(-7);
  const prior7 = timeline.slice(-14, -7);
  const highFatigueDays = recent7.filter(
    (d) => d.fatigueRating !== null && d.fatigueRating >= 4
  );

  if (highFatigueDays.length >= 3 && prior7.length > 0) {
    const recentAvgDose =
      recent7.reduce((s, d) => s + d.totalMinutes, 0) / recent7.length;
    const priorAvgDose =
      prior7.reduce((s, d) => s + d.totalMinutes, 0) / prior7.length;

    if (priorAvgDose > 0 && recentAvgDose < priorAvgDose * 0.7) {
      const avgFatigue =
        highFatigueDays.reduce((s, d) => s + (d.fatigueRating || 0), 0) /
        highFatigueDays.length;
      alerts.push({
        alert_type: "fatigue_risk",
        severity: "warning",
        title: "High fatigue + therapy dose drop",
        description: `Fatigue averaged ${avgFatigue.toFixed(1)}/5 over ${highFatigueDays.length} days while therapy dose dropped ${Math.round((1 - recentAvgDose / priorAvgDose) * 100)}%. Consider lowering task difficulty or scheduling rest.`,
        domain_slug: null,
        trigger_data: {
          high_fatigue_days: highFatigueDays.length,
          avg_fatigue: avgFatigue,
          recent_avg_dose: recentAvgDose,
          prior_avg_dose: priorAvgDose,
          dose_drop_pct: Math.round((1 - recentAvgDose / priorAvgDose) * 100),
        },
      });
    }
  }

  // ── 3. Dose inadequacy: speech < 5 days in last 7 ──
  const speechActiveDays = recent7.filter((d) => d.speechMinutes > 0).length;
  if (speechActiveDays > 0 && speechActiveDays < 3) {
    alerts.push({
      alert_type: "dose_inadequacy",
      severity: "info",
      title: "Low speech practice frequency",
      description: `Speech practice logged on ${speechActiveDays}/7 days this week. Recommended: 5+ days.`,
      domain_slug: "speech",
      trigger_data: {
        active_days: speechActiveDays,
        target_days: 5,
      },
    });
  }

  return alerts;
}
