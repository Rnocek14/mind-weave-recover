/**
 * Progression Planning Signals
 *
 * Feeds per-game longitudinal progression (clinical_progression_state) BACK into
 * daily lesson planning. Without this, the planner is "amnesiac": each game
 * advances its own floor in isolation, but tomorrow's lesson doesn't know where
 * the patient is succeeding, struggling, plateauing, or lagging across games.
 *
 * This module turns the raw progression rows into planning signals:
 *   - a per-exercise scoring boost (invest more where it matters)
 *   - a coarse status (advancing / plateauing / struggling / lagging / steady)
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
  /** Continuous position: (level-1) + progress fraction. Used for cross-game comparison. */
  relativeProgress: number;
  status: ProgressionStatus;
  /** Added to the exercise's selection score. Positive = invest more. */
  planningBoost: number;
  reason: string;
}

export interface ProgressionPlanningSignals {
  byExercise: Map<string, ProgressionPlanningSignal>;
  /** Highest relativeProgress across tracked games (the patient's "lead" game). */
  maxRelativeProgress: number;
}

// Gentle-nudge scaling: these MUST stay small relative to baseScore (high=+5)
// and the recency penalty (-3) so progression tips ties without overriding
// clinical priority or variety. A struggling game nudges up by +2 (never the
// +5 that would re-select it through a -3 recency penalty day after day).
const BOOST = {
  struggling: 2,
  plateauing: 2,
  lagging: 1,
  advancing: -2,
  steady: 0,
} as const;

/** A game is "lagging" if it trails the lead game by this much (in levels). */
const LAGGING_GAP_LEVELS = 3;

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

    if (struggleSessions >= 2) {
      status = 'struggling';
      reason = `Struggling at L${r.current_level} (${struggleSessions} hard sessions) — reinforce`;
    } else if (
      successSessions === 0 &&
      struggleSessions <= 1 &&
      (r.progress_pct ?? 0) < 40 &&
      r.current_level === r.stable_level
    ) {
      status = 'plateauing';
      reason = `Plateauing at L${r.current_level} (${Math.round(r.progress_pct ?? 0)}%) — vary approach`;
    } else if (
      maxRelativeProgress - rp >= LAGGING_GAP_LEVELS &&
      successSessions < 3
    ) {
      status = 'lagging';
      reason = `Lagging behind other games (L${r.current_level}) — invest to balance`;
    } else if (successSessions >= 3) {
      status = 'advancing';
      reason = `Advancing well at L${r.current_level} (${successSessions} strong sessions) — coast`;
    } else {
      status = 'steady';
      reason = `Steady at L${r.current_level}`;
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
