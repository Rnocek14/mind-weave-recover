import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Options {
  sessionId: string | null | undefined;
  exerciseSlug: string;
  /** Trial counter from the page; when this stays at 0 past the threshold we
   *  consider the session stalled (mic dead, TTS blocked, prompt not advancing). */
  trialCount: number;
  /** Threshold (ms) after session start with zero trials to consider stalled.
   *  Default 90s — long enough for first-trial TTS + warmup, short enough to
   *  catch real abandonment before the visibility timeout sweeps the row. */
  stallThresholdMs?: number;
  /** Optional callback fired client-side when a stall is detected. */
  onStallDetected?: (info: { sessionId: string; elapsedMs: number }) => void;
  /** Disable the watchdog (e.g. lesson flow owns its own progression). */
  disabled?: boolean;
}

/**
 * Client-side watchdog that flags sessions which never advanced past trial 0.
 * Logs a console warning + writes a `session_stall` row into shadow_event so
 * the telemetry dashboard can surface "no-event sessions" without waiting for
 * the nightly sweep to mark them as `timeout_sweep`.
 *
 * Lightweight: a single setTimeout per session — no polling.
 */
export function useSessionStallWatchdog({
  sessionId,
  exerciseSlug,
  trialCount,
  stallThresholdMs = 90_000,
  onStallDetected,
  disabled,
}: Options) {
  const startRef = useRef<number>(Date.now());
  const firedRef = useRef(false);
  const trialCountRef = useRef(trialCount);
  trialCountRef.current = trialCount;

  // Reset when sessionId changes
  useEffect(() => {
    startRef.current = Date.now();
    firedRef.current = false;
  }, [sessionId]);

  useEffect(() => {
    if (disabled || !sessionId || firedRef.current) return;
    if (trialCount > 0) return; // Already advanced — nothing to watch

    const t = setTimeout(async () => {
      if (firedRef.current) return;
      if (trialCountRef.current > 0) return; // Advanced just before timeout
      firedRef.current = true;

      const elapsedMs = Date.now() - startRef.current;
      console.warn('[SessionStallWatchdog] ⚠️ Session stalled — no trial advance', {
        sessionId, exerciseSlug, elapsedMs,
      });

      onStallDetected?.({ sessionId, elapsedMs });

      // Best-effort telemetry write
      try {
        await (supabase as any).from('shadow_event').insert({
          session_id: sessionId,
          event_type: 'session_stall',
          payload: {
            exercise_slug: exerciseSlug,
            elapsed_ms: elapsedMs,
            stall_threshold_ms: stallThresholdMs,
            detected_at: new Date().toISOString(),
          },
        });
      } catch (err) {
        console.warn('[SessionStallWatchdog] failed to log stall event:', err);
      }
    }, stallThresholdMs);

    return () => clearTimeout(t);
  }, [sessionId, exerciseSlug, trialCount, stallThresholdMs, disabled, onStallDetected]);
}
