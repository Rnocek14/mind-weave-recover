/**
 * Preserve the patient's exact lesson identity across browser refreshes.
 * A missing/invalid explicit URL scope never silently falls back to all
 * patients' daily practice; reviewQueue validates the returned ID before
 * selecting any data. Legacy direct /review-chat remains optional daily mode.
 */
export function resolveReviewSessionId(search: string, navigationState: unknown): string | undefined {
  const query = new URLSearchParams(search);
  if (query.has("lesson")) return query.get("lesson") ?? "";

  if (navigationState && typeof navigationState === "object" &&
    "sessionId" in navigationState &&
    typeof navigationState.sessionId === "string") {
    return navigationState.sessionId;
  }
  return undefined;
}
