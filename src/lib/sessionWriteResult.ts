/**
 * Boolean-returning session RPCs distinguish a persisted write from a
 * successful HTTP request that updated zero rows (closed/missing/RLS denied).
 * Never award clinical progress or dose from the latter.
 */
export function sessionWriteApplied(
  data: unknown,
  error: { message?: string } | null | undefined,
): boolean {
  return error == null && data === true;
}
