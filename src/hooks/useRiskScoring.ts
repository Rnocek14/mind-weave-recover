import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RiskFactors {
  dropoutRisk: number; // 0-1
  plateauRisk: number; // 0-1
  regressionRisk: number; // 0-1
  overallRisk: number; // 0-1 (max of the three)
}

export interface RiskIndicators {
  sessionFrequencyDecline: boolean;
  lowRecentAdherence: boolean;
  performanceDecline: boolean;
  flatProgress: boolean;
  highErrorRate: boolean;
  increasingCueDependence: boolean;
  daysSinceLastSession: number;
  recentAccuracyTrend: number; // positive = improving, negative = declining
}

export interface UserRiskProfile {
  userId: string;
  displayName: string;
  clusterKey: string;
  riskFactors: RiskFactors;
  indicators: RiskIndicators;
  recommendation: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  sessionCount: number;
  lastSessionDate: string | null;
}

interface ClusterBenchmark {
  avgAccuracy: number;
  avgSessionsPerWeek: number;
  avgImprovementRate: number;
  avgCueLevel: number;
}

export const useRiskScoring = () => {
  const [users, setUsers] = useState<UserRiskProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateRiskScores = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch cluster assignments
      const { data: assignments, error: assignError } = await supabase
        .rpc('get_cluster_assignments');

      if (assignError) throw assignError;
      if (!assignments || assignments.length === 0) {
        setUsers([]);
        return;
      }

      // Group users by cluster to calculate benchmarks
      const clusterMap = new Map<string, string[]>();
      assignments.forEach((a: any) => {
        if (!clusterMap.has(a.cluster_key)) {
          clusterMap.set(a.cluster_key, []);
        }
        clusterMap.get(a.cluster_key)!.push(a.user_id);
      });

      // Calculate cluster benchmarks
      const clusterBenchmarks = new Map<string, ClusterBenchmark>();
      
      for (const [clusterKey, userIds] of clusterMap.entries()) {
        const { data: sessions } = await supabase
          .from('sessions')
          .select('user_id, started_at, summary')
          .in('user_id', userIds)
          .not('summary', 'is', null);

        if (!sessions || sessions.length === 0) continue;

        const accuracies: number[] = [];
        const cueLevels: number[] = [];
        let totalSessions = 0;
        const userSessionCounts = new Map<string, number>();

        sessions.forEach(s => {
          const summary = s.summary as any;
          if (summary?.accuracy != null) {
            accuracies.push(summary.accuracy);
          }
          if (summary?.avg_cue_level != null) {
            cueLevels.push(summary.avg_cue_level);
          }
          totalSessions++;
          userSessionCounts.set(
            s.user_id, 
            (userSessionCounts.get(s.user_id) || 0) + 1
          );
        });

        const avgAccuracy = accuracies.length > 0 
          ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length 
          : 0;
        
        const avgCueLevel = cueLevels.length > 0
          ? cueLevels.reduce((a, b) => a + b, 0) / cueLevels.length
          : 0;

        // Calculate avg sessions per week (rough estimate)
        const avgSessionsPerWeek = totalSessions / (userIds.length * 4); // assume 4 weeks of data

        // Calculate improvement rate (simplified)
        const sorted = sessions.sort((a, b) => 
          new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
        );
        const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
        const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
        
        const firstHalfAccuracy = firstHalf
          .map(s => (s.summary as any)?.accuracy)
          .filter((a): a is number => a != null)
          .reduce((sum, a) => sum + a, 0) / firstHalf.length;
        
        const secondHalfAccuracy = secondHalf
          .map(s => (s.summary as any)?.accuracy)
          .filter((a): a is number => a != null)
          .reduce((sum, a) => sum + a, 0) / secondHalf.length;
        
        const avgImprovementRate = secondHalfAccuracy - firstHalfAccuracy;

        clusterBenchmarks.set(clusterKey, {
          avgAccuracy,
          avgSessionsPerWeek,
          avgImprovementRate,
          avgCueLevel
        });
      }

      // Analyze each user for risk factors
      const riskProfiles: UserRiskProfile[] = [];

      for (const assignment of assignments) {
        const userId = assignment.user_id;
        const clusterKey = assignment.cluster_key;
        const benchmark = clusterBenchmarks.get(clusterKey);

        if (!benchmark) continue;

        // Fetch user's profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', userId)
          .single();

        // Fetch user's sessions (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: userSessions } = await supabase
          .from('sessions')
          .select('started_at, summary')
          .eq('user_id', userId)
          .gte('started_at', thirtyDaysAgo.toISOString())
          .order('started_at', { ascending: true });

        if (!userSessions || userSessions.length === 0) {
          // No recent sessions = high dropout risk
          riskProfiles.push({
            userId,
            displayName: profile?.display_name || 'Unknown',
            clusterKey,
            riskFactors: {
              dropoutRisk: 0.9,
              plateauRisk: 0,
              regressionRisk: 0,
              overallRisk: 0.9
            },
            indicators: {
              sessionFrequencyDecline: true,
              lowRecentAdherence: true,
              performanceDecline: false,
              flatProgress: false,
              highErrorRate: false,
              increasingCueDependence: false,
              daysSinceLastSession: 999,
              recentAccuracyTrend: 0
            },
            recommendation: 'Critical: No activity in 30 days. Immediate outreach recommended.',
            priority: 'critical',
            sessionCount: 0,
            lastSessionDate: null
          });
          continue;
        }

        // Calculate user metrics
        const lastSessionDate = userSessions[userSessions.length - 1].started_at;
        const daysSinceLastSession = Math.floor(
          (Date.now() - new Date(lastSessionDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        const sessionCount = userSessions.length;
        const sessionsPerWeek = (sessionCount / 30) * 7;

        // Split into recent (last 2 weeks) and previous (2-4 weeks ago)
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        const recentSessions = userSessions.filter(s => 
          new Date(s.started_at) >= twoWeeksAgo
        );
        const previousSessions = userSessions.filter(s => 
          new Date(s.started_at) < twoWeeksAgo
        );

        const getAvgAccuracy = (sessions: any[]) => {
          const accuracies = sessions
            .map(s => (s.summary as any)?.accuracy)
            .filter((a): a is number => a != null);
          return accuracies.length > 0 
            ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length 
            : 0;
        };

        const getAvgCueLevel = (sessions: any[]) => {
          const cueLevels = sessions
            .map(s => (s.summary as any)?.avg_cue_level)
            .filter((c): c is number => c != null);
          return cueLevels.length > 0
            ? cueLevels.reduce((a, b) => a + b, 0) / cueLevels.length
            : 0;
        };

        const recentAccuracy = getAvgAccuracy(recentSessions);
        const previousAccuracy = getAvgAccuracy(previousSessions);
        const recentCueLevel = getAvgCueLevel(recentSessions);
        const previousCueLevel = getAvgCueLevel(previousSessions);

        const accuracyTrend = recentAccuracy - previousAccuracy;
        const cueLevelTrend = recentCueLevel - previousCueLevel;

        // Calculate risk indicators
        const indicators: RiskIndicators = {
          sessionFrequencyDecline: recentSessions.length < previousSessions.length,
          lowRecentAdherence: sessionsPerWeek < benchmark.avgSessionsPerWeek * 0.6,
          performanceDecline: accuracyTrend < -0.05, // 5% decline
          flatProgress: Math.abs(accuracyTrend) < 0.02 && sessionCount > 10, // no change
          highErrorRate: recentAccuracy < benchmark.avgAccuracy * 0.7,
          increasingCueDependence: cueLevelTrend > 0.5,
          daysSinceLastSession,
          recentAccuracyTrend: accuracyTrend
        };

        // Calculate risk scores (0-1)
        let dropoutRisk = 0;
        let plateauRisk = 0;
        let regressionRisk = 0;

        // Dropout Risk
        if (daysSinceLastSession > 14) dropoutRisk += 0.4;
        else if (daysSinceLastSession > 7) dropoutRisk += 0.2;
        
        if (indicators.sessionFrequencyDecline) dropoutRisk += 0.3;
        if (indicators.lowRecentAdherence) dropoutRisk += 0.3;

        // Plateau Risk
        if (indicators.flatProgress) plateauRisk += 0.5;
        if (sessionCount > 15 && Math.abs(accuracyTrend) < 0.01) plateauRisk += 0.3;
        if (recentAccuracy < 0.9 && Math.abs(accuracyTrend) < 0.02) plateauRisk += 0.2;

        // Regression Risk
        if (indicators.performanceDecline) regressionRisk += 0.5;
        if (indicators.highErrorRate) regressionRisk += 0.3;
        if (indicators.increasingCueDependence) regressionRisk += 0.2;

        // Cap at 1.0
        dropoutRisk = Math.min(1.0, dropoutRisk);
        plateauRisk = Math.min(1.0, plateauRisk);
        regressionRisk = Math.min(1.0, regressionRisk);

        const overallRisk = Math.max(dropoutRisk, plateauRisk, regressionRisk);

        // Generate recommendation
        let recommendation = '';
        let priority: 'critical' | 'high' | 'medium' | 'low' = 'low';

        if (dropoutRisk >= 0.7) {
          recommendation = 'High dropout risk. Immediate contact and motivation boost needed.';
          priority = 'critical';
        } else if (regressionRisk >= 0.7) {
          recommendation = 'Performance declining. Review therapy plan and adjust difficulty.';
          priority = 'high';
        } else if (plateauRisk >= 0.7) {
          recommendation = 'Progress plateaued. Introduce exercise variety and new challenges.';
          priority = 'high';
        } else if (overallRisk >= 0.5) {
          recommendation = 'Moderate risk detected. Monitor closely and consider intervention.';
          priority = 'medium';
        } else {
          recommendation = 'Low risk. Continue current therapy approach.';
          priority = 'low';
        }

        riskProfiles.push({
          userId,
          displayName: profile?.display_name || 'Unknown',
          clusterKey,
          riskFactors: {
            dropoutRisk,
            plateauRisk,
            regressionRisk,
            overallRisk
          },
          indicators,
          recommendation,
          priority,
          sessionCount,
          lastSessionDate
        });
      }

      // Sort by overall risk (highest first)
      riskProfiles.sort((a, b) => b.riskFactors.overallRisk - a.riskFactors.overallRisk);

      setUsers(riskProfiles);
    } catch (err) {
      console.error('Error calculating risk scores:', err);
      setError(err instanceof Error ? err.message : 'Failed to calculate risk scores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateRiskScores();
  }, []);

  return { users, loading, error, refetch: calculateRiskScores };
};
