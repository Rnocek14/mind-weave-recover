import { describe, it, expect } from "vitest";
import {
  computeCarryover,
  computeTrend,
  selectCarryoverPriorities,
  daysBetween,
  STRONG_WINDOW_DAYS,
  FADING_AFTER_DAYS,
  LOST_AFTER_RELEASES,
  type WordLedger,
} from "@/lib/transferLedger";

const L = (word: string, events: Array<[string, WordLedger["events"][0]["tier"]]>): WordLedger => ({
  word,
  category: "generic",
  events: events.map(([day, tier]) => ({ day, tier })),
});

const TODAY = "2026-07-18";

describe("carryover status — the per-word forgetting curve", () => {
  it("practiced today, no conversation yet → new", () => {
    const c = computeCarryover(L("garden", [[TODAY, "practice"]]), TODAY);
    expect(c.status).toBe("new");
  });

  it("used spontaneously in conversation this week → strong", () => {
    const c = computeCarryover(
      L("garden", [["2026-07-10", "practice"], ["2026-07-15", "spontaneous"]]),
      TODAY,
    );
    expect(c.status).toBe("strong");
    expect(c.spontaneousCount).toBe(1);
  });

  it("conversational use has gone stale → fading", () => {
    const staleDay = "2026-07-01"; // > STRONG_WINDOW_DAYS ago
    const c = computeCarryover(
      L("garden", [["2026-06-28", "practice"], [staleDay, "elicited"]]),
      TODAY,
    );
    expect(daysBetween(staleDay, TODAY)).toBeGreaterThan(STRONG_WINDOW_DAYS);
    expect(c.status).toBe("fading");
  });

  it("practiced a while ago but NEVER surfaced in conversation → fading", () => {
    const oldPractice = "2026-07-10"; // >= FADING_AFTER_DAYS ago
    const c = computeCarryover(L("garden", [[oldPractice, "practice"]]), TODAY);
    expect(daysBetween(oldPractice, TODAY)).toBeGreaterThanOrEqual(FADING_AFTER_DAYS);
    expect(c.status).toBe("fading");
  });

  it("repeatedly released in conversation without production → lost", () => {
    const events: Array<[string, WordLedger["events"][0]["tier"]]> = [["2026-07-10", "practice"]];
    for (let i = 0; i < LOST_AFTER_RELEASES; i++) events.push([`2026-07-1${5 + i}`, "released"]);
    const c = computeCarryover(L("garden", events), TODAY);
    expect(c.status).toBe("lost");
  });

  it("a production after releases resets the lost counter (recovery is honored)", () => {
    const c = computeCarryover(
      L("garden", [
        ["2026-07-10", "released"],
        ["2026-07-12", "released"],
        ["2026-07-16", "cued"],
      ]),
      TODAY,
    );
    expect(c.status).toBe("strong");
    expect(c.releasedCount).toBe(0);
  });
});

describe("trendline", () => {
  it("aggregates conversational events per day, excluding practice, within the window", () => {
    const trend = computeTrend(
      [
        L("garden", [["2026-07-16", "spontaneous"], ["2026-07-16", "practice"]]),
        L("spoon", [["2026-07-16", "elicited"], ["2026-07-17", "cued"]]),
        L("old", [["2026-06-01", "spontaneous"]]), // outside 14-day window
      ],
      TODAY,
    );
    expect(trend).toEqual([
      { day: "2026-07-16", spontaneous: 1, elicited: 1, cued: 0, released: 0 },
      { day: "2026-07-17", spontaneous: 0, elicited: 0, cued: 1, released: 0 },
    ]);
  });
});

describe("closed-loop scheduling", () => {
  it("selects fading words first, then lost, never strong or new", () => {
    const ledgers = [
      L("strongword", [["2026-07-16", "spontaneous"]]),
      L("fadingword", [["2026-07-10", "practice"]]),
      L("lostword", [["2026-07-11", "released"], ["2026-07-12", "released"]]),
      L("newword", [[TODAY, "practice"]]),
    ];
    const picks = selectCarryoverPriorities(ledgers, TODAY, 5);
    expect(picks.map((p) => p.word)).toEqual(["fadingword", "lostword"]);
  });

  it("respects the limit", () => {
    const ledgers = Array.from({ length: 6 }, (_, i) => L(`fade${i}`, [["2026-07-01", "practice"]]));
    expect(selectCarryoverPriorities(ledgers, TODAY, 2).length).toBe(2);
  });
});

describe("date math", () => {
  it("handles month/year boundaries", () => {
    expect(daysBetween("2026-06-30", "2026-07-01")).toBe(1);
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
    expect(daysBetween("2026-07-18", "2026-07-18")).toBe(0);
  });
});
