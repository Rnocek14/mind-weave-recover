import { describe, expect, it } from "vitest";
import { resolveReviewSessionId } from "./reviewRouteScope";

describe("lesson review routing keeps patient practice scoped", () => {
  it("preserves a lesson identity after browser refresh when router state is lost", () => {
    expect(resolveReviewSessionId("?lesson=session-123", null)).toBe("session-123");
  });
  it("never falls back to stale navigation state when URL requests another lesson", () => {
    expect(resolveReviewSessionId("?lesson=session-b", { sessionId: "session-a" }))
      .toBe("session-b");
  });
  it("returns an explicitly empty scope instead of accidentally switching to daily review", () => {
    expect(resolveReviewSessionId("?lesson=", { sessionId: "session-a" })).toBe("");
  });
  it("supports prior state-only lesson links", () => {
    expect(resolveReviewSessionId("", { sessionId: "session-a" })).toBe("session-a");
  });
  it("uses daily mode only for routes with no requested lesson", () => {
    expect(resolveReviewSessionId("", null)).toBeUndefined();
    expect(resolveReviewSessionId("", { sessionId: 123 })).toBeUndefined();
  });
});
