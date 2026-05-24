/**
 * Adaptation Timeline Hook
 * 
 * Fetches recent adaptation events for display in the timeline view.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AdaptationEvent {
  id: string;
  user_id: string;
  profile_id: string | null;
  session_id: string | null;
  exercise_slug: string | null;
  trial_index: number | null;
  adaptation_type: string;
  layer: 'session' | 'in_game';
  // Raw JSONB values (not wrapped in {value: ...})
  value_before: unknown;
  value_after: unknown;
  trigger_type: string;
  trigger_rule_id: string | null;
  trigger_condition: string | null;
  evidence: Record<string, unknown>;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  created_at: string;
}

interface UseAdaptationTimelineResult {
  events: AdaptationEvent[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

export const useAdaptationTimeline = (
  userId: string | undefined,
  daysBack = 7,
  limit = 100,
  profileId?: string | undefined
): UseAdaptationTimelineResult => {
  const [events, setEvents] = useState<AdaptationEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!userId) {
      setEvents([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      let query = supabase
        .from('adaptation_events' as any)
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (profileId) {
        query = query.eq('profile_id', profileId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Cast through unknown to handle new table type
      setEvents((data || []) as unknown as AdaptationEvent[]);
    } catch (err) {
      console.error('[useAdaptationTimeline] Error fetching events:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch adaptation events'));
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId, daysBack, limit, profileId]);


  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    isLoading,
    error,
    refresh: fetchEvents,
  };
};
