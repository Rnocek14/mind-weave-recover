/**
 * Returns true when the most recent device sync is older than 72 hours.
 * Accepts an injectable `nowMs` for deterministic testing.
 */
export function isSyncStale(
  lastSyncAtMax: string | null,
  nowMs: number = Date.now()
): boolean {
  if (!lastSyncAtMax) return false;
  return (nowMs - new Date(lastSyncAtMax).getTime()) > 72 * 60 * 60 * 1000;
}
