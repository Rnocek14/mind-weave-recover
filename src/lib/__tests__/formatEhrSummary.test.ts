import { describe, it, expect } from "vitest";
import { formatEhrSummary } from "@/lib/formatEhrSummary";
import type { SnapshotDay, RecoveryFlag } from "@/hooks/useWeeklyRecoverySnapshot";
import type { RecoveryAlert } from "@/hooks/useRecoveryAlerts";
import type { EngagementResult } from "@/lib/computeEngagementScore";

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
  };
}

const baseTimeline = Array.from({ length: 14 }, (_, i) =>
  day({
    date: `2025-01-${String(i + 1).padStart(2, "0")}`,
    speechMinutes: 10,
    fatigueRating: 2,
  })
);

const baseEngagement: EngagementResult = {
  score: 72,
  band: "Strong",
  breakdown: {
    activeDays: 10,
    doseDays: 8,
    readinessDays: 7,
    fatigueStableDays: 6,
    fatigueDaysRecorded: 7,
    daysTotal: 14,
  },
};

describe("formatEhrSummary", () => {
  it("includes header with timezone", () => {
    const summary = formatEhrSummary({
      timeline: baseTimeline,
      flags: [],
      alerts: [],
      lastActiveDate: "2025-01-14",
      engagement: baseEngagement,
    });
    expect(summary).toContain("WEEKLY RECOVERY SNAPSHOT");
    expect(summary).toContain("Generated:");
    // Should include timezone info
    expect(summary).toMatch(/\(.+\)/);
  });

  it("shows 'not recorded' when no fatigue data", () => {
    const noFatigueEngagement: EngagementResult = {
      ...baseEngagement,
      breakdown: { ...baseEngagement.breakdown, fatigueDaysRecorded: 0, fatigueStableDays: 0 },
    };
    const noFatigueTimeline = baseTimeline.map((d) => ({ ...d, fatigueRating: null }));
    const summary = formatEhrSummary({
      timeline: noFatigueTimeline,
      flags: [],
      alerts: [],
      lastActiveDate: "2025-01-14",
      engagement: noFatigueEngagement,
    });
    expect(summary).toContain("Fatigue: not recorded");
    expect(summary).not.toContain("0/0");
  });

  it("shows ack status on alerts", () => {
    const alerts: RecoveryAlert[] = [
      {
        id: "a1",
        alert_type: "engagement_failure",
        severity: "warning",
        title: "3-day gap",
        description: "No data for 3 days",
        domain_slug: null,
        trigger_data: {},
        created_at: "2025-01-14T00:00:00Z",
        acknowledged_at: "2025-01-14T01:00:00Z",
        acknowledged_by: "user1",
        acknowledgement_notes: null,
        resolved_at: null,
        resolved_by: null,
        resolution_notes: null,
      },
      {
        id: "a2",
        alert_type: "fatigue_risk",
        severity: "critical",
        title: "Fatigue spike",
        description: "High fatigue",
        domain_slug: null,
        trigger_data: {},
        created_at: "2025-01-14T00:00:00Z",
        acknowledged_at: null,
        acknowledged_by: null,
        acknowledgement_notes: null,
        resolved_at: null,
        resolved_by: null,
        resolution_notes: null,
      },
    ];
    const summary = formatEhrSummary({
      timeline: baseTimeline,
      flags: [],
      alerts,
      lastActiveDate: "2025-01-14",
      engagement: baseEngagement,
    });
    expect(summary).toContain("WARNING (acknowledged): 3-day gap");
    expect(summary).toContain("CRITICAL (unacknowledged): Fatigue spike");
  });

  it("includes flags when present", () => {
    const flags: RecoveryFlag[] = [
      { type: "no_signal", label: "4-day engagement gap", days: 4 },
    ];
    const summary = formatEhrSummary({
      timeline: baseTimeline,
      flags,
      alerts: [],
      lastActiveDate: "2025-01-14",
      engagement: baseEngagement,
    });
    expect(summary).toContain("4-day engagement gap");
  });

  it("includes clinician suggestions based on flags", () => {
    const flags: RecoveryFlag[] = [
      { type: "fatigue_spike", label: "fatigue", days: 3 },
    ];
    const summary = formatEhrSummary({
      timeline: baseTimeline,
      flags,
      alerts: [],
      lastActiveDate: "2025-01-14",
      engagement: baseEngagement,
    });
    expect(summary.toLowerCase()).toContain("assess fatigue drivers");
  });
});
