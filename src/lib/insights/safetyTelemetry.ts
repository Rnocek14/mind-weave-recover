/**
 * Recovery Insight Safety Telemetry — internal, never user-facing.
 *
 * Tracks how the language layer is behaving in production so we can:
 *   - detect blacklist-trigger attempts (regression signal),
 *   - watch suppression rates (too noisy / too quiet),
 *   - tune the confidence bar in PR-B3 with real data.
 *
 * Implementation is intentionally minimal: in-process counters + an
 * optional sink callback. No DB writes here. PR-B4+ may forward the sink
 * to analytics; for now it's read via `snapshotSafetyTelemetry()`.
 */

export interface SafetyTelemetryCounters {
  signalsGenerated: number;
  signalsBelowConfidenceBar: number;
  insightsEmitted: number;
  supportLinesSuppressed: number;
  duplicatesSuppressed: number;
  emptyOutputs: number;
  blacklistTriggerAttempts: number;
}

const ZERO: SafetyTelemetryCounters = {
  signalsGenerated: 0,
  signalsBelowConfidenceBar: 0,
  insightsEmitted: 0,
  supportLinesSuppressed: 0,
  duplicatesSuppressed: 0,
  emptyOutputs: 0,
  blacklistTriggerAttempts: 0,
};

let counters: SafetyTelemetryCounters = { ...ZERO };

export type SafetyTelemetrySink = (
  event: keyof SafetyTelemetryCounters,
  delta: number,
  context?: Record<string, unknown>,
) => void;

let sink: SafetyTelemetrySink | null = null;

export function setSafetyTelemetrySink(s: SafetyTelemetrySink | null): void {
  sink = s;
}

export function recordSafetyEvent(
  event: keyof SafetyTelemetryCounters,
  delta = 1,
  context?: Record<string, unknown>,
): void {
  counters[event] += delta;
  if (sink) {
    try {
      sink(event, delta, context);
    } catch {
      // Sink failures must never affect the calling flow.
    }
  }
}

export function snapshotSafetyTelemetry(): SafetyTelemetryCounters {
  return { ...counters };
}

export function resetSafetyTelemetry(): void {
  counters = { ...ZERO };
}
