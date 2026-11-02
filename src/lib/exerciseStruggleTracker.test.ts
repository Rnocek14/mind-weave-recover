import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchExerciseStruggleData } from "./exerciseStruggleTracker";

const backend = vi.hoisted(() => ({
  fail: false,
  rows: [] as Array<Record<string, unknown>>,
  calls: [] as Array<[string, unknown]>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table !== "exercise_events") throw Error("Unexpected table: " + table);
      const q = {
        select: () => q,
        not: () => q,
        gte: () => q,
        eq: (column: string, value: unknown) => { backend.calls.push([column, value]); return q; },
        limit: () => q,
        then: (
          resolve: (value: { data: unknown[] | null; error: { message: string } | null }) => unknown,
        ) => Promise.resolve(backend.fail
          ? { data: null, error: { message: "synthetic read error" } }
          : { data: backend.rows, error: null }).then(resolve),
      };
      return q;
    },
  },
}));

const trial = (score: number, extras: Record<string, unknown> = {}) => ({
  exercise_slug: "photo_naming",
  score,
  cue_level: 0,
  reaction_time_ms: 1000,
  session_id: "synthetic-session",
  validity_label: "valid_attempt",
  counts_toward_score: true,
  ...extras,
});

beforeEach(() => { backend.fail = false; backend.rows = []; backend.calls = []; });

describe("planner struggle detector cannot punish invalid recordings", () => {
  it("ignores unverified/non-patient and audio-noise rows rather than causing a false struggle flag", async () => {
    backend.rows = [
      ...Array.from({length: 8}, () => trial(0.9)),
      ...Array.from({length: 12}, () => trial(0, {
        validity_label: "background_noise",
        counts_toward_score: false,
        cue_level: 3,
        reaction_time_ms: null,
      })),
      trial(0, { clinician_validity_override: "not_patient" }),
    ];
    const result = await fetchExerciseStruggleData("synthetic-owner", "synthetic-patient");
    expect(backend.calls).toContainEqual(["sessions.user_id", "synthetic-owner"]);
    expect(backend.calls).toContainEqual(["sessions.profile_id", "synthetic-patient"]);
    expect(result).toHaveLength(1);
    expect(result[0].exerciseSlug).toBe('photo-naming');
    expect(result[0]).toMatchObject({
      trialCount: 8,
      avgCueLevel: 0,
      timeoutRate: 0,
      isStruggling: false,
    });
    expect(result[0].avgAccuracy).toBeCloseTo(0.9);
  });

  it("identifies genuine consistently low partial scores instead of interpreting all positive scores as correct", async () => {
    backend.rows = Array.from({length: 9}, () => trial(0.25));
    const result = await fetchExerciseStruggleData("synthetic-owner", "synthetic-patient");
    expect(result).toHaveLength(1);
    expect(result[0].avgAccuracy).toBeCloseTo(0.25);
    expect(result[0].isStruggling).toBe(true);
    expect(result[0].struggleSignals.join(" ")).toContain("Low accuracy");
  });

  it("abstains if the database read failed or a limit could hide other results", async () => {
    backend.fail = true;
    expect(await fetchExerciseStruggleData("synthetic-owner", "synthetic-patient")).toEqual([]);
    backend.fail = false;
    backend.rows = Array.from({length: 1001}, () => trial(0.1));
    expect(await fetchExerciseStruggleData("synthetic-owner", "synthetic-patient")).toEqual([]);
  });
});
