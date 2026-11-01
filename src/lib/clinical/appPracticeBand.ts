/**
 * App-engine's display-only target, not a validated therapy threshold.
 * Changing these text labels does not affect adaptation or level progression.
 */
export function describeAppPracticeBand(rate: number | null): string | null {
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0 || rate > 1) return null;
  const pct = Math.round(rate * 100);
  if (pct < 65) return pct + '% · below app target';
  if (pct > 80) return pct + '% · above app target';
  return pct + '% · within app target';
}
