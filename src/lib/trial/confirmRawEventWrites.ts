/**
 * Await every observed clinical event before recording a completed lesson.
 *
 * The game registers each promise synchronously, but React may send the
 * completion callback before the last network write resolves.
 */
export async function confirmRawEventWrites(
  writes: readonly Promise<boolean>[],
  expected: number,
): Promise<{ ok: true; saved: number } | { ok: false; saved: number; reason: string }> {
  const outcomes = await Promise.allSettled(writes);
  const saved = outcomes.filter(result => result.status === 'fulfilled' && result.value === true).length;
  if (!Number.isSafeInteger(expected) || expected < 1 || outcomes.length < expected) {
    return { ok: false, saved, reason: 'One or more completed rounds have no recorded attempt' };
  }
  if (saved !== outcomes.length) {
    return { ok: false, saved, reason: 'One or more raw attempt writes failed' };
  }
  return { ok: true, saved };
}
