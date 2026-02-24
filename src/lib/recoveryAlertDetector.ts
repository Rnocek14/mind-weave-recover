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
        rule_version: "alerts_v1",
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
          rule_version: "alerts_v1",
        },
      });
    }
  }

  // ── 3. Dose inadequacy: speech < 5 days in last 7 ──
  const speechActiveDays = recent7.filter((d) => d.speechMinutes > 0).length;
  if (speechActiveDays > 0 && speechActiveDays < 5) {
    alerts.push({
      alert_type: "dose_inadequacy",
      severity: speechActiveDays < 3 ? "warning" : "info",
      title: speechActiveDays < 3
        ? "Very low speech practice frequency"
        : "Low speech practice frequency",
      description: `Speech practice logged on ${speechActiveDays}/7 days this week. Recommended: 5+ days.`,
      domain_slug: "speech",
      trigger_data: {
        active_days: speechActiveDays,
        target_days: 5,
        rule_version: "alerts_v1",
      },
    });
  }

  // ── 4. Deconditioning risk: objective physical inactivity despite engagement ──
  const physCoverageDays = recent7.filter(
    (d) => d.activeMinutesObjective !== null || d.steps !== null
  ).length;

  if (physCoverageDays >= 3) {
    const inactiveDays = recent7.filter((d) => {
      if (d.activeMinutesObjective !== null) return d.activeMinutesObjective < 10;
      if (d.steps !== null) return d.steps < 2500;
      return false; // no data → don't count as inactive
    }).length;
    const hasSignalDays = recent7.filter((d) => d.hasAnySignal).length;

    if (inactiveDays >= 5 && hasSignalDays >= 3) {
      alerts.push({
        alert_type: "deconditioning_risk",
        severity: inactiveDays >= 6 ? "warning" : "info",
        title: "Physical deconditioning risk",
        description: `Objective activity was very low on ${inactiveDays}/7 days despite continued app engagement (${hasSignalDays}/7 days). Consider PT/OT coordination.`,
        domain_slug: "physical",
        trigger_data: {
          inactive_phys_days: inactiveDays,
          coverage_days: physCoverageDays,
          threshold_active_minutes: 10,
          threshold_steps: 2500,
          rule_version: "phys_alerts_v1",
        },
      });
    }
  }

  // ── 5. Overexertion risk: activity spike → fatigue spike or dose drop ──
  if (recent7.length >= 7) {
    const last3 = recent7.slice(-3);
    const prev4 = recent7.slice(0, 4);

    // physLoad helper: activeMinutes > workoutMinutes > steps/200 > null
    const physLoad = (d: SnapshotDay): number | null => {
      if (d.activeMinutesObjective !== null) return d.activeMinutesObjective;
      if (d.workoutMinutesObjective !== null) return d.workoutMinutesObjective;
      if (d.steps !== null) return d.steps / 200;
      return null;
    };

    const physCovLast3 = last3.filter((d) => physLoad(d) !== null).length;
    const physCovPrev4 = prev4.filter((d) => physLoad(d) !== null).length;
    const fatigueLast3 = last3.filter((d) => d.fatigueRating !== null);
    const fatiguePrev4 = prev4.filter((d) => d.fatigueRating !== null);
    const totalFatigueDays = fatigueLast3.length + fatiguePrev4.length;

    // Prereqs: enough physical coverage + enough fatigue data
    if (physCovLast3 + physCovPrev4 >= 4 && (fatigueLast3.length >= 2 || totalFatigueDays >= 3)) {
      const avgPhysLast3 = physCovLast3 > 0
        ? last3.reduce((s, d) => s + (physLoad(d) ?? 0), 0) / physCovLast3
        : 0;
      const avgPhysPrev4 = physCovPrev4 > 0
        ? prev4.reduce((s, d) => s + (physLoad(d) ?? 0), 0) / physCovPrev4
        : 0;

      const spikeCondition =
        avgPhysPrev4 > 0 &&
        avgPhysLast3 >= avgPhysPrev4 * 1.5 &&
        avgPhysLast3 - avgPhysPrev4 >= 15;

      if (spikeCondition) {
        const avgFatigueLast3 = fatigueLast3.length > 0
          ? fatigueLast3.reduce((s, d) => s + (d.fatigueRating ?? 0), 0) / fatigueLast3.length
          : null;
        const avgFatiguePrev4 = fatiguePrev4.length > 0
          ? fatiguePrev4.reduce((s, d) => s + (d.fatigueRating ?? 0), 0) / fatiguePrev4.length
          : null;

        const fatigueSpike =
          avgFatigueLast3 !== null && avgFatiguePrev4 !== null &&
          avgFatigueLast3 - avgFatiguePrev4 >= 1.0;

        const avgDoseLast3 = last3.reduce((s, d) => s + d.totalMinutes, 0) / 3;
        const avgDosePrev4 = prev4.reduce((s, d) => s + d.totalMinutes, 0) / 4;
        const doseDrop = avgDosePrev4 > 0 && avgDoseLast3 <= avgDosePrev4 * 0.7;

        if (fatigueSpike || doseDrop) {
          const spikePctRounded = Math.round((avgPhysLast3 / avgPhysPrev4 - 1) * 100);
          alerts.push({
            alert_type: "overexertion_risk",
            severity: fatigueSpike && doseDrop ? "critical" : "warning",
            title: "Potential overexertion risk",
            description: `Physical activity spiked ${spikePctRounded}% over the last 3 days${fatigueSpike ? " with rising fatigue" : ""}${doseDrop ? " and declining therapy dose" : ""}. Consider pacing adjustments.`,
            domain_slug: "physical",
            trigger_data: {
              avg_phys_last3: Math.round(avgPhysLast3),
              avg_phys_prev4: Math.round(avgPhysPrev4),
              spike_pct_rounded: spikePctRounded,
              avg_fatigue_last3: avgFatigueLast3,
              avg_fatigue_prev4: avgFatiguePrev4,
              avg_dose_last3: Math.round(avgDoseLast3),
              avg_dose_prev4: Math.round(avgDosePrev4),
              rule_version: "phys_alerts_v1",
            },
          });
        }
      }
    }
  }

  return alerts;
}
