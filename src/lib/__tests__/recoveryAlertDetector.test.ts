import { describe, it, expect } from "vitest";
import { detectRecoveryAlerts } from "@/lib/recoveryAlertDetector";
import type { SnapshotDay } from "@/hooks/useWeeklyRecoverySnapshot";

function day(overrides: Partial<SnapshotDay> & { date: string }): SnapshotDay {
  const speech = overrides.speechMinutes ?? 0;
  const therapy = overrides.therapyMinutes ?? 0;
  const activity = overrides.activityMinutes ?? 0;
  const fatigue = overrides.fatigueRating ?? null;
  const total = speech + therapy + activity;
  return {
    date: overrides.date,
    speechMinutes: speech,
    therapyMinutes: therapy,
    activityMinutes: activity,
    totalMinutes: total,
    fatigueRating: fatigue,
    hasAnySignal: total > 0 || fatigue !== null,
    steps: overrides.steps ?? null,
    workoutMinutesObjective: overrides.workoutMinutesObjective ?? null,
    activeMinutesObjective: overrides.activeMinutesObjective ?? null,
    sleepMinutes: overrides.sleepMinutes ?? null,
  };
}

function makeDays(count: number, factory: (i: number) => Partial<SnapshotDay>): SnapshotDay[] {
  return Array.from({ length: count }, (_, i) =>
    day({ date: `2025-01-${String(i + 1).padStart(2, "0")}`, ...factory(i) })
  );
}

describe("detectRecoveryAlerts", () => {
  it("returns empty for short timelines (<3 days)", () => {
    expect(detectRecoveryAlerts([])).toEqual([]);
    expect(detectRecoveryAlerts(makeDays(2, () => ({})))).toEqual([]);
  });

  it("detects engagement failure (3+ trailing no-signal days)", () => {
    const timeline = makeDays(14, (i) => ({
      speechMinutes: i < 11 ? 10 : 0, // last 3 days empty
    }));
    const alerts = detectRecoveryAlerts(timeline);
    const gap = alerts.find((a) => a.alert_type === "engagement_failure");
    expect(gap).toBeDefined();
    expect(gap!.severity).toBe("warning");
    expect(gap!.trigger_data.streak_days).toBe(3);
  });

  it("escalates engagement failure to critical at 5+ days", () => {
    const timeline = makeDays(14, (i) => ({
      speechMinutes: i < 9 ? 10 : 0, // last 5 days empty
    }));
    const alerts = detectRecoveryAlerts(timeline);
    const gap = alerts.find((a) => a.alert_type === "engagement_failure");
    expect(gap).toBeDefined();
    expect(gap!.severity).toBe("critical");
  });

  it("detects fatigue risk (high fatigue + dose drop)", () => {
    const timeline = makeDays(14, (i) => ({
      speechMinutes: i < 7 ? 30 : 5, // dose drops in week 2
      fatigueRating: i >= 7 ? 4 : 2, // high fatigue in week 2
    }));
    const alerts = detectRecoveryAlerts(timeline);
    const fatigue = alerts.find((a) => a.alert_type === "fatigue_risk");
    expect(fatigue).toBeDefined();
    expect(fatigue!.severity).toBe("warning");
  });

  it("does NOT fire fatigue risk without dose drop", () => {
    const timeline = makeDays(14, () => ({
      speechMinutes: 30, // consistent dose
      fatigueRating: 5, // high fatigue but no drop
    }));
    const alerts = detectRecoveryAlerts(timeline);
    expect(alerts.find((a) => a.alert_type === "fatigue_risk")).toBeUndefined();
  });

  it("detects dose inadequacy (speech <5 days in last 7)", () => {
    const timeline = makeDays(14, (i) => ({
      speechMinutes: i >= 7 && i < 10 ? 10 : 0, // only 3 of last 7
    }));
    const alerts = detectRecoveryAlerts(timeline);
    const dose = alerts.find((a) => a.alert_type === "dose_inadequacy");
    expect(dose).toBeDefined();
    expect(dose!.domain_slug).toBe("speech");
  });

  it("does NOT fire dose inadequacy when 0 speech days (no false positive)", () => {
    const timeline = makeDays(14, () => ({
      therapyMinutes: 20, // therapy only, no speech
    }));
    const alerts = detectRecoveryAlerts(timeline);
    expect(alerts.find((a) => a.alert_type === "dose_inadequacy")).toBeUndefined();
  });

  // ── Physical-aware alerts ──────────────────────────────

  it("fires deconditioning_risk with 5+ inactive phys days + decent coverage + engagement", () => {
    const timeline = makeDays(14, (i) => ({
      speechMinutes: 10, // engaged
      activeMinutesObjective: i >= 7 ? 5 : null, // last 7: all < 10
      steps: i >= 7 ? 1000 : null, // coverage on last 7
    }));
    const alerts = detectRecoveryAlerts(timeline);
    const decon = alerts.find((a) => a.alert_type === "deconditioning_risk");
    expect(decon).toBeDefined();
    expect(decon!.domain_slug).toBe("physical");
    expect(decon!.severity).toBe("warning"); // 7 inactive >= 6
  });

  it("does NOT fire deconditioning_risk if phys coverage < 3", () => {
    const timeline = makeDays(14, (i) => ({
      speechMinutes: 10,
      activeMinutesObjective: i === 13 ? 2 : null, // only 1 day coverage in last 7
    }));
    const alerts = detectRecoveryAlerts(timeline);
    expect(alerts.find((a) => a.alert_type === "deconditioning_risk")).toBeUndefined();
  });

  it("fires overexertion_risk when activity spikes + fatigue spike", () => {
    const timeline = makeDays(14, (i) => {
      const inLast7 = i >= 7;
      const inLast3 = i >= 11;
      return {
        speechMinutes: 20,
        activeMinutesObjective: inLast7 ? (inLast3 ? 60 : 15) : null, // spike in last 3
        fatigueRating: inLast7 ? (inLast3 ? 5 : 2) : null, // fatigue spike
      };
    });
    const alerts = detectRecoveryAlerts(timeline);
    const over = alerts.find((a) => a.alert_type === "overexertion_risk");
    expect(over).toBeDefined();
    expect(over!.domain_slug).toBe("physical");
    expect(over!.severity).toBe("warning");
  });

  it("does NOT fire overexertion_risk without fatigue data or dose drop", () => {
    const timeline = makeDays(14, (i) => {
      const inLast7 = i >= 7;
      const inLast3 = i >= 11;
      return {
        speechMinutes: 20, // consistent dose → no dose drop
        activeMinutesObjective: inLast7 ? (inLast3 ? 60 : 15) : null,
        // no fatigue recorded at all
      };
    });
    const alerts = detectRecoveryAlerts(timeline);
    expect(alerts.find((a) => a.alert_type === "overexertion_risk")).toBeUndefined();
  });
});
