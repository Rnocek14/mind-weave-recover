/**
 * Adaptation Proof Hook
 * 
 * Queries exercise_events.task_parameters for adaptation telemetry fields
 * logged by buildAdaptationTelemetry across all games, producing a 
 * cross-game summary of adaptation behavior.
 * 
 * User-scoped via session ownership (exercise_events → sessions → user_id).
 * RLS on exercise_events enforces this at the DB level; we additionally
 * filter by session.user_id for defense-in-depth.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RecentAdaptedTrial {
  createdAt: string;
  exerciseSlug: string;
  adaptationMode: string;
  focusPhonemes: string[] | null;
  recommendedCueType: string;
  difficultyLevel: number;
  adaptationApplied: boolean;
  profileConfidence: string;
}

export interface DataQualityIssue {
  type: 'impossible_state' | 'missing_field';
  description: string;
  count: number;
}

export interface GameAdaptationRow {
  exerciseSlug: string;
  totalTrials: number;
  trialsWithTelemetry: number;
  telemetryCoverage: number;
  adaptedTrials: number;
  adaptationRate: number;
  adaptationModes: Record<string, number>;
  focusPhonemesUsed: string[];
  cueTypesRecommended: Record<string, number>;
  difficultyLevels: Record<number, number>;
  profileConfidences: Record<string, number>;
  lastPlayed: string | null;
  recentTrials: RecentAdaptedTrial[];
  dataQualityIssues: DataQualityIssue[];
}

export interface AdaptationProofSummary {
  totalTrials: number;
  trialsWithTelemetry: number;
  telemetryCoverage: number;
  totalAdapted: number;
  overallAdaptationRate: number;
  gamesWithAdaptation: number;
  totalGames: number;
  dominantMode: string;
  rows: GameAdaptationRow[];
  globalDataQuality: DataQualityIssue[];
}

export interface UseAdaptationProofResult {
  summary: AdaptationProofSummary | null;
  rawEvents: any[];
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
        
        // User-scoped: join through sessions to ensure ownership
        // RLS enforces this at DB level; explicit join for defense-in-depth
        const { data, error } = await supabase
          .from('exercise_events')
          .select('exercise_slug, task_parameters, created_at, session_id, sessions!inner(user_id)')
          .eq('sessions.user_id', userId)
          .gte('created_at', since)
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
    if (rawEvents.length === 0) return null;

    const gameMap = new Map<string, {
      trials: number;
      withTelemetry: number;
      adapted: number;
      modes: Record<string, number>;
      phonemes: Set<string>;
      cues: Record<string, number>;
      difficulties: Record<number, number>;
      confidences: Record<string, number>;
      lastPlayed: string | null;
      recentTrials: RecentAdaptedTrial[];
      issues: Map<string, DataQualityIssue>;
    }>();

    for (const event of rawEvents) {
      const slug = event.exercise_slug || 'unknown';
      const params = event.task_parameters as Record<string, any> | null;

      if (!gameMap.has(slug)) {
        gameMap.set(slug, {
          trials: 0,
          withTelemetry: 0,
          adapted: 0,
          modes: {},
          phonemes: new Set(),
          cues: {},
          difficulties: {},
          confidences: {},
          lastPlayed: null,
          recentTrials: [],
          issues: new Map(),
        });
      }

      const entry = gameMap.get(slug)!;
      entry.trials++;

      if (!entry.lastPlayed || event.created_at > entry.lastPlayed) {
        entry.lastPlayed = event.created_at;
      }

      // Check for adaptation telemetry presence
      const hasAdaptationFields = params && ('adaptation_applied' in params || 'adaptation_mode' in params);
      
      if (!hasAdaptationFields) continue;
      
      entry.withTelemetry++;

      const applied = !!params!.adaptation_applied;
      const mode = params!.adaptation_mode || 'none';
      const phonemes = Array.isArray(params!.focus_phonemes) ? params!.focus_phonemes : null;
      const cue = params!.recommended_cue_type || 'none';
      const diff = params!.difficulty_level ?? 1;
      const conf = params!.profile_confidence || 'none';

      if (applied) entry.adapted++;
      entry.modes[mode] = (entry.modes[mode] || 0) + 1;
      if (phonemes) phonemes.forEach((p: string) => entry.phonemes.add(p));
      entry.cues[cue] = (entry.cues[cue] || 0) + 1;
      entry.difficulties[diff] = (entry.difficulties[diff] || 0) + 1;
      entry.confidences[conf] = (entry.confidences[conf] || 0) + 1;

      // Impossible state detection
      if (applied && mode === 'none') {
        const key = 'applied_but_mode_none';
        const existing = entry.issues.get(key);
        if (existing) existing.count++;
        else entry.issues.set(key, { type: 'impossible_state', description: 'adaptation_applied=true but mode=none', count: 1 });
      }
      if (mode === 'phoneme_targeting' && (!phonemes || phonemes.length === 0)) {
        const key = 'phoneme_mode_no_phonemes';
        const existing = entry.issues.get(key);
        if (existing) existing.count++;
        else entry.issues.set(key, { type: 'impossible_state', description: 'phoneme_targeting mode with no focus_phonemes', count: 1 });
      }
      if (mode === 'cue_personalization' && cue === 'none') {
        const key = 'cue_mode_no_cue';
        const existing = entry.issues.get(key);
        if (existing) existing.count++;
        else entry.issues.set(key, { type: 'impossible_state', description: 'cue_personalization mode with cue_type=none', count: 1 });
      }

      // Collect recent trials for drill-down (keep up to 10 per game)
      if (entry.recentTrials.length < 10) {
        entry.recentTrials.push({
          createdAt: event.created_at,
          exerciseSlug: slug,
          adaptationMode: mode,
          focusPhonemes: phonemes,
          recommendedCueType: cue,
          difficultyLevel: diff,
          adaptationApplied: applied,
          profileConfidence: conf,
        });
      }
    }

    const rows: GameAdaptationRow[] = Array.from(gameMap.entries()).map(([slug, data]) => ({
      exerciseSlug: slug,
      totalTrials: data.trials,
      trialsWithTelemetry: data.withTelemetry,
      telemetryCoverage: data.trials > 0 ? data.withTelemetry / data.trials : 0,
      adaptedTrials: data.adapted,
      adaptationRate: data.withTelemetry > 0 ? data.adapted / data.withTelemetry : 0,
      adaptationModes: data.modes,
      focusPhonemesUsed: Array.from(data.phonemes),
      cueTypesRecommended: data.cues,
      difficultyLevels: data.difficulties,
      profileConfidences: data.confidences,
      lastPlayed: data.lastPlayed,
      recentTrials: data.recentTrials,
      dataQualityIssues: Array.from(data.issues.values()),
    }));

    rows.sort((a, b) => b.totalTrials - a.totalTrials);

    const totalTrials = rows.reduce((s, r) => s + r.totalTrials, 0);
    const trialsWithTelemetry = rows.reduce((s, r) => s + r.trialsWithTelemetry, 0);
    const totalAdapted = rows.reduce((s, r) => s + r.adaptedTrials, 0);
    const gamesWithAdaptation = rows.filter(r => r.adaptedTrials > 0).length;

    // Aggregate global data quality issues
    const globalIssueMap = new Map<string, DataQualityIssue>();
    rows.forEach(r => r.dataQualityIssues.forEach(issue => {
      const existing = globalIssueMap.get(issue.description);
      if (existing) existing.count += issue.count;
      else globalIssueMap.set(issue.description, { ...issue });
    }));

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
      trialsWithTelemetry,
      telemetryCoverage: totalTrials > 0 ? trialsWithTelemetry / totalTrials : 0,
      totalAdapted,
      overallAdaptationRate: trialsWithTelemetry > 0 ? totalAdapted / trialsWithTelemetry : 0,
      gamesWithAdaptation,
      totalGames: rows.length,
      dominantMode,
      rows,
      globalDataQuality: Array.from(globalIssueMap.values()),
    };
  }, [rawEvents]);

  return { summary, rawEvents, isLoading, refresh };
};
