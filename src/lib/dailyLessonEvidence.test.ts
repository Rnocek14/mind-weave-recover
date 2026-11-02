import { describe, expect, it } from "vitest";
import { aggregatePerformanceSignals } from "./dailyLessonEngine";

const event = (score: number | null, created_at: string, extra: Record<string, unknown> = {}) => ({
  exercise_slug: "photo_naming",
  score,
  created_at,
  validity_label: "valid_attempt",
  counts_toward_score: true,
  reaction_time_ms: 1500,
  ...extra,
});

describe("daily personalization uses only reliable app task observations", () => {
  it("does not turn speech noise, unconfirmed speaker or coach conversation into weak practice", () => {
    const trials = [
      event(0.8, "2026-10-30T10:00:00Z"),
      event(0, "2026-10-30T10:01:00Z", {
        validity_label: "background_noise",
        counts_toward_score: false,
        reaction_time_ms: null,
        error_type: "phonological",
      }),
      event(0, "2026-10-30T10:02:00Z", {
        clinician_validity_override: "not_patient",
        reaction_time_ms: null,
      }),
      event(0, "2026-10-30T10:03:00Z", {
        exercise_slug: "conversation_coach", reaction_time_ms: null,
      }),
    ];
    const signals = aggregatePerformanceSignals(trials, []);
    expect(signals.avgAccuracy).toBeCloseTo(0.8);
    expect(signals.timeoutRate).toBe(0);
    expect(signals.errorTypes.phonological).toBe(0);
    expect(signals.fatigueLevel).toBe("low");
  });

  it("normalizes accepted 0–1 and 0–100 task scores without converting partial credit into full success", () => {
    const signals = aggregatePerformanceSignals([
      event(0.5, "2026-10-30T10:00:00Z"),
      event(75, "2026-10-30T10:01:00Z"),
      event(1, "2026-10-30T10:02:00Z"),
    ], []);
    expect(signals.avgAccuracy).toBeCloseTo(0.75);
  });

  it("treats entirely unscored audio as insufficient evidence, not patient failure", () => {
    const signals = aggregatePerformanceSignals([
      event(0, "2026-10-30T10:00:00Z", { validity_label: "no_response", counts_toward_score: false }),
      event(null, "2026-10-30T10:01:00Z"),
    ], []);
    expect(signals.avgAccuracy).toBe(0.5);
    expect(signals.timeoutRate).toBe(0.1);
    expect(signals.fatigueLevel).toBe("low");
  });

  it("uses chronological response times, even when the database returns newest-first", () => {
    const improving = [
      event(1, "2026-10-30T10:04:00Z", { reaction_time_ms: 1000 }),
      event(1, "2026-10-30T10:03:00Z", { reaction_time_ms: 1200 }),
      event(1, "2026-10-30T10:02:00Z", { reaction_time_ms: 3500 }),
      event(1, "2026-10-30T10:01:00Z", { reaction_time_ms: 4000 }),
    ];
    expect(aggregatePerformanceSignals(improving, []).fatigueLevel).toBe("low");
    const slowing = improving.map((trial, i) => ({...trial, reaction_time_ms: improving[3-i].reaction_time_ms}));
    expect(aggregatePerformanceSignals(slowing, []).fatigueLevel).toBe("high");
  });

  it("ignores missing and non-finite reaction times rather than generating NaN", () => {
    const signals = aggregatePerformanceSignals([
      event(1, "2026-10-30T10:00:00Z", { reaction_time_ms: undefined }),
      event(1, "2026-10-30T10:01:00Z", { reaction_time_ms: Infinity }),
    ], []);
    expect(Number.isFinite(signals.avgReactionTime)).toBe(true);
    expect(signals.avgReactionTime).toBe(3000);
  });
});
