import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applySessionToState,
  loadProgressionState,
  saveProgressionState,
} from "../clinicalProgression";

const store = vi.hoisted(() => ({
  failRead: false,
  throwRead: false,
  upserts: [] as Array<Record<string, unknown>>,
  rows: new Map<string, Record<string, unknown>>(),
  filters: [] as Array<[string, unknown]>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: (key: string, value: unknown) => {
          store.filters.push([key, value]);
          return q;
        },
        maybeSingle: async () => {
          if (store.throwRead) throw Error("synthetic network failure");
          if (store.failRead) return { data: null, error: { message: "synthetic database failure" } };
          const profile = store.filters.find(([key]) => key === "profile_id")?.[1];
          const slug = store.filters.find(([key]) => key === "exercise_slug")?.[1];
          return { data: store.rows.get(profile + "::" + slug) ?? null, error: null };
        },
        upsert: async (row: Record<string, unknown>) => {
          store.upserts.push(row);
          store.rows.set(row.profile_id + "::" + row.exercise_slug, row);
          return { error: null };
        },
        insert: async () => ({ error: null }),
      };
      if (!["clinical_progression_state", "progression_events"].includes(table)) throw Error(table);
      return q;
    },
  },
}));

const ids = { userId: "synthetic-owner", profileId: "synthetic-patient", exerciseSlug: "photo-naming" };

beforeEach(() => {
  store.failRead = false;
  store.throwRead = false;
  store.upserts = [];
  store.rows.clear();
  store.filters = [];
});

describe("patient progression safety: unavailable is NEVER a new Level 1", () => {
  it.each(["query error", "network exception"])("fails closed on %s and prevents destructive save", async failure => {
    store.rows.set(ids.profileId + "::" + ids.exerciseSlug, {
      user_id: ids.userId, profile_id: ids.profileId, exercise_slug: ids.exerciseSlug,
      current_level: 6, progress_pct: 40,
    });
    if (failure === "query error") store.failRead = true;
    else store.throwRead = true;

    const loaded = await loadProgressionState(ids);
    expect(loaded.loadUnavailable).toBe(true);
    expect(store.filters).toContainEqual(["user_id", ids.userId]);
    const afterAttempt = applySessionToState(loaded, {
      trials: Array.from({ length: 20 }, () => ({ correct: true, support: "independent" as const })),
      evidenceMet: true,
    });
    expect(afterAttempt.loadUnavailable).toBe(true);
    expect(afterAttempt).toEqual(loaded);
    const save = await saveProgressionState(afterAttempt);
    expect(save.ok).toBe(false);
    expect(store.upserts).toHaveLength(0);
    expect(store.rows.get(ids.profileId + "::" + ids.exerciseSlug)?.current_level).toBe(6);
  });

  it("distinguishes a genuinely absent row (new profile) from a failed read", async () => {
    const loaded = await loadProgressionState(ids);
    expect(loaded.currentLevel).toBe(1);
    expect(loaded.loadUnavailable).not.toBe(true);
    const result = await saveProgressionState(loaded);
    expect(result.ok).toBe(true);
    expect(store.upserts).toHaveLength(1);
  });
});
