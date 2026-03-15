/**
 * Exercise Recency Engine
 * 
 * Provides exercise-level and base-component-level recency penalties
 * to prevent the lesson engine from repeatedly selecting the same exercises.
 * 
 * Queries recent exercise_events to determine:
 * - Which exercises were used in the last N days
 * - Which base components dominated recent sessions (distinct session count)
 * - Per-exercise session count for penalty scaling
 * 
 * Data scoping: exercise_events RLS uses a session→profile→auth.uid() join,
 * so the anon client only sees the current user's events. We additionally
 * join through sessions to enforce profile-level scoping explicitly.
 */

import { supabase } from '@/integrations/supabase/client';

export interface ExerciseUsageRecord {
  exerciseSlug: string;
  sessionCount: number;       // unique sessions in window
  trialCount: number;         // total trials in window
  lastUsedDate: string;       // ISO date of most recent use
  daysAgo: number;            // days since last use
  /** Session IDs this exercise appeared in (needed for family dedup) */
  sessionIds: Set<string>;
}

export interface RecencyPenalties {
  /** Per-exercise penalty (negative score adjustment) */
  exercisePenalties: Map<string, number>;
  /** Per-baseComponent penalty */
  componentPenalties: Map<string, number>;
  /** Debug reasoning per exercise */
  reasons: Map<string, string>;
}

/**
 * Fetch recent exercise usage for a user within a time window.
 * 
 * Explicitly joins through sessions table to guarantee user+profile scoping,
 * rather than relying solely on RLS (belt-and-suspenders).
 */
export async function fetchRecentExerciseUsage(
  userId: string,
  profileId: string | undefined,
  windowDays: number = 7,
): Promise<ExerciseUsageRecord[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - windowDays);

  // Use a join through sessions to explicitly scope by user_id (and profile_id if available).
  // This makes the scoping verifiable from code, not just from RLS policy inspection.
  let query = supabase
    .from('exercise_events')
    .select(`
      exercise_slug,
      session_id,
      created_at,
      sessions!inner(user_id, profile_id)
    `)
    .not('exercise_slug', 'is', null)
    .gte('created_at', cutoffDate.toISOString())
    .eq('sessions.user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1000);

  // Further scope to active profile if available
  if (profileId) {
    query = query.eq('sessions.profile_id', profileId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.warn('[ExerciseRecency] Failed to fetch usage:', error?.message);
    return [];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Aggregate by exercise_slug
  const usageMap = new Map<string, {
    sessions: Set<string>;
    trialCount: number;
    lastUsed: Date;
  }>();

  for (const row of data) {
    const slug = row.exercise_slug;
    if (!slug) continue;

    const existing = usageMap.get(slug) || {
      sessions: new Set<string>(),
      trialCount: 0,
      lastUsed: new Date(0),
    };

    existing.sessions.add(row.session_id);
    existing.trialCount++;
    const rowDate = new Date(row.created_at || 0);
    if (rowDate > existing.lastUsed) {
      existing.lastUsed = rowDate;
    }
    usageMap.set(slug, existing);
  }

  return Array.from(usageMap.entries()).map(([slug, usage]) => {
    const lastUsedDay = new Date(usage.lastUsed);
    lastUsedDay.setHours(0, 0, 0, 0);
    const daysAgo = Math.max(0, Math.floor((today.getTime() - lastUsedDay.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      exerciseSlug: slug,
      sessionCount: usage.sessions.size,
      trialCount: usage.trialCount,
      lastUsedDate: usage.lastUsed.toISOString().slice(0, 10),
      daysAgo,
      sessionIds: usage.sessions,
    };
  });
}

/**
 * Base component mapping — must stay in sync with dailyLessonEngine exerciseMetadata.
 * Extracted here so recency can penalize at the component family level.
 */
export const EXERCISE_COMPONENT_MAP: Record<string, string> = {
  'reach-tap': 'reach-tap-game',
  'left-side-hunt': 'reach-tap-game',
  'pattern-match': 'pattern-match-game',
  'photo-naming': 'photo-naming-game',
  'phonological': 'phonological-game',
  'phonological-awareness': 'phonological-game',
  'semantic-features': 'semantic-game',
  'phrase-practice': 'phrase-game',
  'sentence-construction': 'sentence-game',
  'minimal-pairs': 'minimal-pairs-game',
  'two-clues': 'two-clues-game',
  'fix-sentence': 'fix-sentence-game',
  'describe-guess': 'describe-guess-game',
  'conversation-partner': 'conversation-game',
  'conversation-coach': 'conversation-game',
  'detective-mind': 'comprehension-game',
  'meaning-match': 'comprehension-game',
  'narrative-retell': 'discourse-game',
  'abstract-compare': 'abstraction-game',
  'multi-step-plan': 'planning-game',
  'dual-load-naming': 'dual-load-game',
  'thought-continuation': 'thought-game',
};

/**
 * Calculate recency penalties for exercise selection scoring.
 * 
 * Penalty tiers:
 * - Used today:      -5 (strong avoidance)
 * - Used yesterday:  -3 (moderate avoidance)
 * - Used 2 days ago: -1 (mild avoidance)
 * - 3+ days ago:      0 (no penalty)
 * 
 * Component-family penalty (using DISTINCT session count per family):
 * - If a base component family was used in 3+ distinct sessions this week: -2
 * - If a base component family was used in 2 distinct sessions this week:  -1
 */
export function calculateRecencyPenalties(
  usageRecords: ExerciseUsageRecord[],
): RecencyPenalties {
  const exercisePenalties = new Map<string, number>();
  const componentPenalties = new Map<string, number>();
  const reasons = new Map<string, string>();

  // 1. Per-exercise recency penalty
  for (const record of usageRecords) {
    let penalty = 0;
    let reason = '';

    if (record.daysAgo === 0) {
      penalty = -5;
      reason = `used today (${record.trialCount} trials) → -5`;
    } else if (record.daysAgo === 1) {
      penalty = -3;
      reason = `used yesterday → -3`;
    } else if (record.daysAgo === 2) {
      penalty = -1;
      reason = `used 2 days ago → -1`;
    }

    if (penalty !== 0) {
      exercisePenalties.set(record.exerciseSlug, penalty);
      reasons.set(record.exerciseSlug, `recency: ${reason}`);
    }
  }

  // 2. Per-component family penalty using DISTINCT sessions
  // Collect all unique session IDs per component family (not summed per-slug)
  const componentDistinctSessions = new Map<string, Set<string>>();
  for (const record of usageRecords) {
    const component = EXERCISE_COMPONENT_MAP[record.exerciseSlug];
    if (!component) continue;
    
    const existing = componentDistinctSessions.get(component) || new Set<string>();
    // Union the session IDs from this exercise into the family set
    for (const sid of record.sessionIds) {
      existing.add(sid);
    }
    componentDistinctSessions.set(component, existing);
  }

  for (const [component, sessions] of componentDistinctSessions) {
    const distinctCount = sessions.size;
    let penalty = 0;
    if (distinctCount >= 3) {
      penalty = -2;
    } else if (distinctCount >= 2) {
      penalty = -1;
    }
    if (penalty !== 0) {
      componentPenalties.set(component, penalty);
    }
  }

  // Merge component penalties into exercise reasons
  for (const [slug, component] of Object.entries(EXERCISE_COMPONENT_MAP)) {
    const compPenalty = componentPenalties.get(component);
    if (compPenalty) {
      const existing = reasons.get(slug) || '';
      const distinctCount = componentDistinctSessions.get(component)?.size || 0;
      const compReason = `component-family "${component}" overused (${distinctCount} distinct sessions/7d) → ${compPenalty}`;
      reasons.set(slug, existing ? `${existing}; ${compReason}` : compReason);
    }
  }

  return { exercisePenalties, componentPenalties, reasons };
}
