import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchRecentExerciseUsage, calculateRecencyPenalties } from "./exerciseRecency";
import { toLessonExerciseSlug } from "./exerciseSlugNormalizer";

const backend = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  fail: false,
  scope: [] as Array<[string, unknown]>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table !== "exercise_events") throw Error("Unexpected table " + table);
      const q = {
        select: () => q,
        not: () => q,
        gte: () => q,
        eq: (name: string, value: unknown) => { backend.scope.push([name, value]); return q; },
        order: () => q,
        limit: () => q,
        then: (resolve: (value: { data: unknown[] | null; error: { message: string } | null }) => unknown) =>
          Promise.resolve(backend.fail
            ? { data: null, error: { message: "synthetic query failure" } }
            : { data: backend.rows, error: null }).then(resolve),
      };
      return q;
    },
  },
}));

beforeEach(() => { backend.rows = []; backend.fail = false; backend.scope = []; });

describe("real rotation uses the same route IDs as dailyLessonEngine", () => {
  it("converts telemetry underscores to lesson routes, including special multi-step planning", () => {
    expect(toLessonExerciseSlug("photo_naming")).toBe("photo-naming");
    expect(toLessonExerciseSlug("minimal_pairs")).toBe("minimal-pairs");
    expect(toLessonExerciseSlug("multi_step_planning")).toBe("multi-step-plan");
    expect(toLessonExerciseSlug("multi-step-plan")).toBe("multi-step-plan");
  });

  it("records a used game as recent so the daily planner can rotate it", async () => {
    const now = new Date().toISOString();
    backend.rows = [
      { exercise_slug: "photo_naming", session_id: "session1", created_at: now },
      { exercise_slug: "multi_step_planning", session_id: "session1", created_at: now },
      { exercise_slug: "photo_naming", session_id: "session2", created_at: now },
      { exercise_slug: "minimal_pairs", session_id: "session3", created_at: now },
    ];
    const usage = await fetchRecentExerciseUsage("synthetic-owner", "synthetic-patient");
    expect(backend.scope).toContainEqual(["sessions.user_id", "synthetic-owner"]);
    expect(backend.scope).toContainEqual(["sessions.profile_id", "synthetic-patient"]);
    expect(usage.map(row => row.exerciseSlug).sort()).toEqual([
      "minimal-pairs", "multi-step-plan", "photo-naming",
    ]);
    const penalties = calculateRecencyPenalties(usage);
    expect(penalties.exercisePenalties.get("photo-naming")).toBe(-5);
    expect(penalties.exercisePenalties.get("multi-step-plan")).toBe(-5);
    expect(penalties.componentPenalties.get("photo-naming-game")).toBe(-1);
  });

  it("does not leak another patient's history into the planner on missing scope or failed reads", async () => {
    backend.rows = [{ exercise_slug: "photo_naming", session_id: "s", created_at: new Date().toISOString() }];
    expect(await fetchRecentExerciseUsage("synthetic-owner", undefined)).toEqual([]);
    expect(backend.scope).toHaveLength(0);
    backend.fail = true;
    expect(await fetchRecentExerciseUsage("synthetic-owner", "synthetic-patient")).toEqual([]);
    backend.fail = false;
    backend.rows = Array.from({ length: 1001 }, () =>
      ({ exercise_slug: "photo_naming", session_id: "s", created_at: new Date().toISOString() }));
    expect(await fetchRecentExerciseUsage("synthetic-owner", "synthetic-patient")).toEqual([]);
  });
});
