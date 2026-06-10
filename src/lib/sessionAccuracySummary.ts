/**
 * sessionAccuracySummary — single source of truth for the top-level
 * accuracy fields stamped into `sessions.summary`.
 *
 * BACKGROUND (Phase 1 data-integrity fix):
 *   The plateau / regression detectors (redFlagDetector.ts, useRiskScoring.ts)
 *   read `summary.accuracy` — a single 0..100 number per session. But the
 *   session writers (sessionTracking.endSession / useSessionLifecycle) only
 *   ever wrote `summary.scores` (a per-exercise map). The top-level
 *   `accuracy` field was therefore always `undefined`, so every plateau /
 *   regression query produced an empty accuracy series and silently no-op'd.
 *
 *   This helper recomputes the canonical session accuracy from the raw
 *   `exercise_events` rows (the clinical ground truth) and additionally
 *   splits it into independent vs cue-assisted accuracy so analytics can tell
 *   "got it alone" from "got it with a cue".
 *
 * Rules:
 *   • Only rows that count toward score are included
 *     (counts_toward_score !== false — i.e. validity-filtered attempts and
 *     non-trial telemetry rows with null score are excluded).
 *   • accuracy            = mean(score) over all scored trials      (0..100)
 *   • independent_accuracy = mean(score) over trials with cue_level 0
 *   • cue_assisted_accuracy = mean(score) over trials with cue_level > 0
 *   • Each field is null when its denominator is 0 (insufficient data) so
 *     downstream consumers never mistake "no data" for "0% accuracy".
 */

import { supabase } from '@/integrations/supabase/client';

export interface SessionAccuracySummary {
  /** ASR/clinically-verified accuracy. Excludes manual_confirmed. */
  accuracy: number | null;
  /** ASR-verified, cue_level 0 only. Never includes manual_confirmed. */
  independent_accuracy: number | null;
  cue_assisted_accuracy: number | null;
  /** Phase 1B — alias of `accuracy` (explicit ASR-only field for dashboards). */
  asr_accuracy: number | null;
  /** Phase 1B — coarse practice accuracy; includes manual_confirmed trials. */
  practice_accuracy: number | null;
  scored_trials: number;
  independent_trials: number;
  cue_assisted_trials: number;
  /** Phase 1B — count of manual-confirmed (non-ASR) correct trials. */
  manual_confirmed_trials: number;
  /** Phase 1B — trials counting toward participation (ASR-valid + manual). */
  participation_trials: number;
}

interface ScoredRow {
  score: number | null;
  cue_level: number | null;
  counts_toward_score: boolean | null;
  validity_label?: string | null;
}

const EMPTY: SessionAccuracySummary = {
  accuracy: null,
  independent_accuracy: null,
  cue_assisted_accuracy: null,
  asr_accuracy: null,
  practice_accuracy: null,
  scored_trials: 0,
  independent_trials: 0,
  cue_assisted_trials: 0,
  manual_confirmed_trials: 0,
  participation_trials: 0,
};

/** Pure reducer — exported for unit testing without a DB round-trip. */
export function reduceAccuracy(rows: ScoredRow[]): SessionAccuracySummary {
  const mean = (xs: number[]) =>
    xs.length === 0 ? null : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;

  const isManual = (r: ScoredRow) => r.validity_label === 'manual_confirmed';

  // ASR/clinically-verified scored trials — the clean accuracy series.
  // Excludes validity-filtered rows AND manual_confirmed (never ASR-verified).
  const scored = rows.filter(
    (r) => typeof r.score === 'number' && r.counts_toward_score !== false && !isManual(r)
  );

  // Manual-confirmed correct trials (score present, explicitly tagged).
  const manual = rows.filter((r) => typeof r.score === 'number' && isManual(r));

  const all = scored.map((r) => r.score as number);
  const independent = scored
    .filter((r) => (r.cue_level ?? 0) === 0)
    .map((r) => r.score as number);
  const cued = scored
    .filter((r) => (r.cue_level ?? 0) > 0)
    .map((r) => r.score as number);

  // Practice accuracy = ASR-scored ∪ manual-confirmed.
  const practice = [...all, ...manual.map((r) => r.score as number)];

  const accuracy = mean(all);

  return {
    accuracy,
    independent_accuracy: mean(independent),
    cue_assisted_accuracy: mean(cued),
    asr_accuracy: accuracy,
    practice_accuracy: mean(practice),
    scored_trials: all.length,
    independent_trials: independent.length,
    cue_assisted_trials: cued.length,
    manual_confirmed_trials: manual.length,
    participation_trials: all.length + manual.length,
  };
}

/** Fetch the session's scored trials and reduce them. Never throws. */
export async function computeSessionAccuracySummary(
  sessionId: string | null
): Promise<SessionAccuracySummary> {
  if (!sessionId) return { ...EMPTY };
  try {
    const { data, error } = await supabase
      .from('exercise_events')
      .select('score, cue_level, counts_toward_score, validity_label')
      .eq('session_id', sessionId);
    if (error || !data) return { ...EMPTY };
    return reduceAccuracy(data as ScoredRow[]);
  } catch {
    return { ...EMPTY };
  }
}

/**
 * Canonical set of top-level summary fields stamped into `sessions.summary`.
 * Shared by all session-end writers so they stay consistent.
 */
export function accuracySummaryToSummaryFields(
  acc: SessionAccuracySummary
): Record<string, number | null> {
  return {
    ...(acc.accuracy != null ? { accuracy: acc.accuracy } : {}),
    independent_accuracy: acc.independent_accuracy,
    cue_assisted_accuracy: acc.cue_assisted_accuracy,
    asr_accuracy: acc.asr_accuracy,
    practice_accuracy: acc.practice_accuracy,
    scored_trials: acc.scored_trials,
    manual_confirmed_trials: acc.manual_confirmed_trials,
    participation_trials: acc.participation_trials,
  };
}
