import { beforeEach, describe, expect, it, vi } from "vitest";
import { readMasteryGate } from "../readMasteryGate";

const backend = vi.hoisted(() => ({
  mode: "error" as "error" | "throw" | "empty",
  reads: 0,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table !== "user_skill_mastery") throw Error("Unexpected table " + table);
      backend.reads++;
      const q = {
        select: () => q,
        eq: () => q,
        in: () => q,
        then: (
          resolve: (value: { data: unknown[] | null; error: {message: string} | null }) => unknown,
          reject: (reason: Error) => unknown,
        ) => {
          if (backend.mode === "throw") return Promise.reject(Error("synthetic timeout")).then(resolve, reject);
          const payload = backend.mode === "error"
            ? { data: null, error: { message: "synthetic unavailable" } }
            : { data: [], error: null };
          return Promise.resolve(payload).then(resolve, reject);
        },
      };
      return q;
    },
  },
}));

beforeEach(() => { backend.mode = "error"; backend.reads = 0; });

describe("longitudinal promotion check fails closed without penalizing new patients", () => {
  it.each(["error", "throw"] as const)("blocks promotion on %s instead of treating it as absent history", async mode => {
    backend.mode = mode;
    const result = await readMasteryGate({
      profileId: "synthetic-profile",
      exerciseSlug: "photo-naming",
      difficulty: 3,
    });
    expect(backend.reads).toBe(1);
    expect(result.verdict).toBe("block");
    expect(result.skills.length).toBeGreaterThan(0);
    expect(result.minMasteryScore).toBeNull();
  });

  it("does not permanently block a truly new patient with no mastery rows", async () => {
    backend.mode = "empty";
    const result = await readMasteryGate({
      profileId: "synthetic-profile",
      exerciseSlug: "photo-naming",
      difficulty: 3,
    });
    expect(result.verdict).toBe("skip");
    expect(result.skills.length).toBeGreaterThan(0);
  });

  it("receptive tasks remain outside expressive mastery even if the service is unavailable", async () => {
    const result = await readMasteryGate({
      profileId: "synthetic-profile",
      exerciseSlug: "minimal-pairs",
      difficulty: 3,
    });
    expect(result.verdict).toBe("skip");
    expect(backend.reads).toBe(0);
  });
});
