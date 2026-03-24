/**
 * Exercise Struggle Tracker
 * 
 * Analyzes per-exercise performance history to identify exercises where the user
 * consistently struggles. This feeds into session planning to:
 * - Re-select struggling exercises at easier levels
 * - Avoid over-repetition via guardrails
 * - Provide targeted re-exposure with increased support
 * 
 * Struggle signals:
 * - Low accuracy across recent sessions (< 50%)
 * - High cue usage (avg cue level > 1.5)
 * - Frequent timeouts (> 25%)
 * - Declining performance (negative accuracy slope)
 */

import { supabase } from '@/integrations/supabase/client';

export interface ExerciseStruggleRecord {
  exerciseSlug: string;
  avgAccuracy: number;
  avgCueLevel: number;
  timeoutRate: number;
  trialCount: number;
  sessionCount: number;
  isStruggling: boolean;
  struggleSignals: string[];
  /** Recommended difficulty adjustment for re-entry */
  suggestedDifficultyDelta: number;
  /** Recommended cue level for re-entry */
  suggestedCueLevel: number;
}

export interface ExerciseStrugglePenalties {
  /** Per-exercise score boost (positive = boost for re-exposure) */
  exerciseBoosts: Map<string, number>;
  /** Per-exercise recommended start config */
  reEntryConfigs: Map<string, { difficulty: number; cueLevel: number }>;
  /** Reasoning for explainability */
  reasons: Map<string, string>;
}

const STRUGGLE_THRESHOLDS = {
  /** Accuracy below this = struggling */
  lowAccuracy: 0.50,
  /** Avg cue level above this = high cue dependence */
  highCueLevel: 1.5,
  /** Timeout rate above this = timing issues */
  highTimeoutRate: 0.25,
  /** Minimum trials to assess */
  minTrials: 8,
  /** Maximum re-exposure boost to prevent over-repetition */
  maxBoost: 3,
  /** Maximum sessions in 7 days before suppressing re-exposure */
  maxReExposureSessions: 3,
};

/**
 * Fetch per-exercise performance from recent sessions.
 */
export async function fetchExerciseStruggleData(
  userId: string,
  profileId: string | undefined,
  windowDays: number = 14,
): Promise<ExerciseStruggleRecord[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  let query = supabase
    .from('exercise_events')
    .select(`
      exercise_slug,
      score,
      cue_level,
      reaction_time_ms,
      session_id,
      sessions!inner(user_id, profile_id)
    `)
    .not('exercise_slug', 'is', null)
    .gte('created_at', cutoff.toISOString())
    .eq('sessions.user_id', userId)
    .limit(1000);

  if (profileId) {
    query = query.eq('sessions.profile_id', profileId);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.warn('[ExerciseStruggle] Fetch failed:', error?.message);
    return [];
  }

  // Aggregate by exercise_slug
  const slugMap = new Map<string, {
    scores: number[];
    cueLevels: number[];
    timeouts: number;
    total: number;
    sessions: Set<string>;
  }>();

  for (const row of data) {
    const slug = row.exercise_slug;
    if (!slug) continue;
    const entry = slugMap.get(slug) || { scores: [], cueLevels: [], timeouts: 0, total: 0, sessions: new Set() };
    
    if (row.score !== null) entry.scores.push(row.score);
    if (row.cue_level !== null) entry.cueLevels.push(row.cue_level);
    if (row.reaction_time_ms === null || row.reaction_time_ms <= 0) entry.timeouts++;
    entry.total++;
    entry.sessions.add(row.session_id);
    slugMap.set(slug, entry);
  }

  return Array.from(slugMap.entries()).map(([slug, d]) => {
    const avgAccuracy = d.scores.length > 0
      ? d.scores.filter(s => s > 0).length / d.scores.length
      : 0;
    const avgCueLevel = d.cueLevels.length > 0
      ? d.cueLevels.reduce((a, b) => a + b, 0) / d.cueLevels.length
      : 0;
    const timeoutRate = d.total > 0 ? d.timeouts / d.total : 0;

    const signals: string[] = [];
    let isStruggling = false;

    if (d.total >= STRUGGLE_THRESHOLDS.minTrials) {
      if (avgAccuracy < STRUGGLE_THRESHOLDS.lowAccuracy) {
        signals.push(`Low accuracy: ${Math.round(avgAccuracy * 100)}%`);
        isStruggling = true;
      }
      if (avgCueLevel > STRUGGLE_THRESHOLDS.highCueLevel) {
        signals.push(`High cue dependence: avg L${avgCueLevel.toFixed(1)}`);
        isStruggling = true;
      }
      if (timeoutRate > STRUGGLE_THRESHOLDS.highTimeoutRate) {
        signals.push(`High timeout rate: ${Math.round(timeoutRate * 100)}%`);
        isStruggling = true;
      }
    }

    // Suggest re-entry config
    let suggestedDifficultyDelta = 0;
    let suggestedCueLevel = 0;
    if (isStruggling) {
      suggestedDifficultyDelta = avgAccuracy < 0.3 ? -2 : -1;
      suggestedCueLevel = avgCueLevel > 2 ? 2 : 1;
    }

    return {
      exerciseSlug: slug,
      avgAccuracy,
      avgCueLevel,
      timeoutRate,
      trialCount: d.total,
      sessionCount: d.sessions.size,
      isStruggling,
      struggleSignals: signals,
      suggestedDifficultyDelta,
      suggestedCueLevel,
    };
  });
}

/**
 * Calculate struggle-based scoring adjustments for session planning.
 * 
 * Struggling exercises get a BOOST (not penalty) to ensure targeted re-exposure,
 * but with guardrails to prevent over-repetition.
 */
export function calculateStrugglePenalties(
  struggleRecords: ExerciseStruggleRecord[],
  recentSessionCounts: Map<string, number>, // From recency engine
): ExerciseStrugglePenalties {
  const exerciseBoosts = new Map<string, number>();
  const reEntryConfigs = new Map<string, { difficulty: number; cueLevel: number }>();
  const reasons = new Map<string, string>();

  for (const record of struggleRecords) {
    if (!record.isStruggling) continue;

    // Guardrail: don't boost if already seen too many times recently
    const recentSessions = recentSessionCounts.get(record.exerciseSlug) || 0;
    if (recentSessions >= STRUGGLE_THRESHOLDS.maxReExposureSessions) {
      reasons.set(
        record.exerciseSlug,
        `Struggling but suppressed: already in ${recentSessions} recent sessions (max ${STRUGGLE_THRESHOLDS.maxReExposureSessions})`
      );
      continue;
    }

    // Calculate boost: more struggle = higher priority for re-exposure
    let boost = 1; // Base boost for any struggling exercise
    if (record.avgAccuracy < 0.3) boost += 1;
    if (record.avgCueLevel > 2) boost += 1;
    boost = Math.min(boost, STRUGGLE_THRESHOLDS.maxBoost);

    exerciseBoosts.set(record.exerciseSlug, boost);
    reEntryConfigs.set(record.exerciseSlug, {
      difficulty: Math.max(1, 1 + record.suggestedDifficultyDelta),
      cueLevel: record.suggestedCueLevel,
    });
    reasons.set(
      record.exerciseSlug,
      `Struggling (${record.struggleSignals.join('; ')}): boost +${boost}, re-entry at L${Math.max(1, 1 + record.suggestedDifficultyDelta)} cue=${record.suggestedCueLevel}`
    );
  }

  return { exerciseBoosts, reEntryConfigs, reasons };
}
