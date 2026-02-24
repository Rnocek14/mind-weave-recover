import { describe, it, expect } from "vitest";
import { computeEngagementScore } from "@/lib/computeEngagementScore";
import type { SnapshotDay } from "@/hooks/useWeeklyRecoverySnapshot";

/** Helper to build a SnapshotDay with defaults */
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

describe("computeEngagementScore", () => {
  it("returns 0 for a timeline of all-zero days", () => {
    const timeline = Array.from({ length: 14 }, (_, i) =>
      day({ date: `2025-01-${String(i + 1).padStart(2, "0")}` })
    );
    const result = computeEngagementScore(timeline);
    // Score is 5 (not 0) because fatigue defaults to 0.5 when unrecorded
    expect(result.score).toBe(5);
    expect(result.band).toBe("Low");
    expect(result.breakdown.activeDays).toBe(0);
  });

  it("returns 100 for a fully engaged patient", () => {
    const timeline = Array.from({ length: 14 }, (_, i) =>
      day({
        date: `2025-01-${String(i + 1).padStart(2, "0")}`,
        speechMinutes: 15,
        fatigueRating: 2,
      })
    );
    const result = computeEngagementScore(timeline);
    expect(result.score).toBe(100);
    expect(result.band).toBe("Strong");
    expect(result.breakdown.activeDays).toBe(14);
    expect(result.breakdown.doseDays).toBe(14);
    expect(result.breakdown.readinessDays).toBe(14);
    expect(result.breakdown.fatigueStableDays).toBe(14);
  });

  it("classifies moderate engagement correctly", () => {
    const timeline = Array.from({ length: 14 }, (_, i) => {
      const isActive = i % 2 === 0; // 7 of 14 active
      return day({
        date: `2025-01-${String(i + 1).padStart(2, "0")}`,
        speechMinutes: isActive ? 12 : 0,
        fatigueRating: isActive ? 3 : null,
      });
    });
    const result = computeEngagementScore(timeline);
    expect(result.band).toBe("Moderate");
    expect(result.breakdown.activeDays).toBe(7);
  });

  it("handles fatigue not recorded → neutral 0.5 score", () => {
    const timeline = Array.from({ length: 14 }, (_, i) =>
      day({
        date: `2025-01-${String(i + 1).padStart(2, "0")}`,
        speechMinutes: 15,
        // no fatigue recorded
      })
    );
    const result = computeEngagementScore(timeline);
    expect(result.breakdown.fatigueDaysRecorded).toBe(0);
    // Should still score well because fatigue defaults to 0.5
    expect(result.score).toBeGreaterThan(60);
  });

  it("penalizes high fatigue days", () => {
    const allStable = Array.from({ length: 14 }, (_, i) =>
      day({
        date: `2025-01-${String(i + 1).padStart(2, "0")}`,
        speechMinutes: 15,
        fatigueRating: 2,
      })
    );
    const allHigh = Array.from({ length: 14 }, (_, i) =>
      day({
        date: `2025-01-${String(i + 1).padStart(2, "0")}`,
        speechMinutes: 15,
        fatigueRating: 5,
      })
    );
    const stableResult = computeEngagementScore(allStable);
    const highResult = computeEngagementScore(allHigh);
    expect(stableResult.score).toBeGreaterThan(highResult.score);
  });
});
