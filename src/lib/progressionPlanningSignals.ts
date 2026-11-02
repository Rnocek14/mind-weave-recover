/**
 * Progression Planning Signals
 *
 * Feeds per-game longitudinal progression (clinical_progression_state) BACK into
 * daily lesson planning. Without this, the planner is "amnesiac": each game
 * advances its own floor in isolation, but tomorrow's lesson doesn't know where
 * the patient is repeatedly struggling or succeeding WITHIN a particular game.
 *
 * This module turns the raw progression rows into planning signals:
 *   - a per-exercise scoring boost (invest more where it matters)
 *   - a conservative within-game status (advancing / struggling / no proven trend)
 *   - human-readable reasoning for explainability
 *
 * IMPORTANT: This layer ONLY influences SELECTION/PRIORITIZATION (which games
 * appear in the lesson and how much time they get). Each game already self-starts
 * at its own current_level via its progression hook — we never override that here.
 */

import { supabase } from '@/integrations/supabase/client';

export type ProgressionStatus =
  | 'advancing'
  | 'plateauing'
  | 'struggling'
  | 'lagging'
  | 'steady';

export interface ProgressionRow {
  exercise_slug: string;
  current_level: number;
  progress_pct: number;
  support_baseline: number;
  stable_level: number;
  consecutive_success_sessions: number;
  consecutive_struggle_sessions: number;
}

export interface ProgressionPlanningSignal {
  exerciseSlug: string;
  currentLevel: number;
  /** Non-clinical in-game rung position for diagnostics only; not comparable across different exercises. */
  relativeProgress: number;
  status: ProgressionStatus;
  /** Added to the exercise's selection score. Positive = invest more. */
  planningBoost: number;
  reason: string;
}

export interface ProgressionPlanningSignals {
  byExercise: Map<string, ProgressionPlanningSignal>;
  /** Diagnostic maximum only: never treat one exercise's rung number as more recovered than another's. */
  maxRelativeProgress: number;
}

// Gentle-nudge scaling: these MUST stay small relative to baseScore (high=+5)
// and the recency penalty (-3) so progression tips ties without overriding
// clinical priority or variety. A struggling game nudges up by +2 (never the
// +5 that would re-select it through a -3 recency penalty day after day).
const BOOST = {
  struggling: 2,
  plateauing: 0, // Legacy status. Never infer plateau from one snapshot.
  lagging: 0,    // Legacy status. Cross-game numerical levels are incomparable.
  advancing: -2,
  steady: 0,
} as const;

/**
 * Fetch the latest progression state per exercise for a profile.
 * Rows are deduped by exercise_slug, keeping the most recently updated.
 */
export async function fetchProgressionPlanningSignals(
  userId: string,
  profileId: string | undefined,
): Promise<ProgressionPlanningSignals> {
  const empty: ProgressionPlanningSignals = {
    byExercise: new Map(),
    maxRelativeProgress: 0,
  };

  if (!userId || !profileId) return empty;

  const { data, error } = await supabase
    .from('clinical_progression_state')
    .select(
      'exercise_slug, current_level, progress_pct, support_baseline, stable_level, consecutive_success_sessions, consecutive_struggle_sessions, last_updated_at',
    )
    .eq('user_id', userId)
    .eq('profile_id', profileId)
    .order('last_updated_at', { ascending: false });

  if (error || !data || data.length === 0) {
    if (error) console.warn('[ProgressionPlanning] Fetch failed:', error.message);
    return empty;
  }

  // Dedupe by slug (keep newest — already sorted desc)
  const latest = new Map<string, ProgressionRow>();
  for (const row of data) {
    if (!row.exercise_slug) continue;
    if (!latest.has(row.exercise_slug)) {
      latest.set(row.exercise_slug, row as ProgressionRow);
    }
  }

  return buildProgressionPlanningSignals(Array.from(latest.values()));
}

/**
 * Pure transform: progression rows → planning signals.
 * Exported for unit testing without DB access.
 */
export function buildProgressionPlanningSignals(
  rows: ProgressionRow[],
): ProgressionPlanningSignals {
  const byExercise = new Map<string, ProgressionPlanningSignal>();

  if (rows.length === 0) {
    return { byExercise, maxRelativeProgress: 0 };
  }

  const relProgress = (r: ProgressionRow) =>
    Math.max(0, (r.current_level - 1)) +
    Math.min(1, Math.max(0, (r.progress_pct ?? 0) / 100));

  const maxRelativeProgress = Math.max(...rows.map(relProgress));

  for (const r of rows) {
    const rp = relProgress(r);
    const successSessions = r.consecutive_success_sessions ?? 0;
    const struggleSessions = r.consecutive_struggle_sessions ?? 0;

    let status: ProgressionStatus;
    let reason: string;

    // The clinical rung measures DIFFERENT skills across games. A naming
    // L7 cannot diagnose "lagging" auditory discrimination L1. Likewise,
    // one low-progress snapshot does not establish a plateau. Use repeated
    // observations WITHIN the same game only.
    if (struggleSessions >= 2) {
      status = 'struggling';
      reason = `Recorded support need at L${r.current_level} across ${struggleSessions} consecutive sessions — review for targeted practice`;
    } else if (successSessions >= 3) {
      status = 'advancing';
      reason = `Consistent app practice successes at L${r.current_level} across ${successSessions} sessions — rotate while retaining exposure`;
    } else {
      status = 'steady';
      reason = `Insufficient within-game trend evidence at L${r.current_level}; no automatic recovery or plateau conclusion`;
    }

    byExercise.set(r.exercise_slug, {
      exerciseSlug: r.exercise_slug,
      currentLevel: r.current_level,
      relativeProgress: rp,
      status,
      planningBoost: BOOST[status],
      reason,
    });
  }

  return { byExercise, maxRelativeProgress };
}
