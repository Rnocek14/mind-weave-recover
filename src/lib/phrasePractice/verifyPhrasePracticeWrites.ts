/**
 * Require raw attempt persistence before a Phrase Practice session completes.
 * A pending speech analysis must never become an implicit saved success.
 */
export async function verifyPhrasePracticeWrites(
  writes: readonly Promise<boolean | void>[],
  minTrials: number,
  hasWriter: boolean,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!hasWriter) return { ok: false, reason: 'Missing raw trial writer' };
  if (!Number.isSafeInteger(minTrials) || minTrials < 1 || writes.length < minTrials) {
    return { ok: false, reason: 'Missing observed phrase attempts' };
  }
  const settled = await Promise.allSettled(writes);
  if (settled.some((result) => result.status !== 'fulfilled' || result.value !== true)) {
    return { ok: false, reason: 'At least one raw attempt was not verified saved' };
  }
  return { ok: true };
}
