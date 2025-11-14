import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ClusterProfile {
  strokeMechanism: string;
  hemisphere: string;
  lesionZone: string;
  chronicity: string;
}

export interface ClusterMetrics {
  avgSessionAccuracy: number;
  improvementTrend: number;
  sessionsPerWeek: number;
  redFlagRate: number;
  interventionAcceptance: Record<string, number>;
  cohortSize: number;
  outcomeVariability: {
    accuracyStdDev: number;
    trendStdDev: number;
  };
}

export interface EffectiveStrategy {
  name: string;
  description: string;
  effectivenessScore: number;
  sampleSize: number;
}

export interface ClusterAnalytics {
  clusterProfile: ClusterProfile;
  users: string[];
  metrics: ClusterMetrics;
  topStrategies: EffectiveStrategy[];
}

export interface AdminResearchAnalytics {
  clusters: ClusterAnalytics[];
  totalUsers: number;
  dataQualityScore: number;
  generatedAt: string;
}

interface Session {
  id: string;
  user_id: string;
  started_at: string;
  summary: any;
}

const calculateStdDev = (values: number[]): number => {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squareDiffs = values.map(val => Math.pow(val - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
};

const calculateLinearTrend = (sessions: Session[]): number => {
  if (sessions.length < 2) return 0;
  
  const sorted = [...sessions].sort((a, b) => 
    new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  );
  
  const n = sorted.length;
  const x = sorted.map((_, i) => i);
  const y = sorted.map(s => {
    const summary = s.summary as any;
    return summary?.accuracy || 0;
  });
  
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  
  const numerator = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0);
  const denominator = x.reduce((sum, xi) => sum + Math.pow(xi - meanX, 2), 0);
  
  return denominator === 0 ? 0 : numerator / denominator;
};

const calculateAdherence = (sessions: Session[]): number => {
  if (sessions.length === 0) return 0;
  
  const sorted = [...sessions].sort((a, b) => 
    new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  );
  
  const firstDate = new Date(sorted[0].started_at);
  const lastDate = new Date(sorted[sorted.length - 1].started_at);
  const weeksActive = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
  
  return sessions.length / weeksActive;
};

export const useAdminResearchAnalytics = () => {
  const [data, setData] = useState<AdminResearchAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch cluster assignments using the secure function
      const { data: assignments, error: assignError } = await supabase
        .rpc('get_cluster_assignments');

      if (assignError) throw assignError;

      if (!assignments || assignments.length === 0) {
        setData({
          clusters: [],
          totalUsers: 0,
          dataQualityScore: 0,
          generatedAt: new Date().toISOString()
        });
        return;
      }

      // Group users by cluster
      const clusterMap = new Map<string, string[]>();
      const clusterProfiles = new Map<string, ClusterProfile>();
      
      assignments.forEach((assignment: any) => {
        const key = assignment.cluster_key;
        if (!clusterMap.has(key)) {
          clusterMap.set(key, []);
          clusterProfiles.set(key, {
            strokeMechanism: assignment.stroke_mechanism,
            hemisphere: assignment.hemisphere,
            lesionZone: assignment.lesion_zone,
            chronicity: assignment.chronicity
          });
        }
        clusterMap.get(key)!.push(assignment.user_id);
      });

      // Calculate metrics for each cluster
      const clusterAnalytics: ClusterAnalytics[] = [];

      for (const [clusterKey, userIds] of clusterMap.entries()) {
        const profile = clusterProfiles.get(clusterKey)!;

        // Fetch all sessions for this cluster
        const { data: sessions, error: sessionsError } = await supabase
          .from('sessions')
          .select('id, user_id, started_at, summary')
          .in('user_id', userIds)
          .not('summary', 'is', null);

        if (sessionsError) throw sessionsError;

        if (!sessions || sessions.length === 0) {
          clusterAnalytics.push({
            clusterProfile: profile,
            users: userIds,
            metrics: {
              avgSessionAccuracy: 0,
              improvementTrend: 0,
              sessionsPerWeek: 0,
              redFlagRate: 0,
              interventionAcceptance: {},
              cohortSize: userIds.length,
              outcomeVariability: { accuracyStdDev: 0, trendStdDev: 0 }
            },
            topStrategies: []
          });
          continue;
        }

        // Calculate average accuracy
        const accuracies = sessions
          .map(s => {
            const summary = s.summary as any;
            return summary?.accuracy;
          })
          .filter((a): a is number => a != null);
        const avgAccuracy = accuracies.length > 0 
          ? accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length 
          : 0;

        // Calculate improvement trends per user
        const userSessions = new Map<string, Session[]>();
        sessions.forEach(s => {
          if (!userSessions.has(s.user_id)) {
            userSessions.set(s.user_id, []);
          }
          userSessions.get(s.user_id)!.push(s);
        });

        const trends = Array.from(userSessions.values()).map(calculateLinearTrend);
        const avgTrend = trends.length > 0 
          ? trends.reduce((sum, t) => sum + t, 0) / trends.length 
          : 0;

        // Calculate adherence per user
        const adherenceRates = Array.from(userSessions.values()).map(calculateAdherence);
        const avgAdherence = adherenceRates.length > 0
          ? adherenceRates.reduce((sum, r) => sum + r, 0) / adherenceRates.length
          : 0;

        // Calculate red flag rate (using engagement flags from exercise_events)
        const { data: events, error: eventsError } = await supabase
          .from('exercise_events')
          .select('engagement_flags, session_id')
          .in('session_id', sessions.map(s => s.id));

        if (eventsError) throw eventsError;

        const redFlagCount = events?.filter(e => 
          e.engagement_flags && Object.keys(e.engagement_flags).length > 0
        ).length || 0;
        const redFlagRate = sessions.length > 0 ? redFlagCount / sessions.length : 0;

        // Calculate intervention acceptance rates
        const { data: interventions, error: intError } = await supabase
          .from('engagement_interventions')
          .select('trigger_type, user_action')
          .in('session_id', sessions.map(s => s.id));

        if (intError) throw intError;

        const acceptanceByType: Record<string, { total: number; accepted: number }> = {};
        interventions?.forEach(int => {
          if (!acceptanceByType[int.trigger_type]) {
            acceptanceByType[int.trigger_type] = { total: 0, accepted: 0 };
          }
          acceptanceByType[int.trigger_type].total++;
          if (int.user_action === 'accepted') {
            acceptanceByType[int.trigger_type].accepted++;
          }
        });

        const interventionAcceptance: Record<string, number> = {};
        Object.entries(acceptanceByType).forEach(([type, counts]) => {
          interventionAcceptance[type] = counts.total > 0 
            ? counts.accepted / counts.total 
            : 0;
        });

        // Calculate variability
        const accuracyStdDev = calculateStdDev(accuracies);
        const trendStdDev = calculateStdDev(trends);

        // Identify effective strategies
        const strategies = await identifyEffectiveStrategies(userIds, sessions);

        clusterAnalytics.push({
          clusterProfile: profile,
          users: userIds,
          metrics: {
            avgSessionAccuracy: avgAccuracy,
            improvementTrend: avgTrend,
            sessionsPerWeek: avgAdherence,
            redFlagRate,
            interventionAcceptance,
            cohortSize: userIds.length,
            outcomeVariability: {
              accuracyStdDev,
              trendStdDev
            }
          },
          topStrategies: strategies
        });
      }

      // Calculate data quality score
      const completeProfiles = assignments.filter((a: any) => 
        a.stroke_mechanism !== 'unknown' && 
        a.hemisphere !== 'unknown' &&
        a.chronicity !== 'unknown'
      ).length;
      const dataQualityScore = assignments.length > 0 
        ? completeProfiles / assignments.length 
        : 0;

      setData({
        clusters: clusterAnalytics,
        totalUsers: assignments.length,
        dataQualityScore,
        generatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error fetching admin analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return { data, loading, error, refetch: fetchAnalytics };
};

async function identifyEffectiveStrategies(
  userIds: string[],
  sessions: Session[]
): Promise<EffectiveStrategy[]> {
  const strategies: Record<string, {
    successCount: number;
    totalCount: number;
    description: string;
  }> = {
    'varied_exercises': {
      successCount: 0,
      totalCount: 0,
      description: 'Exercise variety to combat plateaus'
    },
    'gamification': {
      successCount: 0,
      totalCount: 0,
      description: 'Interactive game-based therapy'
    },
    'motivational_support': {
      successCount: 0,
      totalCount: 0,
      description: 'Encouragement and positive feedback'
    },
    'adaptive_pacing': {
      successCount: 0,
      totalCount: 0,
      description: 'Break management and workload adjustment'
    }
  };

  // Fetch accepted interventions for these users
  const { data: interventions } = await supabase
    .from('engagement_interventions')
    .select('*, sessions!inner(user_id, started_at)')
    .in('sessions.user_id', userIds)
    .eq('user_action', 'accepted')
    .order('created_at', { ascending: true });

  if (!interventions) return [];

  // For each intervention, check if performance improved
  for (const intervention of interventions) {
    const sessionDate = new Date(intervention.created_at);
    const userId = (intervention.sessions as any).user_id;

    // Get sessions before and after
    const userSessions = sessions.filter(s => s.user_id === userId);
    const beforeSessions = userSessions
      .filter(s => new Date(s.started_at) < sessionDate)
      .slice(-3);
    const afterSessions = userSessions
      .filter(s => new Date(s.started_at) > sessionDate)
      .slice(0, 3);

    if (beforeSessions.length < 2 || afterSessions.length < 2) continue;

    const beforeAccuracy = beforeSessions.reduce((sum, s) => {
      const summary = s.summary as any;
      return sum + (summary?.accuracy || 0);
    }, 0) / beforeSessions.length;
    const afterAccuracy = afterSessions.reduce((sum, s) => {
      const summary = s.summary as any;
      return sum + (summary?.accuracy || 0);
    }, 0) / afterSessions.length;

    const improvement = afterAccuracy - beforeAccuracy;

    // Map intervention type to strategy
    let strategyKey: string | null = null;
    if (intervention.trigger_type === 'plateau') {
      strategyKey = 'varied_exercises';
    } else if (intervention.trigger_type === 'low_engagement') {
      strategyKey = 'gamification';
    } else if (intervention.trigger_type === 'low_adherence') {
      strategyKey = 'motivational_support';
    } else if (intervention.trigger_type === 'fatigue') {
      strategyKey = 'adaptive_pacing';
    }

    if (strategyKey) {
      strategies[strategyKey].totalCount++;
      if (improvement > 0.05) {
        strategies[strategyKey].successCount++;
      }
    }
  }

  // Convert to array and sort by effectiveness
  return Object.entries(strategies)
    .filter(([_, data]) => data.totalCount >= 3)
    .map(([name, data]) => ({
      name,
      description: data.description,
      effectivenessScore: data.successCount / data.totalCount,
      sampleSize: data.totalCount
    }))
    .sort((a, b) => b.effectivenessScore - a.effectivenessScore)
    .slice(0, 2);
}
