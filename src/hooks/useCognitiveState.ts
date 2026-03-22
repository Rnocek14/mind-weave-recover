import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  computeCognitiveState, 
  computeTrend, 
  DOMAIN_VERSION,
  type CognitiveStateSnapshot, 
  type DomainScore,
  type ExerciseTrialRow 
} from '@/lib/cognitiveStateEngine';

interface UseCognitiveStateOptions {
  userId: string | undefined;
  profileId: string | undefined;
  windowDays?: number;
}

interface CognitiveStateResult {
  snapshot: CognitiveStateSnapshot | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook that computes and persists cognitive domain scores.
 * Fetches exercise_events for the window, computes scores, persists to DB.
 */
export function useCognitiveState({
  userId,
  profileId,
  windowDays = 14,
}: UseCognitiveStateOptions): CognitiveStateResult {
  const [snapshot, setSnapshot] = useState<CognitiveStateSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const windowEnd = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  const windowStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - windowDays);
    return d.toISOString().slice(0, 10);
  }, [windowDays]);

  const compute = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch sessions only within the time window to avoid URL length limits
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', userId)
        .gte('started_at', `${windowStart}T00:00:00Z`);

      const sessionIds = (sessions || []).map(s => s.id);
      if (sessionIds.length === 0) {
        setSnapshot(null);
        setIsLoading(false);
        return;
      }

      // Batch session IDs to avoid PostgREST URL length limits
      const BATCH_SIZE = 100;
      let allEvents: any[] = [];
      for (let i = 0; i < sessionIds.length; i += BATCH_SIZE) {
        const batch = sessionIds.slice(i, i + BATCH_SIZE);
        const { data: events, error: fetchError } = await supabase
          .from('exercise_events')
          .select('exercise_slug, score, reaction_time_ms, created_at, session_id, round, inputs, outputs')
          .in('session_id', batch)
          .gte('created_at', `${windowStart}T00:00:00Z`)
          .lte('created_at', `${windowEnd}T23:59:59Z`)
          .order('created_at', { ascending: true });
        if (fetchError) throw fetchError;
        if (events) allEvents = allEvents.concat(events);
      }

      const trials: ExerciseTrialRow[] = (events || []).map(e => ({
        exercise_slug: e.exercise_slug || '',
        score: e.score,
        reaction_time_ms: e.reaction_time_ms,
        created_at: e.created_at || '',
        session_id: e.session_id,
        round: e.round,
        inputs: e.inputs as Record<string, any> | undefined,
        outputs: e.outputs as Record<string, any> | undefined,
      }));

      // 2. Compute snapshot
      const newSnapshot = computeCognitiveState(trials, windowStart, windowEnd, 'week');

      // 3. Fetch previous scores for trend computation
      const prevWindowEnd = windowStart; // previous window ends where current starts
      const { data: prevScores } = await supabase
        .from('cognitive_domain_scores')
        .select('domain_slug, score')
        .eq('user_id', userId)
        .eq('granularity', 'week')
        .lt('window_end', prevWindowEnd)
        .order('window_end', { ascending: false })
        .limit(100); // Enough rows to cover all 7 domains with history

      // Group previous scores by domain
      const prevByDomain = new Map<string, number[]>();
      for (const row of prevScores || []) {
        const arr = prevByDomain.get(row.domain_slug) || [];
        arr.push(Number(row.score));
        prevByDomain.set(row.domain_slug, arr);
      }

      // Apply trends
      for (const domain of newSnapshot.domains) {
        const prev = prevByDomain.get(domain.domainSlug) || [];
        domain.trend = computeTrend(domain.score, prev);
      }

      setSnapshot(newSnapshot);

      // 4. Persist scores (fire-and-forget)
      persistScores(userId, profileId, newSnapshot).catch(err =>
        console.warn('[CognitiveState] Persist failed:', err)
      );
    } catch (err: any) {
      console.error('[CognitiveState] Compute error:', err);
      setError(err.message || 'Failed to compute cognitive state');
    } finally {
      setIsLoading(false);
    }
  }, [userId, profileId, windowStart, windowEnd]);

  useEffect(() => {
    compute();
  }, [compute]);

  return { snapshot, isLoading, error, refresh: compute };
}

/**
 * Persist computed domain scores to cognitive_domain_scores table
 */
async function persistScores(
  userId: string,
  profileId: string | undefined,
  snapshot: CognitiveStateSnapshot
): Promise<void> {
  const rows = snapshot.domains
    .filter(d => d.trialCount >= 3) // Only persist if meaningful data
    .map(d => ({
      user_id: userId,
      profile_id: profileId || null,
      domain_slug: d.domainSlug,
      score: d.score,
      score_components: d.scoreComponents,
      trial_count: d.trialCount,
      confidence: d.confidence,
      fatigue_sensitivity: d.fatigueSensitivity,
      granularity: snapshot.granularity,
      domain_version: DOMAIN_VERSION,
      window_start: snapshot.windowStart,
      window_end: snapshot.windowEnd,
      computed_at: snapshot.computedAt,
      transfer_index: d.transferIndex,
      transfer_components: d.transferComponents as Record<string, any> | null,
    }));

  if (rows.length === 0) return;

  // Upsert using the generated profile_key column + real unique constraint
  const { error } = await supabase
    .from('cognitive_domain_scores')
    .upsert(rows, {
      onConflict: 'user_id,profile_key,domain_slug,window_end,granularity',
    });

  if (error) {
    console.error('[CognitiveState] Upsert error:', error);
  }
}
