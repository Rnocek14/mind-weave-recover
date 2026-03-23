/**
 * Generates rule-based clinician action suggestions
 * based on patient telemetry from the past 7–14 days.
 */

import type { SnapshotDay, RecoveryFlag } from "@/hooks/useWeeklyRecoverySnapshot";
import type { RecoveryAlert } from "@/hooks/useRecoveryAlerts";

export interface NextAction {
  id: string;
  priority: "high" | "medium" | "low";
  icon: "alert" | "trending" | "fatigue" | "outreach" | "cue" | "difficulty" | "practice";
  title: string;
  detail: string;
}

export function generateNextActions({
  timeline,
  flags,
  alerts,
  avgAccuracy,
  priorAvgAccuracy,
  activeDays,
  accuracySlope,
}: {
  timeline: SnapshotDay[];
  flags: RecoveryFlag[];
  alerts: RecoveryAlert[];
  avgAccuracy: number | null;
  priorAvgAccuracy: number | null;
  activeDays: number;
  accuracySlope: number | null;
}): NextAction[] {
  const actions: NextAction[] = [];

  // 1. Unacknowledged critical alerts
  const criticalAlerts = alerts.filter(
    (a) => a.severity === "critical" && !a.acknowledged_at
  );
  if (criticalAlerts.length > 0) {
    actions.push({
      id: "critical-alerts",
      priority: "high",
      icon: "alert",
      title: `Review ${criticalAlerts.length} critical alert${criticalAlerts.length > 1 ? "s" : ""}`,
      detail: criticalAlerts.map((a) => a.title).join("; "),
    });
  }

  // 2. Engagement gap
  const engagementGap = flags.find((f) => f.type === "no_signal");
  if (engagementGap) {
    actions.push({
      id: "engagement-gap",
      priority: "high",
      icon: "outreach",
      title: "Schedule outreach — patient disengaged",
      detail: `${engagementGap.days}-day gap with no recorded activity. Consider phone/message check-in.`,
    });
  }

  // 3. High fatigue
  const recent7 = timeline.slice(-7);
  const highFatigueDays = recent7.filter(
    (d) => d.fatigueRating !== null && d.fatigueRating >= 4
  );
  if (highFatigueDays.length >= 3) {
    actions.push({
      id: "fatigue-monitoring",
      priority: "high",
      icon: "fatigue",
      title: "Monitor fatigue — elevated pattern",
      detail: `${highFatigueDays.length}/7 days with fatigue ≥4/5. Consider reducing session length or dose.`,
    });
  }

  // 4. Accuracy declining
  if (
    avgAccuracy !== null &&
    priorAvgAccuracy !== null &&
    avgAccuracy < priorAvgAccuracy - 10
  ) {
    actions.push({
      id: "accuracy-decline",
      priority: "medium",
      icon: "trending",
      title: "Accuracy declining — review difficulty",
      detail: `Dropped from ${Math.round(priorAvgAccuracy)}% to ${Math.round(avgAccuracy)}% vs prior week. Consider reducing difficulty or reviewing cueing strategy.`,
    });
  }

  // 5. Very high accuracy → increase challenge
  if (avgAccuracy !== null && avgAccuracy >= 90 && activeDays >= 3) {
    actions.push({
      id: "increase-difficulty",
      priority: "medium",
      icon: "difficulty",
      title: "Consider increasing difficulty",
      detail: `${Math.round(avgAccuracy)}% accuracy across ${activeDays} active days suggests exercises may be too easy.`,
    });
  }

  // 6. Low practice volume
  if (activeDays <= 2 && activeDays > 0) {
    actions.push({
      id: "low-practice",
      priority: "medium",
      icon: "practice",
      title: "Assign more home practice",
      detail: `Only ${activeDays}/7 active days this week. Consider setting specific daily targets.`,
    });
  }

  // 7. Positive trend
  if (
    accuracySlope !== null &&
    accuracySlope > 0.5 &&
    avgAccuracy !== null &&
    avgAccuracy >= 60
  ) {
    actions.push({
      id: "positive-trend",
      priority: "low",
      icon: "trending",
      title: "Positive trajectory — maintain current plan",
      detail: `Accuracy trending upward (slope: +${accuracySlope.toFixed(1)}). Current exercise mix appears effective.`,
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return actions;
}
