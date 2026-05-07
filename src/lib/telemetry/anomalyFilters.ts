// Pure helpers for telemetry anomaly URL-filter logic.
// Kept pure + framework-free so they're easy to test and reuse.

export type AnomalySeverity = "info" | "warn" | "error";

export interface AnomalyFilterShape {
  severity: AnomalySeverity | "all";
  rule: string; // rule_id or "all"
  slug: string; // exercise_slug or "all"
  session: string; // session_id or ""
}

export interface AnomalyLike {
  severity: string;
  rule_id: string;
  exercise_slug: string | null;
  session_id: string | null;
}

export const EMPTY_FILTERS: AnomalyFilterShape = {
  severity: "all",
  rule: "all",
  slug: "all",
  session: "",
};

/**
 * Read filters from a URLSearchParams instance. Unknown / missing values fall
 * back to the "all" / empty defaults so the URL is always interpretable.
 */
export function readAnomalyFiltersFromParams(params: URLSearchParams): AnomalyFilterShape {
  const sev = params.get("severity");
  const severity: AnomalySeverity | "all" =
    sev === "info" || sev === "warn" || sev === "error" ? sev : "all";
  return {
    severity,
    rule: params.get("rule") ?? "all",
    slug: params.get("slug") ?? "all",
    session: params.get("session") ?? "",
  };
}

/**
 * Produce the next URLSearchParams after toggling/setting a single filter key.
 * Default / empty values are stripped so the URL stays clean.
 */
export function nextAnomalyFilterParams(
  current: URLSearchParams,
  key: keyof AnomalyFilterShape,
  value: string | null,
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (!value || value === "all" || value === "") next.delete(key);
  else next.set(key, value);
  return next;
}

/** Does an anomaly pass the current filter set? */
export function matchesAnomalyFilter(a: AnomalyLike, f: AnomalyFilterShape): boolean {
  if (f.severity !== "all" && a.severity !== f.severity) return false;
  if (f.rule !== "all" && a.rule_id !== f.rule) return false;
  if (f.slug !== "all" && a.exercise_slug !== f.slug) return false;
  if (f.session && a.session_id !== f.session) return false;
  return true;
}

export function isAnomalyFilterActive(f: AnomalyFilterShape): boolean {
  return f.severity !== "all" || f.rule !== "all" || f.slug !== "all" || f.session !== "";
}
