/**
 * Legacy homepage score tiles use the same scored-trial denominator as the
 * clinical summary: no-response, manual confirmation and practice-only events
 * stay in participation telemetry, never inflate verified language accuracy.
 * Historical events without a score eligibility flag keep prior behavior.
 */
export function summarizeVerifiedScoreEvents(
  events: Array<{ score: number | null; counts_toward_score: boolean | null }> | null | undefined,
): { correct: number; total: number } {
  const scored = (events ?? []).filter(event =>
    typeof event.score === 'number' &&
    Number.isFinite(event.score) &&
    event.counts_toward_score !== false,
  );
  return {
    correct: scored.filter(event => (event.score ?? 0) > 0).length,
    total: scored.length,
  };
}
