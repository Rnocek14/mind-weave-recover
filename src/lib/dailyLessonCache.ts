/**
 * A day's suggested games are a cached snapshot, not the source of truth.
 * A completed exercise or lesson invalidates the snapshot so next planning
 * incorporates newly saved observations. Never touch unrelated session state.
 */
export const DAILY_LESSON_CACHE_KEY = "dailyLessonCache";

export function isDailyLessonCacheFresh(timestamp: unknown, now: Date, ttlMs = 30 * 60 * 1000): boolean {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return false;
  const then = new Date(timestamp);
  return Number.isFinite(then.getTime()) &&
    timestamp <= now.getTime() &&
    now.getTime() - timestamp < ttlMs &&
    then.toDateString() === now.toDateString();
}

export function invalidateDailyLessonCache(storage?: { removeItem: (key: string) => void }): boolean {
  try {
    const target = storage ?? (typeof sessionStorage === "undefined" ? null : sessionStorage);
    if (!target) return false;
    target.removeItem(DAILY_LESSON_CACHE_KEY);
    return true;
  } catch {
    // Access can be blocked by private browsing or disabled storage. Session
    // completion must never fail just because a hint cache was unavailable.
    return false;
  }
}
