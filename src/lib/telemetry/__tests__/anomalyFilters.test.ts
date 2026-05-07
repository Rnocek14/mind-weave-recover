import { describe, it, expect } from "vitest";
import {
  EMPTY_FILTERS,
  readAnomalyFiltersFromParams,
  nextAnomalyFilterParams,
  matchesAnomalyFilter,
  isAnomalyFilterActive,
  type AnomalyLike,
} from "../anomalyFilters";

const A = (p: Partial<AnomalyLike> = {}): AnomalyLike => ({
  severity: "warn",
  rule_id: "D2",
  exercise_slug: "photo_naming",
  session_id: "sess-1",
  ...p,
});

describe("readAnomalyFiltersFromParams", () => {
  it("returns defaults for empty params", () => {
    expect(readAnomalyFiltersFromParams(new URLSearchParams())).toEqual(EMPTY_FILTERS);
  });

  it("parses all known keys", () => {
    const p = new URLSearchParams("severity=error&rule=D4&slug=photo_naming&session=abc");
    expect(readAnomalyFiltersFromParams(p)).toEqual({
      severity: "error",
      rule: "D4",
      slug: "photo_naming",
      session: "abc",
    });
  });

  it("falls back to 'all' for unknown severity values", () => {
    const p = new URLSearchParams("severity=fatal");
    expect(readAnomalyFiltersFromParams(p).severity).toBe("all");
  });
});

describe("nextAnomalyFilterParams", () => {
  it("sets a value", () => {
    const next = nextAnomalyFilterParams(new URLSearchParams(), "rule", "D2");
    expect(next.get("rule")).toBe("D2");
  });

  it("strips defaults ('all' / '') from the URL", () => {
    const cur = new URLSearchParams("rule=D2&severity=warn&session=abc");
    const a = nextAnomalyFilterParams(cur, "rule", "all");
    expect(a.has("rule")).toBe(false);
    const b = nextAnomalyFilterParams(a, "session", "");
    expect(b.has("session")).toBe(false);
    const c = nextAnomalyFilterParams(b, "severity", null);
    expect(c.has("severity")).toBe(false);
    expect(c.toString()).toBe("");
  });

  it("composes multiple filter changes without losing prior keys", () => {
    let p = new URLSearchParams();
    p = nextAnomalyFilterParams(p, "severity", "error");
    p = nextAnomalyFilterParams(p, "rule", "D4");
    p = nextAnomalyFilterParams(p, "slug", "photo_naming");
    p = nextAnomalyFilterParams(p, "session", "sess-1");
    expect(readAnomalyFiltersFromParams(p)).toEqual({
      severity: "error",
      rule: "D4",
      slug: "photo_naming",
      session: "sess-1",
    });
  });

  it("replaces the value when set twice (no duplicates)", () => {
    let p = new URLSearchParams("rule=D1");
    p = nextAnomalyFilterParams(p, "rule", "D2");
    expect(p.getAll("rule")).toEqual(["D2"]);
  });
});

describe("matchesAnomalyFilter", () => {
  it("passes everything when filters are empty", () => {
    expect(matchesAnomalyFilter(A(), EMPTY_FILTERS)).toBe(true);
  });

  it("filters by severity", () => {
    expect(matchesAnomalyFilter(A({ severity: "warn" }), { ...EMPTY_FILTERS, severity: "error" })).toBe(false);
    expect(matchesAnomalyFilter(A({ severity: "error" }), { ...EMPTY_FILTERS, severity: "error" })).toBe(true);
  });

  it("filters by rule", () => {
    expect(matchesAnomalyFilter(A({ rule_id: "D2" }), { ...EMPTY_FILTERS, rule: "D4" })).toBe(false);
    expect(matchesAnomalyFilter(A({ rule_id: "D4" }), { ...EMPTY_FILTERS, rule: "D4" })).toBe(true);
  });

  it("filters by slug, treating null as a non-match", () => {
    expect(matchesAnomalyFilter(A({ exercise_slug: null }), { ...EMPTY_FILTERS, slug: "photo_naming" })).toBe(false);
  });

  it("filters by session", () => {
    expect(matchesAnomalyFilter(A({ session_id: "x" }), { ...EMPTY_FILTERS, session: "y" })).toBe(false);
    expect(matchesAnomalyFilter(A({ session_id: "y" }), { ...EMPTY_FILTERS, session: "y" })).toBe(true);
  });

  it("composes filters with AND semantics", () => {
    const f = { severity: "error" as const, rule: "D4", slug: "photo_naming", session: "sess-1" };
    expect(matchesAnomalyFilter(A({ severity: "error", rule_id: "D4" }), f)).toBe(true);
    expect(matchesAnomalyFilter(A({ severity: "warn", rule_id: "D4" }), f)).toBe(false);
  });
});

describe("isAnomalyFilterActive", () => {
  it("is false for empty defaults", () => {
    expect(isAnomalyFilterActive(EMPTY_FILTERS)).toBe(false);
  });
  it("is true when any filter is set", () => {
    expect(isAnomalyFilterActive({ ...EMPTY_FILTERS, rule: "D2" })).toBe(true);
    expect(isAnomalyFilterActive({ ...EMPTY_FILTERS, session: "abc" })).toBe(true);
  });
});

describe("deep-link replay (round-trip)", () => {
  it("URL → filters → URL is stable", () => {
    const start = new URLSearchParams("severity=warn&rule=D2&slug=photo_naming&session=sess-1");
    const filters = readAnomalyFiltersFromParams(start);
    let rebuilt = new URLSearchParams();
    rebuilt = nextAnomalyFilterParams(rebuilt, "severity", filters.severity);
    rebuilt = nextAnomalyFilterParams(rebuilt, "rule", filters.rule);
    rebuilt = nextAnomalyFilterParams(rebuilt, "slug", filters.slug);
    rebuilt = nextAnomalyFilterParams(rebuilt, "session", filters.session);
    expect(readAnomalyFiltersFromParams(rebuilt)).toEqual(filters);
  });

  it("clearing all keys yields an empty query string", () => {
    let p = new URLSearchParams("severity=error&rule=D4&slug=photo_naming&session=sess-1");
    (["severity", "rule", "slug", "session"] as const).forEach((k) => {
      p = nextAnomalyFilterParams(p, k, k === "session" ? "" : "all");
    });
    expect(p.toString()).toBe("");
  });
});
