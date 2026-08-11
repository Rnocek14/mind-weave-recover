/**
 * Returns the local date as YYYY-MM-DD string.
 * Avoids the UTC off-by-one bug from toISOString().slice(0,10).
 */
export function localYYYYMMDD(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Days-since-epoch in the user's LOCAL timezone. Two timestamps map to the
 * same number iff they fall on the same local calendar day — the correct
 * bucketing for streaks and daily stats. UTC bucketing merges an evening
 * session with the next morning's for anyone west of UTC, undercounting
 * streaks.
 */
export function localDayNumber(input: string | Date): number {
  const d = typeof input === "string" ? new Date(input) : input;
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

/** Start of the local calendar day containing `date` (defaults to today). */
export function localDayStart(date: Date = new Date()): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}
