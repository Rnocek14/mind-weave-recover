import { describe, it, expect } from "vitest";
import {
  buildSnapshotTimeline,
  type ReadinessRow,
  type DoseRow,
  type PhysicalRow,
} from "../buildSnapshotTimeline";

/* ── helpers ─────────────────────────────────── */
const jan = (day: number) => `2025-01-${String(day).padStart(2, "0")}`;
const startDate = new Date(2025, 0, 1); // Jan 1 2025
const build = (opts: Partial<Parameters<typeof buildSnapshotTimeline>[0]> = {}) =>
  buildSnapshotTimeline({ startDate, days: 14, readinessRows: [], doseRows: [], ...opts });

/* ── 1. Date continuity ──────────────────────── */
describe("Date continuity", () => {
  it("produces exactly N days", () => {
    const { timeline: tl } = build({ days: 14 });
    expect(tl).toHaveLength(14);
  });

  it("dates are contiguous and in order", () => {
    const { timeline: tl } = build();
    for (let i = 0; i < tl.length; i++) {
      expect(tl[i].date).toBe(jan(i + 1));
    }
  });

  it("no duplicate dates", () => {
    const { timeline: tl } = build();
    const dates = tl.map((d) => d.date);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("works for single day", () => {
    const { timeline: tl } = build({ days: 1 });
    expect(tl).toHaveLength(1);
    expect(tl[0].date).toBe(jan(1));
  });
});

/* ── 2. Bucket correctness ───────────────────── */
describe("Domain bucket routing", () => {
  const doses: DoseRow[] = [
    { log_date: jan(1), domain_slug: "speech", dose_value: 10 },
    { log_date: jan(1), domain_slug: "pt", dose_value: 20 },
    { log_date: jan(1), domain_slug: "ot", dose_value: 15 },
    { log_date: jan(1), domain_slug: "cognitive", dose_value: 5 },
    { log_date: jan(1), domain_slug: "activity", dose_value: 30 },
  ];

  it("routes speech to speechMinutes", () => {
    const { timeline: tl } = build({ days: 1, doseRows: doses });
    expect(tl[0].speechMinutes).toBe(10);
  });

  it("routes pt+ot+cognitive to therapyMinutes", () => {
    const { timeline: tl } = build({ days: 1, doseRows: doses });
    expect(tl[0].therapyMinutes).toBe(40);
  });

  it("routes activity to activityMinutes", () => {
    const { timeline: tl } = build({ days: 1, doseRows: doses });
    expect(tl[0].activityMinutes).toBe(30);
  });

  it("totalMinutes = speech + therapy + activity", () => {
    const { timeline: tl } = build({ days: 1, doseRows: doses });
    expect(tl[0].totalMinutes).toBe(80);
  });

  it("unknown domain defaults to therapy bucket", () => {
    const futureDose: DoseRow[] = [
      { log_date: jan(1), domain_slug: "neuro_rehab", dose_value: 12 },
    ];
    const { timeline: tl } = build({ days: 1, doseRows: futureDose });
    expect(tl[0].therapyMinutes).toBe(12);
    expect(tl[0].speechMinutes).toBe(0);
    expect(tl[0].activityMinutes).toBe(0);
  });
});

/* ── 3. Summation correctness ────────────────── */
describe("Multi-log summation", () => {
  it("sums multiple logs for same domain+date", () => {
    const doses: DoseRow[] = [
      { log_date: jan(1), domain_slug: "speech", dose_value: 5 },
      { log_date: jan(1), domain_slug: "speech", dose_value: 8 },
      { log_date: jan(1), domain_slug: "speech", dose_value: 3 },
    ];
    const { timeline: tl } = build({ days: 1, doseRows: doses });
    expect(tl[0].speechMinutes).toBe(16);
  });

  it("keeps separate days separate", () => {
    const doses: DoseRow[] = [
      { log_date: jan(1), domain_slug: "speech", dose_value: 10 },
      { log_date: jan(2), domain_slug: "speech", dose_value: 20 },
    ];
    const { timeline: tl } = build({ days: 3, doseRows: doses });
    expect(tl[0].speechMinutes).toBe(10);
    expect(tl[1].speechMinutes).toBe(20);
    expect(tl[2].speechMinutes).toBe(0);
  });

  it("handles zero/NaN dose_value gracefully", () => {
    const doses: DoseRow[] = [
      { log_date: jan(1), domain_slug: "speech", dose_value: 0 },
      { log_date: jan(1), domain_slug: "pt", dose_value: NaN },
    ];
    const { timeline: tl } = build({ days: 1, doseRows: doses });
    expect(tl[0].speechMinutes).toBe(0);
    expect(tl[0].therapyMinutes).toBe(0);
  });
});

/* ── 4. hasAnySignal semantics ───────────────── */
describe("hasAnySignal", () => {
  it("false when no dose and no fatigue", () => {
    const { timeline: tl } = build({ days: 1 });
    expect(tl[0].hasAnySignal).toBe(false);
  });

  it("true when only fatigue recorded (no dose)", () => {
    const readiness: ReadinessRow[] = [{ checkin_date: jan(1), fatigue_rating: 2 }];
    const { timeline: tl } = build({ days: 1, readinessRows: readiness });
    expect(tl[0].hasAnySignal).toBe(true);
  });

  it("true when only dose logged (no fatigue)", () => {
    const doses: DoseRow[] = [{ log_date: jan(1), domain_slug: "activity", dose_value: 5 }];
    const { timeline: tl } = build({ days: 1, doseRows: doses });
    expect(tl[0].hasAnySignal).toBe(true);
  });

  it("true when both dose and fatigue present", () => {
    const readiness: ReadinessRow[] = [{ checkin_date: jan(1), fatigue_rating: 3 }];
    const doses: DoseRow[] = [{ log_date: jan(1), domain_slug: "speech", dose_value: 10 }];
    const { timeline: tl } = build({ days: 1, readinessRows: readiness, doseRows: doses });
    expect(tl[0].hasAnySignal).toBe(true);
  });
});

/* ── 5. Fatigue mapping ──────────────────────── */
describe("Fatigue rating", () => {
  it("maps fatigue to correct date", () => {
    const readiness: ReadinessRow[] = [
      { checkin_date: jan(3), fatigue_rating: 4 },
    ];
    const { timeline: tl } = build({ days: 5, readinessRows: readiness });
    expect(tl[0].fatigueRating).toBeNull();
    expect(tl[1].fatigueRating).toBeNull();
    expect(tl[2].fatigueRating).toBe(4);
    expect(tl[3].fatigueRating).toBeNull();
  });

  it("last readiness row wins if duplicates exist", () => {
    const readiness: ReadinessRow[] = [
      { checkin_date: jan(1), fatigue_rating: 2 },
      { checkin_date: jan(1), fatigue_rating: 5 },
    ];
    const { timeline: tl } = build({ days: 1, readinessRows: readiness });
    expect(tl[0].fatigueRating).toBe(5);
  });
});

/* ── 6. Data outside range is ignored ────────── */
describe("Out-of-range data", () => {
  it("ignores dose rows outside the timeline window", () => {
    const doses: DoseRow[] = [
      { log_date: "2024-12-31", domain_slug: "speech", dose_value: 99 },
      { log_date: jan(1), domain_slug: "speech", dose_value: 10 },
      { log_date: jan(15), domain_slug: "speech", dose_value: 99 },
    ];
    const { timeline: tl } = build({ days: 3, doseRows: doses });
    expect(tl[0].speechMinutes).toBe(10);
    expect(tl[1].speechMinutes).toBe(0);
    expect(tl[2].speechMinutes).toBe(0);
  });
});

/* ── 7. Golden patient fixture ───────────────── */
describe("Golden patient: predictable 14-day pattern", () => {
  const goldenStart = new Date(2025, 0, 1);
  const goldenDoses: DoseRow[] = [];
  const goldenReadiness: ReadinessRow[] = [];

  for (let i = 1; i <= 14; i++) {
    const date = jan(i);
    if (i % 2 === 1) goldenDoses.push({ log_date: date, domain_slug: "speech", dose_value: 10 });
    if (i % 2 === 0) goldenDoses.push({ log_date: date, domain_slug: "pt", dose_value: 20 });
    if (i >= 8) goldenDoses.push({ log_date: date, domain_slug: "activity", dose_value: 15 });
  }

  const fatigueValues = [2, 3, 4, 4, 5, 3];
  for (let i = 0; i < 6; i++) {
    goldenReadiness.push({ checkin_date: jan(9 + i), fatigue_rating: fatigueValues[i] });
  }

  const { timeline: tl } = buildSnapshotTimeline({
    startDate: goldenStart,
    days: 14,
    readinessRows: goldenReadiness,
    doseRows: goldenDoses,
  });

  it("has exactly 14 days", () => {
    expect(tl).toHaveLength(14);
  });

  it("speech on odd days = 10, even days = 0", () => {
    expect(tl[0].speechMinutes).toBe(10);
    expect(tl[1].speechMinutes).toBe(0);
    expect(tl[6].speechMinutes).toBe(10);
    expect(tl[7].speechMinutes).toBe(0);
  });

  it("therapy on even days = 20, odd days = 0", () => {
    expect(tl[0].therapyMinutes).toBe(0);
    expect(tl[1].therapyMinutes).toBe(20);
    expect(tl[13].therapyMinutes).toBe(20);
  });

  it("activity only for days 8-14 = 15", () => {
    expect(tl[6].activityMinutes).toBe(0);
    expect(tl[7].activityMinutes).toBe(15);
    expect(tl[13].activityMinutes).toBe(15);
  });

  it("fatigue recorded only days 9-14", () => {
    expect(tl[7].fatigueRating).toBeNull();
    expect(tl[8].fatigueRating).toBe(2);
    expect(tl[12].fatigueRating).toBe(5);
    expect(tl[13].fatigueRating).toBe(3);
  });

  it("hasAnySignal correct for each day", () => {
    tl.forEach((d) => expect(d.hasAnySignal).toBe(true));
  });

  it("totalMinutes correct for a mixed day (day 8: pt=20, activity=15)", () => {
    expect(tl[7].totalMinutes).toBe(35);
  });

  it("totalMinutes correct for speech-only day (day 1)", () => {
    expect(tl[0].totalMinutes).toBe(10);
  });
});

/* ── 8. Physical layer ───────────────────────── */
describe("Physical layer", () => {
  it("physical fields are null when no physical rows provided", () => {
    const { timeline: tl } = build({ days: 1 });
    expect(tl[0].steps).toBeNull();
    expect(tl[0].workoutMinutesObjective).toBeNull();
    expect(tl[0].activeMinutesObjective).toBeNull();
    expect(tl[0].sleepMinutes).toBeNull();
  });

  it("maps physical data to correct dates", () => {
    const physical: PhysicalRow[] = [
      { metric_date: jan(2), steps: 5000, active_minutes: 30, workout_minutes: 20, sleep_minutes: 420, source: "healthkit", last_sync_at: "2025-01-02T10:00:00Z" },
    ];
    const { timeline: tl } = build({ days: 3, physicalRows: physical });
    expect(tl[0].steps).toBeNull(); // day 1
    expect(tl[1].steps).toBe(5000); // day 2
    expect(tl[1].workoutMinutesObjective).toBe(20);
    expect(tl[1].activeMinutesObjective).toBe(30);
    expect(tl[1].sleepMinutes).toBe(420);
    expect(tl[2].steps).toBeNull(); // day 3
  });

  it("device source wins over manual", () => {
    const physical: PhysicalRow[] = [
      { metric_date: jan(1), steps: 1000, active_minutes: 10, workout_minutes: 5, sleep_minutes: null, source: "manual", last_sync_at: "2025-01-01T20:00:00Z" },
      { metric_date: jan(1), steps: 8000, active_minutes: 45, workout_minutes: 30, sleep_minutes: 480, source: "healthkit", last_sync_at: "2025-01-01T10:00:00Z" },
    ];
    const { timeline: tl } = build({ days: 1, physicalRows: physical });
    expect(tl[0].steps).toBe(8000); // healthkit wins
    expect(tl[0].activeMinutesObjective).toBe(45);
  });

  it("latest sync wins among device sources", () => {
    const physical: PhysicalRow[] = [
      { metric_date: jan(1), steps: 3000, active_minutes: 20, workout_minutes: null, sleep_minutes: null, source: "googlefit", last_sync_at: "2025-01-01T08:00:00Z" },
      { metric_date: jan(1), steps: 7000, active_minutes: 40, workout_minutes: null, sleep_minutes: null, source: "healthkit", last_sync_at: "2025-01-01T18:00:00Z" },
    ];
    const { timeline: tl } = build({ days: 1, physicalRows: physical });
    expect(tl[0].steps).toBe(7000); // healthkit with later sync
  });

  it("out-of-range physical rows are ignored", () => {
    const physical: PhysicalRow[] = [
      { metric_date: "2024-12-31", steps: 9999, active_minutes: null, workout_minutes: null, sleep_minutes: null, source: "healthkit", last_sync_at: null },
      { metric_date: jan(1), steps: 5000, active_minutes: null, workout_minutes: null, sleep_minutes: null, source: "healthkit", last_sync_at: null },
    ];
    const { timeline: tl } = build({ days: 1, physicalRows: physical });
    expect(tl[0].steps).toBe(5000); // in-range only
  });

  it("physicalMeta.coverageDays counts unique days with physical data", () => {
    const physical: PhysicalRow[] = [
      { metric_date: jan(1), steps: 100, active_minutes: null, workout_minutes: null, sleep_minutes: null, source: "healthkit", last_sync_at: null },
      { metric_date: jan(3), steps: 200, active_minutes: null, workout_minutes: null, sleep_minutes: null, source: "healthkit", last_sync_at: null },
    ];
    const { physicalMeta } = build({ days: 5, physicalRows: physical });
    expect(physicalMeta.coverageDays).toBe(2);
  });

  it("physicalMeta.sourcesSeen collects unique sources", () => {
    const physical: PhysicalRow[] = [
      { metric_date: jan(1), steps: 100, active_minutes: null, workout_minutes: null, sleep_minutes: null, source: "healthkit", last_sync_at: null },
      { metric_date: jan(2), steps: 200, active_minutes: null, workout_minutes: null, sleep_minutes: null, source: "googlefit", last_sync_at: null },
      { metric_date: jan(3), steps: 300, active_minutes: null, workout_minutes: null, sleep_minutes: null, source: "healthkit", last_sync_at: null },
    ];
    const { physicalMeta } = build({ days: 3, physicalRows: physical });
    expect(physicalMeta.sourcesSeen.sort()).toEqual(["googlefit", "healthkit"]);
  });

  it("physicalMeta.lastSyncAtMax is the latest sync time", () => {
    const physical: PhysicalRow[] = [
      { metric_date: jan(1), steps: 100, active_minutes: null, workout_minutes: null, sleep_minutes: null, source: "healthkit", last_sync_at: "2025-01-01T08:00:00Z" },
      { metric_date: jan(2), steps: 200, active_minutes: null, workout_minutes: null, sleep_minutes: null, source: "healthkit", last_sync_at: "2025-01-02T18:00:00Z" },
    ];
    const { physicalMeta } = build({ days: 3, physicalRows: physical });
    expect(physicalMeta.lastSyncAtMax).toBe("2025-01-02T18:00:00Z");
  });

  it("physicalMeta is empty when no physical rows", () => {
    const { physicalMeta } = build({ days: 3 });
    expect(physicalMeta.coverageDays).toBe(0);
    expect(physicalMeta.sourcesSeen).toEqual([]);
    expect(physicalMeta.lastSyncAtMax).toBeNull();
  });
});
