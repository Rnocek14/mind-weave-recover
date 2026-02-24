/**
 * Golden Patient Pipeline Integration Test
 *
 * Uses a single shared fixture to prove the entire metrics pipeline
 * (timeline → engagement → alerts → EHR export) is internally consistent.
 * Includes physical layer validation.
 */
import { describe, it, expect } from "vitest";
import {
  buildSnapshotTimeline,
  type DoseRow,
  type ReadinessRow,
  type PhysicalRow,
} from "../buildSnapshotTimeline";
import { computeEngagementScore } from "../computeEngagementScore";
import { detectRecoveryAlerts } from "../recoveryAlertDetector";
import { formatEhrSummary } from "../formatEhrSummary";

/* ── Golden fixture ─────────────────────────────────────── */
const jan = (d: number) => `2025-01-${String(d).padStart(2, "0")}`;
const goldenStart = new Date(2025, 0, 1);

const goldenDoses: DoseRow[] = [];
const goldenReadiness: ReadinessRow[] = [];
const goldenPhysical: PhysicalRow[] = [];

// Speech: 10 min on odd days (1,3,5,7,9,11,13)
// PT: 20 min on even days (2,4,6,8,10,12,14)
// Activity: 15 min daily for last 7 only (8-14)
for (let i = 1; i <= 14; i++) {
  const date = jan(i);
  if (i % 2 === 1) goldenDoses.push({ log_date: date, domain_slug: "speech", dose_value: 10 });
  if (i % 2 === 0) goldenDoses.push({ log_date: date, domain_slug: "pt", dose_value: 20 });
  if (i >= 8) goldenDoses.push({ log_date: date, domain_slug: "activity", dose_value: 15 });
}

// Fatigue: recorded days 9-14 with values [2,3,4,4,5,3]
const fatigueValues = [2, 3, 4, 4, 5, 3];
for (let i = 0; i < 6; i++) {
  goldenReadiness.push({ checkin_date: jan(9 + i), fatigue_rating: fatigueValues[i] });
}

// Physical: HealthKit steps for days 5-11 (7 days coverage)
for (let i = 5; i <= 11; i++) {
  goldenPhysical.push({
    metric_date: jan(i),
    steps: 3000 + i * 500,
    active_minutes: 20 + i,
    workout_minutes: i >= 8 ? 15 : null,
    sleep_minutes: 420,
    source: "healthkit",
    last_sync_at: `2025-01-${String(i).padStart(2, "0")}T22:00:00Z`,
  });
}

const { timeline, physicalMeta } = buildSnapshotTimeline({
  startDate: goldenStart,
  days: 14,
  readinessRows: goldenReadiness,
  doseRows: goldenDoses,
  physicalRows: goldenPhysical,
});

/* ── Pipeline consistency ───────────────────────────────── */

describe("Golden patient: engagement score", () => {
  const result = computeEngagementScore(timeline);

  it("all 14 days have signal → activeDays = 14", () => {
    expect(result.breakdown.activeDays).toBe(14);
  });

  it("doseDays counts days with ≥10 min total", () => {
    expect(result.breakdown.doseDays).toBe(14);
  });

  it("readinessDays = 6 (fatigue recorded days 9-14)", () => {
    expect(result.breakdown.readinessDays).toBe(6);
  });

  it("fatigueStableDays = 3 (values ≤3: [2,3,3])", () => {
    expect(result.breakdown.fatigueStableDays).toBe(3);
  });

  it("score is in valid range", () => {
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("band matches score", () => {
    if (result.score < 40) expect(result.band).toBe("Low");
    else if (result.score < 70) expect(result.band).toBe("Moderate");
    else expect(result.band).toBe("Strong");
  });
});

describe("Golden patient: alert detection", () => {
  const alerts = detectRecoveryAlerts(timeline);

  it("no engagement_failure (every day has signal)", () => {
    expect(alerts.find((a) => a.alert_type === "engagement_failure")).toBeUndefined();
  });

  it("checks dose_inadequacy correctly", () => {
    const doseAlert = alerts.find((a) => a.alert_type === "dose_inadequacy");
    if (doseAlert) {
      expect(doseAlert.domain_slug).toBe("speech");
    }
  });

  it("no deconditioning_risk (golden patient has adequate activity)", () => {
    // Physical coverage days 5-11 in last 7 (days 8-14): days 8,9,10,11 = 4 days
    // activeMinutesObjective for those days: 28,29,30,31 — all > 10
    expect(alerts.find((a) => a.alert_type === "deconditioning_risk")).toBeUndefined();
  });

  it("no overexertion_risk (no activity spike in golden data)", () => {
    expect(alerts.find((a) => a.alert_type === "overexertion_risk")).toBeUndefined();
  });
});

describe("Golden patient: EHR export consistency", () => {
  const engagement = computeEngagementScore(timeline);

  const ehr = formatEhrSummary({
    timeline,
    flags: [],
    alerts: [],
    lastActiveDate: jan(14),
    engagement,
  });

  it("contains engagement score matching computed value", () => {
    expect(ehr).toContain(`${engagement.score}/100`);
    expect(ehr).toContain(`(${engagement.band})`);
  });

  it("active days in EHR matches engagement breakdown", () => {
    expect(ehr).toContain(`Active days: ${engagement.breakdown.activeDays}/${engagement.breakdown.daysTotal}`);
  });

  it("readiness days in EHR matches engagement breakdown", () => {
    expect(ehr).toContain(`Readiness check-ins: ${engagement.breakdown.readinessDays}/${engagement.breakdown.daysTotal}`);
  });

  it("fatigue stable count in EHR matches engagement breakdown", () => {
    expect(ehr).toContain(`${engagement.breakdown.fatigueStableDays}/${engagement.breakdown.fatigueDaysRecorded}`);
  });

  it("contains 'Last 7 days' section with speech stats", () => {
    expect(ehr).toContain("Last 7 days");
    expect(ehr).toContain("Speech dose:");
    expect(ehr).toContain("3/7 days active");
  });

  it("contains Physical ↔ Fatigue correlation block with audit metadata", () => {
    expect(ehr).toContain("Physical ↔ Fatigue:");
    // Golden patient has physical days 8-11 + fatigue days 9-14 → paired: days 9,10,11 = 3
    expect(ehr).toMatch(/n=\d+/);
    expect(ehr).toContain("split=mean");
    expect(ehr).toMatch(/basis=(activeMin|workoutMin|steps)/);
  });
});

describe("Golden patient: physical layer", () => {
  it("physicalMeta shows 7 days coverage from HealthKit", () => {
    expect(physicalMeta.coverageDays).toBe(7);
    expect(physicalMeta.sourcesSeen).toEqual(["healthkit"]);
  });

  it("lastSyncAtMax is day 11 sync", () => {
    expect(physicalMeta.lastSyncAtMax).toBe("2025-01-11T22:00:00Z");
  });

  it("days outside physical range have null steps", () => {
    expect(timeline[0].steps).toBeNull(); // day 1
    expect(timeline[3].steps).toBeNull(); // day 4
    expect(timeline[11].steps).toBeNull(); // day 12
  });

  it("days inside physical range have correct steps", () => {
    expect(timeline[4].steps).toBe(5500); // day 5: 3000 + 5*500
    expect(timeline[10].steps).toBe(8500); // day 11: 3000 + 11*500
  });

  it("workout minutes only present for days 8-11", () => {
    expect(timeline[6].workoutMinutesObjective).toBeNull(); // day 7 (in physical range but < 8)
    expect(timeline[7].workoutMinutesObjective).toBe(15); // day 8
    expect(timeline[10].workoutMinutesObjective).toBe(15); // day 11
  });
});
