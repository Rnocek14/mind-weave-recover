/** Azure JSON uses 100-nanosecond ticks; some REST examples encode them as strings. */
export const TICKS_PER_SECOND = 10_000_000;

export function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function finiteNumber(value: unknown, minimum = 0, maximum = Infinity): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
    ? value : null;
}

export function ticks(value: unknown): number | null {
  const numeric = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  return typeof numeric === 'number' && Number.isSafeInteger(numeric) && numeric >= 0
    ? numeric : null;
}

export function ticksToSeconds(value: unknown): number | null {
  const duration = ticks(value);
  return duration === null ? null : duration / TICKS_PER_SECOND;
}

export function timedSegment(value: unknown): { start: number; end: number; duration: number } | null {
  const item = record(value);
  const start = ticks(item?.Offset);
  const duration = ticks(item?.Duration);
  if (start === null || duration === null || !Number.isSafeInteger(start + duration)) return null;
  return { start, end: start + duration, duration };
}

export function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
