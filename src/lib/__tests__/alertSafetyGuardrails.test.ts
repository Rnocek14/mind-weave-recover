import { describe, it, expect } from "vitest";
import { detectRecoveryAlerts, type SessionAccuracyStats } from "@/lib/recoveryAlertDetector";
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
    steps: null,
    workoutMinutesObjective: null,
    activeMinutesObjective: null,
    sleepMinutes: null,
    ...overrides,
  };
}

const jan = (d: number) => `2025-01-${String(d).padStart(2, "0")}`;

describe("recoveryAlertDetector: safety guardrails", () => {

  it("regression_risk does NOT trigger when engagement is low (<3 active days)", () => {
    // Prior week: lots of speech. Recent week: dropped but only 2 active days
    const timeline: SnapshotDay[] = [];
    // Prior 7 days: 10 min speech each day
    for (let i = 1; i <= 7; i++) {
      timeline.push(day({ date: jan(i), speechMinutes: 10, hasAnySignal: true }));
    }
    // Recent 7 days: only 2 days active (low engagement), speech dropped
    for (let i = 8; i <= 14; i++) {
      const active = i <= 9; // only days 8-9 active
      timeline.push(day({
        date: jan(i),
        speechMinutes: active ? 2 : 0,
        hasAnySignal: active,
      }));
    }

    const alerts = detectRecoveryAlerts(timeline);
    const regressionAlert = alerts.find(a => a.alert_type === "regression_risk");
    expect(regressionAlert).toBeUndefined();
  });

  it("plateau_risk does NOT trigger when adherence < 60%", () => {
    // 14-day timeline with flat dose but only 3/7 active days in recent week
    const timeline: SnapshotDay[] = [];
    // First 7 days: active every other day
    for (let i = 1; i <= 7; i++) {
      const active = i % 2 === 1;
      timeline.push(day({
        date: jan(i),
        speechMinutes: active ? 10 : 0,
        totalMinutes: active ? 10 : 0,
        hasAnySignal: active,
      }));
    }
    // Recent 7 days: active only 3 days (3/7 = 43% < 60%)
    for (let i = 8; i <= 14; i++) {
      const active = i <= 10;
      timeline.push(day({
        date: jan(i),
        speechMinutes: active ? 10 : 0,
        totalMinutes: active ? 10 : 0,
        hasAnySignal: active,
      }));
    }

    const alerts = detectRecoveryAlerts(timeline);
    const plateauAlert = alerts.find(a => a.alert_type === "plateau_risk");
    expect(plateauAlert).toBeUndefined();
  });

  it("performance_plateau_risk triggers with flat accuracy and adequate data", () => {
    const timeline = Array.from({ length: 14 }, (_, i) =>
      day({
        date: jan(i + 1),
        speechMinutes: 15,
        totalMinutes: 15,
        hasAnySignal: true,
      })
    );

    const stats: SessionAccuracyStats = {
      recentAvgAccuracy: 62,
      priorAvgAccuracy: 61,
      accuracySlope: 0.005, // near zero
      recentTrialCount: 40,
      recentSessionCount: 5,
      priorTrialCount: 35,
    };

    const alerts = detectRecoveryAlerts(timeline, stats);
    const perfPlateau = alerts.find(a => a.alert_type === "performance_plateau_risk");
    expect(perfPlateau).toBeDefined();
    expect(perfPlateau!.severity).toBe("info");
    expect(perfPlateau!.domain_slug).toBe("speech");
  });

  it("performance_plateau_risk does NOT trigger with insufficient trials", () => {
    const timeline = Array.from({ length: 14 }, (_, i) =>
      day({ date: jan(i + 1), speechMinutes: 15, totalMinutes: 15, hasAnySignal: true })
    );

    const stats: SessionAccuracyStats = {
      recentAvgAccuracy: 62,
      priorAvgAccuracy: 61,
      accuracySlope: 0.005,
      recentTrialCount: 5, // too few
      recentSessionCount: 2,
      priorTrialCount: 5,
    };

    const alerts = detectRecoveryAlerts(timeline, stats);
    expect(alerts.find(a => a.alert_type === "performance_plateau_risk")).toBeUndefined();
  });

  it("performance_regression_risk triggers on >15% accuracy drop with adequate dose", () => {
    const timeline = Array.from({ length: 14 }, (_, i) =>
      day({ date: jan(i + 1), speechMinutes: 15, totalMinutes: 15, hasAnySignal: true })
    );

    const stats: SessionAccuracyStats = {
      recentAvgAccuracy: 50,
      priorAvgAccuracy: 70,
      accuracySlope: -0.03,
      recentTrialCount: 30,
      recentSessionCount: 4,
      priorTrialCount: 25,
    };

    const alerts = detectRecoveryAlerts(timeline, stats);
    const perfRegression = alerts.find(a => a.alert_type === "performance_regression_risk");
    expect(perfRegression).toBeDefined();
    expect(perfRegression!.severity).toBe("warning"); // >25% drop
    expect(perfRegression!.description).toContain("70%");
    expect(perfRegression!.description).toContain("50%");
  });

  it("performance_regression_risk does NOT trigger with low baseline accuracy", () => {
    const timeline = Array.from({ length: 14 }, (_, i) =>
      day({ date: jan(i + 1), speechMinutes: 15, totalMinutes: 15, hasAnySignal: true })
    );

    const stats: SessionAccuracyStats = {
      recentAvgAccuracy: 10,
      priorAvgAccuracy: 15, // too low baseline (< 20)
      accuracySlope: -0.02,
      recentTrialCount: 30,
      recentSessionCount: 4,
      priorTrialCount: 25,
    };

    const alerts = detectRecoveryAlerts(timeline, stats);
    expect(alerts.find(a => a.alert_type === "performance_regression_risk")).toBeUndefined();
  });
});
