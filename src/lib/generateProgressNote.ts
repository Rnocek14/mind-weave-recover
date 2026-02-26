import type { SnapshotDay, RecoveryFlag } from "@/hooks/useWeeklyRecoverySnapshot";
import type { RecoveryAlert } from "@/hooks/useRecoveryAlerts";
import type { EngagementResult } from "@/lib/computeEngagementScore";
import { localYYYYMMDD } from "@/lib/localDate";

/**
 * Template-driven, deterministic progress note generator.
 * No LLM — numbers in, sentences out.
 * Suitable for EHR documentation and clinical review.
 */

export interface ProgressNoteInput {
  timeline: SnapshotDay[];
  flags: RecoveryFlag[];
  alerts: RecoveryAlert[];
  lastActiveDate: string | null;
  engagement: EngagementResult | null;
  /** Learning rate slope from learning_rates table (accuracy_slope per session) */
  accuracySlope: number | null;
  /** Total trial count in the reporting window */
  trialCount: number | null;
  /** Number of sessions in the reporting window */
  sessionCount: number | null;
  /** Average accuracy across window (0–100) */
  avgAccuracy: number | null;
  /** Previous week's average accuracy for comparison (0–100) */
  priorAvgAccuracy: number | null;
  /** Prescribed speech days/week target */
  prescribedDays: number | null;
  /** Patient display name (optional, stripped from EHR copy) */
  profileName?: string;
}

export interface ProgressNote {
  /** Full narrative text */
  narrative: string;
  /** One-line headline for card display */
  headline: string;
  /** Data confidence level */
  confidence: "high" | "moderate" | "low" | "insufficient";
  /** Reason if confidence is low/insufficient */
  confidenceReason: string | null;
}

export function generateProgressNote(input: ProgressNoteInput): ProgressNote {
  const {
    timeline,
    flags,
    alerts,
    lastActiveDate,
    engagement,
    accuracySlope,
    trialCount,
    sessionCount,
    avgAccuracy,
    priorAvgAccuracy,
    prescribedDays,
  } = input;

  // ── Confidence assessment ──
  const confidence = assessConfidence(timeline, trialCount, sessionCount);

  // ── Build sentences ──
  const sentences: string[] = [];

  // 1. Trial volume
  if (trialCount !== null && trialCount > 0) {
    // Trial volume sentence
    sentences.push(
      `Patient completed ${trialCount} speech trial${trialCount !== 1 ? "s" : ""} this week${sessionCount ? ` across ${sessionCount} session${sessionCount !== 1 ? "s" : ""}` : ""}.`
    );
  } else {
    sentences.push("No speech trials recorded this week.");
  }

  // 2. Accuracy trend
  if (avgAccuracy !== null) {
    const accStr = `${Math.round(avgAccuracy)}%`;
    if (priorAvgAccuracy !== null) {
      const delta = Math.round(avgAccuracy - priorAvgAccuracy);
      const direction = delta > 0 ? "improved" : delta < 0 ? "declined" : "remained stable";
      const absD = Math.abs(delta);
      if (absD >= 1) {
        sentences.push(
          `Average accuracy ${direction} from ${Math.round(priorAvgAccuracy)}% to ${accStr} (${delta > 0 ? "+" : ""}${delta}%).`
        );
      } else {
        sentences.push(`Average accuracy remained stable at ${accStr}.`);
      }
    } else {
      sentences.push(`Average accuracy was ${accStr}.`);
    }
  }

  // 3. Learning slope (if sufficient data)
  if (accuracySlope !== null && trialCount !== null && trialCount >= 10) {
    if (accuracySlope > 0.01) {
      sentences.push("Learning trajectory is positive.");
    } else if (accuracySlope < -0.01) {
      sentences.push("Learning trajectory shows decline in app performance this week.");
    } else {
      sentences.push("Learning trajectory is flat (plateau pattern).");
    }
  }

  // 4. Practice frequency
  const recent7 = timeline.slice(-7);
  const speechActiveDays = recent7.filter((d) => d.speechMinutes > 0).length;
  const target = prescribedDays ?? 5;
  if (speechActiveDays > 0) {
    const met = speechActiveDays >= target;
    sentences.push(
      `Speech practice logged on ${speechActiveDays}/7 days${met ? " (meeting target)." : ` (target: ${target}/7 days).`}`
    );
  }

  // 5. Engagement
  if (engagement) {
    sentences.push(
      `Engagement score: ${engagement.score}/100 (${engagement.band}).`
    );
  }

  // 6. Fatigue
  const fatigueDays = recent7.filter((d) => d.fatigueRating !== null);
  if (fatigueDays.length > 0) {
    const avgFatigue =
      fatigueDays.reduce((s, d) => s + d.fatigueRating!, 0) / fatigueDays.length;
    const fStr = avgFatigue.toFixed(1);
    if (avgFatigue >= 4) {
      sentences.push(
        `Fatigue averaged ${fStr}/5 over ${fatigueDays.length} days — elevated; may limit practice tolerance.`
      );
    } else if (avgFatigue >= 3) {
      sentences.push(
        `Fatigue averaged ${fStr}/5 over ${fatigueDays.length} days — moderate.`
      );
    } else {
      sentences.push(
        `Fatigue averaged ${fStr}/5 over ${fatigueDays.length} days — within baseline.`
      );
    }
  } else {
    sentences.push("Fatigue: not recorded this week.");
  }

  // 7. Active alerts
  const unresolvedAlerts = alerts.filter((a) => !a.resolved_at);
  if (unresolvedAlerts.length > 0) {
    const critical = unresolvedAlerts.filter((a) => a.severity === "critical");
    const warnings = unresolvedAlerts.filter((a) => a.severity === "warning");
    const parts: string[] = [];
    if (critical.length > 0) parts.push(`${critical.length} critical`);
    if (warnings.length > 0) parts.push(`${warnings.length} warning`);
    sentences.push(
      `Active alerts: ${parts.join(", ")} (${unresolvedAlerts.map((a) => a.title).join("; ")}).`
    );
  } else {
    sentences.push("No active clinical alerts.");
  }

  // 8. Flags
  if (flags.length > 0) {
    sentences.push(
      `Flags: ${flags.map((f) => f.label).join("; ")}.`
    );
  }

  // 9. Confidence disclaimer
  if (confidence.level !== "high") {
    sentences.push(`Data confidence: ${confidence.level} — ${confidence.reason}.`);
  }

  // ── Build headline ──
  const headline = buildHeadline(
    trialCount,
    avgAccuracy,
    priorAvgAccuracy,
    speechActiveDays,
    unresolvedAlerts.length
  );

  const narrative = sentences.join(" ");

  return {
    narrative,
    headline,
    confidence: confidence.level,
    confidenceReason: confidence.reason,
  };
}

function assessConfidence(
  timeline: SnapshotDay[],
  trialCount: number | null,
  sessionCount: number | null
): { level: ProgressNote["confidence"]; reason: string | null } {
  if (!trialCount || trialCount === 0) {
    return { level: "insufficient", reason: "no trials recorded in reporting window" };
  }
  if (trialCount < 10) {
    return { level: "low", reason: `only ${trialCount} trials recorded (minimum: 10 for reliable trends)` };
  }

  const activeDays = timeline.slice(-7).filter((d) => d.hasAnySignal).length;
  if (activeDays < 3) {
    return { level: "low", reason: `only ${activeDays}/7 active days — sparse data` };
  }

  if ((sessionCount ?? 0) < 3) {
    return { level: "moderate", reason: `${sessionCount} sessions (3+ recommended for trend reliability)` };
  }

  return { level: "high", reason: null };
}

function buildHeadline(
  trialCount: number | null,
  avgAccuracy: number | null,
  priorAvgAccuracy: number | null,
  speechActiveDays: number,
  alertCount: number
): string {
  const parts: string[] = [];

  if (trialCount !== null && trialCount > 0) {
    parts.push(`${trialCount} trials`);
  }

  if (avgAccuracy !== null && priorAvgAccuracy !== null) {
    const delta = Math.round(avgAccuracy - priorAvgAccuracy);
    if (delta > 0) parts.push(`accuracy ↑${delta}%`);
    else if (delta < 0) parts.push(`accuracy ↓${Math.abs(delta)}%`);
    else parts.push("accuracy stable");
  } else if (avgAccuracy !== null) {
    parts.push(`${Math.round(avgAccuracy)}% acc`);
  }

  if (alertCount > 0) {
    parts.push(`${alertCount} alert${alertCount !== 1 ? "s" : ""}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "No data this week";
}

