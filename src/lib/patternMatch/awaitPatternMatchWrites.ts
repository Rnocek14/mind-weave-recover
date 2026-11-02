/**
 * Pattern Match raw-attempt commit barrier.
 *
 * Used by the real page before closing a standalone session or advancing a
 * guided lesson. A completed visual task is not a verified persisted record.
 */
export async function awaitPatternMatchWrites(
  writes: readonly Promise<boolean>[],
  expectedTrials: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!Number.isSafeInteger(expectedTrials) || expectedTrials < 1) {
    return { ok: false, reason: 'Invalid expected trial count' };
  }
  if (writes.length !== expectedTrials) {
    return { ok: false, reason: `Expected ${expectedTrials} trial writes, received ${writes.length}` };
  }
  const settled = await Promise.allSettled(writes);
  if (settled.some((result) => result.status !== 'fulfilled' || result.value !== true)) {
    return { ok: false, reason: 'At least one raw trial was not persisted' };
  }
  return { ok: true };
}
