/**
 * useOutcomeProof — aggregates telemetry into outcome proof metrics
 * 
 * Surfaces:
 * 1. Difficulty progression over time (per exercise)
 * 2. Success rate windows (rolling accuracy)
 * 3. Cue effectiveness by type
 * 4. Latency trends (response time improvement)
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CuePreferenceLearner, type CueType, type CueStats } from '@/lib/cuePreferenceLearner';

export interface DifficultyStep {
  date: string;
  exercise: string;
  levelBefore: number;
  levelAfter: number;
  direction: 'up' | 'down';
  successRate: number;
}

export interface LatencyDataPoint {
  weekLabel: string;
  avgLatencyMs: number;
  trialCount: number;
}

export interface ExerciseAccuracyTrend {
  exercise: string;
  windows: { label: string; accuracy: number; trials: number }[];
}

export interface CueEffectivenessData {
  cueType: string;
  successRate: number;
  attempts: number;
}

export interface OutcomeProofData {
  difficultySteps: DifficultyStep[];
  latencyTrend: LatencyDataPoint[];
  accuracyTrends: ExerciseAccuracyTrend[];
  cueEffectiveness: CueEffectivenessData[];
  cueInsight: string | null;
  totalAdaptations: number;
  totalTrials: number;
  overallAccuracy: number;
  avgLatencyMs: number;
}

export function useOutcomeProof(userId: string | undefined, daysBack = 30) {
  const [data, setData] = useState<OutcomeProofData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setIsLoading(false); return; }

    const load = async () => {
      setIsLoading(true);
      try {
        const since = new Date();
        since.setDate(since.getDate() - daysBack);
        const sinceISO = since.toISOString();

        // 1. Adaptation events (difficulty changes)
        const { data: adaptEvents } = await supabase
          .from('adaptation_events')
          .select('created_at, exercise_slug, adaptation_type, value_before, value_after, evidence')
          .eq('user_id', userId)
          .eq('adaptation_type', 'difficulty_change')
          .gte('created_at', sinceISO)
          .order('created_at', { ascending: true })
          .limit(200);

        const difficultySteps: DifficultyStep[] = (adaptEvents || []).map(e => ({
          date: e.created_at,
          exercise: e.exercise_slug || 'unknown',
          levelBefore: typeof e.value_before === 'number' ? e.value_before : (e.value_before as any)?.level ?? 0,
          levelAfter: typeof e.value_after === 'number' ? e.value_after : (e.value_after as any)?.level ?? 0,
          direction: ((typeof e.value_after === 'number' ? e.value_after : (e.value_after as any)?.level ?? 0) >
                      (typeof e.value_before === 'number' ? e.value_before : (e.value_before as any)?.level ?? 0)) ? 'up' : 'down',
          successRate: (e.evidence as any)?.successRate ?? 0,
        }));

        // 2. Exercise events for latency + accuracy
        const { data: trials } = await supabase
          .from('exercise_events')
          .select('created_at, exercise_slug, score, reaction_time_ms, cue_type_given, cue_was_effective')
          .eq('session_id', userId) // join via session
          .gte('created_at', sinceISO)
          .limit(1000);

        // Actually we need to join through sessions — let's query differently
        const { data: sessions } = await supabase
          .from('sessions')
          .select('id')
          .eq('user_id', userId)
          .gte('started_at', sinceISO)
          .limit(100);

        const sessionIds = (sessions || []).map(s => s.id);
        
        let allTrials: any[] = [];
        if (sessionIds.length > 0) {
          // Batch in chunks of 20
          for (let i = 0; i < sessionIds.length; i += 20) {
            const chunk = sessionIds.slice(i, i + 20);
            const { data: trialChunk } = await supabase
              .from('exercise_events')
              .select('created_at, exercise_slug, score, reaction_time_ms, cue_type_given, cue_was_effective')
              .in('session_id', chunk)
              .order('created_at', { ascending: true })
              .limit(500);
            if (trialChunk) allTrials.push(...trialChunk);
          }
        }

        // Compute overall stats
        const totalTrials = allTrials.length;
        const correctTrials = allTrials.filter(t => t.score === 1 || t.score === 100).length;
        const overallAccuracy = totalTrials > 0 ? correctTrials / totalTrials : 0;
        
        const latencies = allTrials.filter(t => t.reaction_time_ms && t.reaction_time_ms > 0);
        const avgLatencyMs = latencies.length > 0 
          ? latencies.reduce((s, t) => s + t.reaction_time_ms, 0) / latencies.length 
          : 0;

        // 3. Latency trend by week
        const weekBuckets = new Map<string, { total: number; count: number }>();
        for (const t of latencies) {
          const d = new Date(t.created_at);
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay());
          const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
          const bucket = weekBuckets.get(label) || { total: 0, count: 0 };
          bucket.total += t.reaction_time_ms;
          bucket.count += 1;
          weekBuckets.set(label, bucket);
        }
        const latencyTrend: LatencyDataPoint[] = Array.from(weekBuckets.entries()).map(([label, b]) => ({
          weekLabel: label,
          avgLatencyMs: Math.round(b.total / b.count),
          trialCount: b.count,
        }));

        // 4. Accuracy trends per exercise (weekly windows)
        const exerciseWeeks = new Map<string, Map<string, { correct: number; total: number }>>();
        for (const t of allTrials) {
          const slug = t.exercise_slug || 'unknown';
          const d = new Date(t.created_at);
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay());
          const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
          
          if (!exerciseWeeks.has(slug)) exerciseWeeks.set(slug, new Map());
          const weeks = exerciseWeeks.get(slug)!;
          const bucket = weeks.get(label) || { correct: 0, total: 0 };
          bucket.total += 1;
          if (t.score === 1 || t.score === 100) bucket.correct += 1;
          weeks.set(label, bucket);
        }
        
        const accuracyTrends: ExerciseAccuracyTrend[] = Array.from(exerciseWeeks.entries())
          .filter(([_, weeks]) => weeks.size > 0)
          .map(([exercise, weeks]) => ({
            exercise,
            windows: Array.from(weeks.entries()).map(([label, b]) => ({
              label,
              accuracy: b.total > 0 ? b.correct / b.total : 0,
              trials: b.total,
            })),
          }))
          .sort((a, b) => {
            const totalA = a.windows.reduce((s, w) => s + w.trials, 0);
            const totalB = b.windows.reduce((s, w) => s + w.trials, 0);
            return totalB - totalA;
          })
          .slice(0, 8);

        // 5. Cue effectiveness from CuePreferenceLearner
        const learner = new CuePreferenceLearner(userId);
        const cueState = learner.getState();
        const cueEffectiveness: CueEffectivenessData[] = (['semantic', 'phonemic', 'sentence', 'visual'] as CueType[])
          .map(ct => ({
            cueType: ct,
            successRate: cueState.stats[ct].attempts > 0 
              ? cueState.stats[ct].successes / cueState.stats[ct].attempts 
              : 0,
            attempts: cueState.stats[ct].attempts,
          }))
          .filter(c => c.attempts > 0);

        const cueInsight = learner.generateInsight();

        setData({
          difficultySteps,
          latencyTrend,
          accuracyTrends,
          cueEffectiveness,
          cueInsight,
          totalAdaptations: difficultySteps.length,
          totalTrials,
          overallAccuracy,
          avgLatencyMs,
        });
      } catch (err) {
        console.error('Failed to load outcome proof:', err);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [userId, daysBack]);

  return { data, isLoading };
}
