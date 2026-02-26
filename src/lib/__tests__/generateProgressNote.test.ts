import { describe, it, expect } from "vitest";
import { generateProgressNote } from "@/lib/generateProgressNote";
import type { SnapshotDay, RecoveryFlag } from "@/hooks/useWeeklyRecoverySnapshot";

function day(overrides: Partial<SnapshotDay> & { date: string }): SnapshotDay {
  return {
    speechMinutes: 0,
    therapyMinutes: 0,
    activityMinutes: 0,
    totalMinutes: 0,
    fatigueRating: null,
    hasAnySignal: false,
    steps: null,
    workoutMinutesObjective: null,
    activeMinutesObjective: null,
    sleepMinutes: null,
    ...overrides,
  };
}

function makeTimeline(count: number, overrides?: Partial<SnapshotDay>): SnapshotDay[] {
  return Array.from({ length: count }, (_, i) =>
    day({ date: `2025-01-${String(i + 1).padStart(2, "0")}`, ...overrides })
  );
}

describe("generateProgressNote", () => {
  it("handles zero trials gracefully", () => {
    const result = generateProgressNote({
      timeline: makeTimeline(14),
      flags: [],
      alerts: [],
      lastActiveDate: null,
      engagement: null,
      accuracySlope: null,
      trialCount: 0,
      sessionCount: 0,
      avgAccuracy: null,
      priorAvgAccuracy: null,
      prescribedDays: null,
    });

    expect(result.confidence).toBe("insufficient");
    expect(result.narrative).toContain("No speech trials");
    expect(result.headline).toBe("No data this week");
  });

  it("reports accuracy improvement correctly", () => {
    const result = generateProgressNote({
      timeline: makeTimeline(14, { hasAnySignal: true, speechMinutes: 10, totalMinutes: 15 }),
      flags: [],
      alerts: [],
      lastActiveDate: "2025-01-14",
      engagement: { score: 80, band: "Strong", breakdown: { activeDays: 14, doseDays: 14, readinessDays: 0, fatigueStableDays: 0, fatigueDaysRecorded: 0, daysTotal: 14 } },
      accuracySlope: 0.02,
      trialCount: 50,
      sessionCount: 5,
      avgAccuracy: 72,
      priorAvgAccuracy: 60,
      prescribedDays: 5,
    });

    expect(result.confidence).toBe("high");
    expect(result.narrative).toContain("improved");
    expect(result.narrative).toContain("60%");
    expect(result.narrative).toContain("72%");
    expect(result.narrative).toContain("Learning trajectory is positive");
    expect(result.headline).toContain("accuracy ↑12%");
  });

  it("flags low confidence with few trials", () => {
    const result = generateProgressNote({
      timeline: makeTimeline(14, { hasAnySignal: true }),
      flags: [],
      alerts: [],
      lastActiveDate: "2025-01-14",
      engagement: null,
      accuracySlope: null,
      trialCount: 5,
      sessionCount: 2,
      avgAccuracy: 65,
      priorAvgAccuracy: null,
      prescribedDays: null,
    });

    expect(result.confidence).toBe("low");
    expect(result.narrative).toContain("Data confidence: low");
  });

  it("includes alerts in narrative", () => {
    const result = generateProgressNote({
      timeline: makeTimeline(14, { hasAnySignal: true, speechMinutes: 10, totalMinutes: 15 }),
      flags: [],
      alerts: [
        {
          id: "1",
          alert_type: "engagement_failure",
          severity: "critical",
          title: "5-day engagement gap",
          description: "No data for 5 days",
          domain_slug: null,
          trigger_data: {},
          created_at: "2025-01-14",
          acknowledged_at: null,
          acknowledged_by: null,
          acknowledgement_notes: null,
          resolved_at: null,
          resolved_by: null,
          resolution_notes: null,
        },
      ],
      lastActiveDate: "2025-01-14",
      engagement: null,
      accuracySlope: null,
      trialCount: 20,
      sessionCount: 4,
      avgAccuracy: 55,
      priorAvgAccuracy: null,
      prescribedDays: null,
    });

    expect(result.narrative).toContain("1 critical");
    expect(result.narrative).toContain("5-day engagement gap");
    expect(result.headline).toContain("1 alert");
  });

  it("reports flat learning trajectory as plateau", () => {
    const result = generateProgressNote({
      timeline: makeTimeline(14, { hasAnySignal: true, speechMinutes: 10, totalMinutes: 15 }),
      flags: [],
      alerts: [],
      lastActiveDate: "2025-01-14",
      engagement: null,
      accuracySlope: 0.005,
      trialCount: 30,
      sessionCount: 5,
      avgAccuracy: 60,
      priorAvgAccuracy: 59,
      prescribedDays: null,
    });

    expect(result.narrative).toContain("plateau pattern");
  });
});
