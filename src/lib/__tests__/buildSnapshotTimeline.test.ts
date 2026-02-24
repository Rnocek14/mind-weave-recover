import { describe, it, expect } from "vitest";
import {
  buildSnapshotTimeline,
  type ReadinessRow,
  type DoseRow,
} from "../buildSnapshotTimeline";

/* ── helpers ─────────────────────────────────── */
const jan = (day: number) => `2025-01-${String(day).padStart(2, "0")}`;
const startDate = new Date(2025, 0, 1); // Jan 1 2025

/* ── 1. Date continuity ──────────────────────── */
describe("Date continuity", () => {
  it("produces exactly N days", () => {
    const tl = buildSnapshotTimeline({ startDate, days: 14, readinessRows: [], doseRows: [] });
    expect(tl).toHaveLength(14);
  });

  it("dates are contiguous and in order", () => {
    const tl = buildSnapshotTimeline({ startDate, days: 14, readinessRows: [], doseRows: [] });
    for (let i = 0; i < tl.length; i++) {
      expect(tl[i].date).toBe(jan(i + 1));
    }
  });

  it("no duplicate dates", () => {
    const tl = buildSnapshotTimeline({ startDate, days: 14, readinessRows: [], doseRows: [] });
    const dates = tl.map((d) => d.date);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("works for single day", () => {
    const tl = buildSnapshotTimeline({ startDate, days: 1, readinessRows: [], doseRows: [] });
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
    const tl = buildSnapshotTimeline({ startDate, days: 1, readinessRows: [], doseRows: doses });
    expect(tl[0].speechMinutes).toBe(10);
  });

  it("routes pt+ot+cognitive to therapyMinutes", () => {
    const tl = buildSnapshotTimeline({ startDate, days: 1, readinessRows: [], doseRows: doses });
    expect(tl[0].therapyMinutes).toBe(40); // 20+15+5
  });

  it("routes activity to activityMinutes", () => {
    const tl = buildSnapshotTimeline({ startDate, days: 1, readinessRows: [], doseRows: doses });
    expect(tl[0].activityMinutes).toBe(30);
  });

  it("totalMinutes = speech + therapy + activity", () => {
    const tl = buildSnapshotTimeline({ startDate, days: 1, readinessRows: [], doseRows: doses });
    expect(tl[0].totalMinutes).toBe(80); // 10+40+30
  });

  it("unknown domain defaults to therapy bucket", () => {
    const futureDose: DoseRow[] = [
      { log_date: jan(1), domain_slug: "neuro_rehab", dose_value: 12 },
    ];
    const tl = buildSnapshotTimeline({ startDate, days: 1, readinessRows: [], doseRows: futureDose });
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
    const tl = buildSnapshotTimeline({ startDate, days: 1, readinessRows: [], doseRows: doses });
    expect(tl[0].speechMinutes).toBe(16);
  });

  it("keeps separate days separate", () => {
    const doses: DoseRow[] = [
      { log_date: jan(1), domain_slug: "speech", dose_value: 10 },
      { log_date: jan(2), domain_slug: "speech", dose_value: 20 },
    ];
    const tl = buildSnapshotTimeline({ startDate, days: 3, readinessRows: [], doseRows: doses });
    expect(tl[0].speechMinutes).toBe(10);
    expect(tl[1].speechMinutes).toBe(20);
    expect(tl[2].speechMinutes).toBe(0);
  });

  it("handles zero/NaN dose_value gracefully", () => {
    const doses: DoseRow[] = [
      { log_date: jan(1), domain_slug: "speech", dose_value: 0 },
      { log_date: jan(1), domain_slug: "pt", dose_value: NaN },
    ];
    const tl = buildSnapshotTimeline({ startDate, days: 1, readinessRows: [], doseRows: doses });
    expect(tl[0].speechMinutes).toBe(0);
    expect(tl[0].therapyMinutes).toBe(0);
  });
});

/* ── 4. hasAnySignal semantics ───────────────── */
describe("hasAnySignal", () => {
  it("false when no dose and no fatigue", () => {
    const tl = buildSnapshotTimeline({ startDate, days: 1, readinessRows: [], doseRows: [] });
    expect(tl[0].hasAnySignal).toBe(false);
  });

  it("true when only fatigue recorded (no dose)", () => {
    const readiness: ReadinessRow[] = [{ checkin_date: jan(1), fatigue_rating: 2 }];
    const tl = buildSnapshotTimeline({ startDate, days: 1, readinessRows: readiness, doseRows: [] });
    expect(tl[0].hasAnySignal).toBe(true);
  });

  it("true when only dose logged (no fatigue)", () => {
    const doses: DoseRow[] = [{ log_date: jan(1), domain_slug: "activity", dose_value: 5 }];
    const tl = buildSnapshotTimeline({ startDate, days: 1, readinessRows: [], doseRows: doses });
    expect(tl[0].hasAnySignal).toBe(true);
  });

  it("true when both dose and fatigue present", () => {
    const readiness: ReadinessRow[] = [{ checkin_date: jan(1), fatigue_rating: 3 }];
    const doses: DoseRow[] = [{ log_date: jan(1), domain_slug: "speech", dose_value: 10 }];
    const tl = buildSnapshotTimeline({ startDate, days: 1, readinessRows: readiness, doseRows: doses });
    expect(tl[0].hasAnySignal).toBe(true);
  });
});

/* ── 5. Fatigue mapping ──────────────────────── */
describe("Fatigue rating", () => {
  it("maps fatigue to correct date", () => {
    const readiness: ReadinessRow[] = [
      { checkin_date: jan(3), fatigue_rating: 4 },
    ];
    const tl = buildSnapshotTimeline({ startDate, days: 5, readinessRows: readiness, doseRows: [] });
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
    const tl = buildSnapshotTimeline({ startDate, days: 1, readinessRows: readiness, doseRows: [] });
    // Map.set overwrites → last value wins
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
    // Only jan(1) falls in the 3-day window starting jan 1
    const tl = buildSnapshotTimeline({ startDate, days: 3, readinessRows: [], doseRows: doses });
    expect(tl[0].speechMinutes).toBe(10);
    // Out-of-range rows are indexed but never hit a timeline slot
    expect(tl[1].speechMinutes).toBe(0);
    expect(tl[2].speechMinutes).toBe(0);
  });
});

/* ── 7. Golden patient fixture ───────────────── */
describe("Golden patient: predictable 14-day pattern", () => {
  const goldenStart = new Date(2025, 0, 1);
  const goldenDoses: DoseRow[] = [];
  const goldenReadiness: ReadinessRow[] = [];

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

  const tl = buildSnapshotTimeline({
    startDate: goldenStart,
    days: 14,
    readinessRows: goldenReadiness,
    doseRows: goldenDoses,
  });

  it("has exactly 14 days", () => {
    expect(tl).toHaveLength(14);
  });

  it("speech on odd days = 10, even days = 0", () => {
    expect(tl[0].speechMinutes).toBe(10); // day 1 (odd)
    expect(tl[1].speechMinutes).toBe(0);  // day 2 (even)
    expect(tl[6].speechMinutes).toBe(10); // day 7 (odd)
    expect(tl[7].speechMinutes).toBe(0);  // day 8 (even)
  });

  it("therapy on even days = 20, odd days = 0", () => {
    expect(tl[0].therapyMinutes).toBe(0);  // day 1
    expect(tl[1].therapyMinutes).toBe(20); // day 2
    expect(tl[13].therapyMinutes).toBe(20); // day 14
  });

  it("activity only for days 8-14 = 15", () => {
    expect(tl[6].activityMinutes).toBe(0);  // day 7
    expect(tl[7].activityMinutes).toBe(15); // day 8
    expect(tl[13].activityMinutes).toBe(15); // day 14
  });

  it("fatigue recorded only days 9-14", () => {
    expect(tl[7].fatigueRating).toBeNull(); // day 8
    expect(tl[8].fatigueRating).toBe(2);    // day 9
    expect(tl[12].fatigueRating).toBe(5);   // day 13
    expect(tl[13].fatigueRating).toBe(3);   // day 14
  });

  it("hasAnySignal correct for each day", () => {
    // Every day has either speech or therapy, so all should be true
    tl.forEach((d) => expect(d.hasAnySignal).toBe(true));
  });

  it("totalMinutes correct for a mixed day (day 8: pt=20, activity=15)", () => {
    expect(tl[7].totalMinutes).toBe(35); // 0 speech + 20 pt + 15 activity
  });

  it("totalMinutes correct for speech-only day (day 1)", () => {
    expect(tl[0].totalMinutes).toBe(10);
  });
});
