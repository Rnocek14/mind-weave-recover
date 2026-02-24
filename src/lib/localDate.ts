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
