/**
 * Adaptation Proof Hook
 * 
 * Queries exercise_events.task_parameters for adaptation telemetry fields
 * logged by buildAdaptationTelemetry across all games, producing a 
 * cross-game summary of adaptation behavior.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GameAdaptationRow {
  exerciseSlug: string;
  totalTrials: number;
  adaptedTrials: number;
  adaptationRate: number;
  adaptationModes: Record<string, number>;
  focusPhonemesUsed: string[];
  cueTypesRecommended: Record<string, number>;
  difficultyLevels: Record<number, number>;
  profileConfidences: Record<string, number>;
  lastPlayed: string | null;
}

export interface AdaptationProofSummary {
  totalTrials: number;
  totalAdapted: number;
  overallAdaptationRate: number;
  gamesWithAdaptation: number;
  totalGames: number;
  dominantMode: string;
  rows: GameAdaptationRow[];
}

export interface UseAdaptationProofResult {
  summary: AdaptationProofSummary | null;
  isLoading: boolean;
  refresh: () => void;
}

export const useAdaptationProof = (
  userId: string | undefined,
  daysBack = 14
): UseAdaptationProofResult => {
  const [rawEvents, setRawEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchCount, setFetchCount] = useState(0);

  const refresh = useCallback(() => setFetchCount(c => c + 1), []);

  useEffect(() => {
    if (!userId) return;
    
    const fetchEvents = async () => {
      setIsLoading(true);
      try {
        const since = new Date(Date.now() - daysBack * 86400000).toISOString();
        
        // Fetch exercise events with adaptation telemetry in task_parameters
        const { data, error } = await supabase
          .from('exercise_events')
          .select('exercise_slug, task_parameters, created_at, session_id')
          .gte('created_at', since)
          .not('task_parameters', 'is', null)
          .order('created_at', { ascending: false })
          .limit(2000);

        if (error) {
          console.error('[useAdaptationProof] Query error:', error);
          setRawEvents([]);
        } else {
          setRawEvents(data || []);
        }
      } catch (err) {
        console.error('[useAdaptationProof] Error:', err);
        setRawEvents([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [userId, daysBack, fetchCount]);

  const summary = useMemo<AdaptationProofSummary | null>(() => {
    if (rawEvents.length === 0 && !isLoading) return null;
    if (rawEvents.length === 0) return null;

    const gameMap = new Map<string, {
      trials: number;
      adapted: number;
      modes: Record<string, number>;
      phonemes: Set<string>;
      cues: Record<string, number>;
      difficulties: Record<number, number>;
      confidences: Record<string, number>;
      lastPlayed: string | null;
    }>();

    for (const event of rawEvents) {
      const slug = event.exercise_slug || 'unknown';
      const params = event.task_parameters as Record<string, any> | null;
      if (!params) continue;

      // Only count events that have adaptation telemetry fields
      const hasAdaptationFields = 'adaptation_applied' in params || 'adaptation_mode' in params;
      
      if (!gameMap.has(slug)) {
        gameMap.set(slug, {
          trials: 0,
          adapted: 0,
          modes: {},
          phonemes: new Set(),
          cues: {},
          difficulties: {},
          confidences: {},
          lastPlayed: null,
        });
      }

      const entry = gameMap.get(slug)!;
      entry.trials++;

      if (!entry.lastPlayed || event.created_at > entry.lastPlayed) {
        entry.lastPlayed = event.created_at;
      }

      if (hasAdaptationFields) {
        if (params.adaptation_applied) entry.adapted++;

        const mode = params.adaptation_mode || 'none';
        entry.modes[mode] = (entry.modes[mode] || 0) + 1;

        if (Array.isArray(params.focus_phonemes)) {
          params.focus_phonemes.forEach((p: string) => entry.phonemes.add(p));
        }

        const cue = params.recommended_cue_type || 'none';
        entry.cues[cue] = (entry.cues[cue] || 0) + 1;

        const diff = params.difficulty_level ?? 1;
        entry.difficulties[diff] = (entry.difficulties[diff] || 0) + 1;

        const conf = params.profile_confidence || 'none';
        entry.confidences[conf] = (entry.confidences[conf] || 0) + 1;
      }
    }

    const rows: GameAdaptationRow[] = Array.from(gameMap.entries()).map(([slug, data]) => ({
      exerciseSlug: slug,
      totalTrials: data.trials,
      adaptedTrials: data.adapted,
      adaptationRate: data.trials > 0 ? data.adapted / data.trials : 0,
      adaptationModes: data.modes,
      focusPhonemesUsed: Array.from(data.phonemes),
      cueTypesRecommended: data.cues,
      difficultyLevels: data.difficulties,
      profileConfidences: data.confidences,
      lastPlayed: data.lastPlayed,
    }));

    rows.sort((a, b) => b.totalTrials - a.totalTrials);

    const totalTrials = rows.reduce((s, r) => s + r.totalTrials, 0);
    const totalAdapted = rows.reduce((s, r) => s + r.adaptedTrials, 0);
    const gamesWithAdaptation = rows.filter(r => r.adaptedTrials > 0).length;

    // Find dominant mode across all games
    const globalModes: Record<string, number> = {};
    rows.forEach(r => {
      Object.entries(r.adaptationModes).forEach(([mode, count]) => {
        if (mode !== 'none') globalModes[mode] = (globalModes[mode] || 0) + count;
      });
    });
    const dominantMode = Object.entries(globalModes)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

    return {
      totalTrials,
      totalAdapted,
      overallAdaptationRate: totalTrials > 0 ? totalAdapted / totalTrials : 0,
      gamesWithAdaptation,
      totalGames: rows.length,
      dominantMode,
      rows,
    };
  }, [rawEvents, isLoading]);

  return { summary, isLoading, refresh };
};
