import { describe, expect, it } from "vitest";
import { buildDomainExposure7d } from "./dailyLessonDomainExposure";

const windowStart = "2026-11-01T00:00:00.000Z";
const row = (exercise_slug: string, session_id: string | null, created_at = "2026-11-01T10:00:00.000Z") =>
  ({ exercise_slug, session_id, created_at });

describe("TodayFocus domain exposure reflects real completed game telemetry", () => {
  it("recognizes underscore events as lesson-domain games, including the multi-step alias", () => {
    const input = [
      row("photo_naming", "session-a"),
      row("photo_naming", "session-a"),
      row("dual_load_naming", "session-b"),
      row("multi_step_planning", "session-b"),
      row("minimal_pairs", "session-c"),
    ];
    const result = buildDomainExposure7d(input, windowStart);
    const byDomain = new Map(result.map(d => [d.domainSlug, d]));
    expect(byDomain.get("lexical_retrieval")).toMatchObject({ trialCount: 3, sessionCount: 2 });
    expect(byDomain.get("executive_function")).toMatchObject({ trialCount: 2, sessionCount: 1 });
    expect(byDomain.get("phonology")).toMatchObject({ trialCount: 1, sessionCount: 1 });
  });

  it("does not create phantom sessions or include out-of-window attempts", () => {
    const result = buildDomainExposure7d([
      row("photo_naming", "older", "2026-10-31T23:59:59.000Z"),
      row("photo_naming", null),
      row("photo_naming", "current"),
      row("photo_naming", "current"),
      { exercise_slug: null, session_id: "invalid", created_at: "2026-11-01T12:00:00Z" },
      { exercise_slug: "minimal_pairs", session_id: "no-date", created_at: "invalid" },
    ], windowStart);
    expect(result.find(x => x.domainSlug === "lexical_retrieval")).toMatchObject({
      trialCount: 3, sessionCount: 1,
    });
    expect(result.find(x => x.domainSlug === "phonology")).toMatchObject({ trialCount: 0, sessionCount: 0 });
  });

  it("returns no inferred domain usage when the cutoff is invalid", () => {
    expect(buildDomainExposure7d([row("photo_naming", "s")], "invalid")).toEqual([]);
  });
});
