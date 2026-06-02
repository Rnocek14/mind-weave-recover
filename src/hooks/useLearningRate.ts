import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateAllLearningRates } from '@/lib/learningRateCalculator';

export interface LearningRate {
  domain: string;
  window: number; // days
  accuracySlope: number; // % per day
  rtSlope: number; // ms per day
  trend: 'improving' | 'plateau' | 'declining';
  trialCount: number;
  confidence: number; // 0-1
  startAccuracy: number;
  endAccuracy: number;
}

export interface ClusterComparison {
  domain: string;
  window: number;
  userSlope: number;
  clusterMedian: number;
  clusterP25: number;
  clusterP75: number;
  percentile: number; // Where user sits in cluster (0-100)
  userCount: number;
}

interface UseLearningRateOptions {
  autoCalculate?: boolean;
  enabled?: boolean;
  profileId?: string;
}

export const useLearningRate = (
  userId: string | null | undefined,
  options: UseLearningRateOptions = {}
) => {
  const { autoCalculate = true, enabled = true, profileId } = options;
  const [learningRates, setLearningRates] = useState<LearningRate[]>([]);
  const [clusterComparisons, setClusterComparisons] = useState<ClusterComparison[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !userId) {
      setIsLoading(false);
      return;
    }

    const fetchLearningRates = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch user's learning rates (scoped to profile when provided)
        let lrQ = supabase
          .from('learning_rates')
          .select('*')
          .eq('user_id', userId)
          .order('calculated_at', { ascending: false });
        if (profileId) lrQ = lrQ.eq('profile_id', profileId);
        const { data: rates, error: ratesError } = await lrQ;

        if (ratesError) throw ratesError;

        if (!rates || rates.length === 0) {
          // No learning rates yet - user needs to calculate them manually
          setLearningRates([]);
          setIsLoading(false);
          return;
        }

        // Transform to LearningRate format
        const transformed = rates.map(rate => ({
          domain: rate.domain,
          window: rate.time_window_days,
          accuracySlope: Number(rate.accuracy_slope || 0),
          rtSlope: Number(rate.rt_slope || 0),
          trend: determineTrend(Number(rate.accuracy_slope || 0)),
          trialCount: rate.trial_count,
          confidence: Number(rate.confidence_score || 0),
          startAccuracy: Number(rate.start_accuracy || 0),
          endAccuracy: Number(rate.end_accuracy || 0)
        }));

        setLearningRates(transformed);

        // Fetch cluster comparisons
        await fetchClusterComparisons(userId, transformed);

      } catch (err) {
        console.error('Error fetching learning rates:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLearningRates();
  }, [userId, autoCalculate, enabled, profileId]);

  const fetchClusterComparisons = async (uid: string, userRates: LearningRate[]) => {
    try {
      // Get user's cluster
      const { data: cluster } = await supabase
        .from('user_cluster_assignments')
        .select('cluster_key')
        .eq('user_id', uid)
        .single();

      if (!cluster?.cluster_key) return;

      // Fetch cluster learning rates
      const { data: clusterRates, error: clusterError } = await supabase
        .from('cluster_learning_rates')
        .select('*')
        .eq('cluster_key', cluster.cluster_key);

      if (clusterError) {
        console.error('Error fetching cluster rates:', clusterError);
        return;
      }

      if (!clusterRates) return;

      // Match user rates with cluster rates
      const comparisons: ClusterComparison[] = [];

      for (const userRate of userRates) {
        const matchingCluster = clusterRates.find(
          cr => cr.domain === userRate.domain && cr.time_window_days === userRate.window
        );

        if (matchingCluster) {
          const clusterMedian = Number(matchingCluster.median_accuracy_slope || 0);
          const clusterP25 = Number(matchingCluster.p25_accuracy_slope || 0);
          const clusterP75 = Number(matchingCluster.p75_accuracy_slope || 0);
          
          // Calculate percentile (simplified)
          let percentile = 50;
          if (userRate.accuracySlope > clusterP75) {
            percentile = 75 + ((userRate.accuracySlope - clusterP75) / (clusterP75 - clusterMedian)) * 25;
            percentile = Math.min(100, percentile);
          } else if (userRate.accuracySlope < clusterP25) {
            percentile = 25 * (userRate.accuracySlope / clusterP25);
            percentile = Math.max(0, percentile);
          } else if (userRate.accuracySlope > clusterMedian) {
            percentile = 50 + ((userRate.accuracySlope - clusterMedian) / (clusterP75 - clusterMedian)) * 25;
          } else {
            percentile = 25 + ((userRate.accuracySlope - clusterP25) / (clusterMedian - clusterP25)) * 25;
          }

          comparisons.push({
            domain: userRate.domain,
            window: userRate.window,
            userSlope: userRate.accuracySlope,
            clusterMedian,
            clusterP25,
            clusterP75,
            percentile: Math.round(percentile),
            userCount: matchingCluster.user_count || 0
          });
        }
      }

      setClusterComparisons(comparisons);
    } catch (err) {
      console.error('Error fetching cluster comparisons:', err);
    }
  };

  const refresh = async () => {
    if (!userId) return;
    
    try {
      setIsCalculating(true);
      
      // Trigger calculation
      await calculateAllLearningRates(userId, profileId);
      
      // Re-fetch learning rates
      let lrQ2 = supabase
        .from('learning_rates')
        .select('*')
        .eq('user_id', userId)
        .order('calculated_at', { ascending: false });
      if (profileId) lrQ2 = lrQ2.eq('profile_id', profileId);
      const { data: rates, error: ratesError } = await lrQ2;

      if (ratesError) throw ratesError;

      if (rates) {
        const transformed = rates.map(rate => ({
          domain: rate.domain,
          window: rate.time_window_days,
          accuracySlope: Number(rate.accuracy_slope || 0),
          rtSlope: Number(rate.rt_slope || 0),
          trend: determineTrend(Number(rate.accuracy_slope || 0)),
          trialCount: rate.trial_count,
          confidence: Number(rate.confidence_score || 0),
          startAccuracy: Number(rate.start_accuracy || 0),
          endAccuracy: Number(rate.end_accuracy || 0)
        }));

        setLearningRates(transformed);
        await fetchClusterComparisons(userId, transformed);
      }
    } catch (err) {
      console.error('Error calculating learning rates:', err);
      setError(err instanceof Error ? err.message : 'Calculation failed');
    } finally {
      setIsCalculating(false);
    }
  };

  return {
    learningRates,
    clusterComparisons,
    isLoading,
    isCalculating,
    error,
    calculateRates: refresh,
    refresh
  };
};

function determineTrend(slope: number): 'improving' | 'plateau' | 'declining' {
  if (slope > 0.001) return 'improving'; // More than 0.1% per day
  if (slope < -0.005) return 'declining'; // Less than -0.5% per day
  return 'plateau';
}
