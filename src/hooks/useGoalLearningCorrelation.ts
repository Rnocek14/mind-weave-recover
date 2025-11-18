import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFunctionalGoals } from './useFunctionalGoals';
import { useLearningRate } from './useLearningRate';

interface GoalCorrelation {
  goalId: string;
  goalText: string;
  domain: string;
  progressChange: number; // Change in status (0-100)
  learningRateChange: number; // Average accuracy slope for related domain
  correlation: 'positive' | 'negative' | 'neutral';
  confidence: number;
  timeWindow: string;
}

export const useGoalLearningCorrelation = (userId: string | null) => {
  const { goals } = useFunctionalGoals(userId);
  const { learningRates } = useLearningRate(userId);
  const [correlations, setCorrelations] = useState<GoalCorrelation[]>([]);
  const [loading, setLoading] = useState(true);

  const mapDomainToExerciseDomain = (goalDomain: string): string => {
    switch (goalDomain) {
      case 'communication':
        return 'language';
      case 'motor':
        return 'motor';
      case 'cognitive':
        return 'executive';
      default:
        return 'language';
    }
  };

  const calculateProgressChange = (goal: any): number => {
    const statusToScore = {
      not_yet: 0,
      partial: 50,
      achieved: 100,
    };

    const baseline = statusToScore[goal.baseline_status as keyof typeof statusToScore] || 0;
    const current = statusToScore[goal.latest_rating?.status as keyof typeof statusToScore] || baseline;

    return current - baseline;
  };

  const analyzeCorrelations = async () => {
    if (!userId || goals.length === 0 || learningRates.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const correlationData: GoalCorrelation[] = [];

      for (const goal of goals) {
        if (goal.archived_at) continue;

        const exerciseDomain = mapDomainToExerciseDomain(goal.target_domain);
        const relevantRates = learningRates.filter((lr) => lr.domain === exerciseDomain);

        if (relevantRates.length === 0) continue;

        const progressChange = calculateProgressChange(goal);
        const avgAccuracySlope =
          relevantRates.reduce((sum, lr) => sum + (lr.accuracySlope || 0), 0) / relevantRates.length;

        // Determine correlation
        let correlation: 'positive' | 'negative' | 'neutral' = 'neutral';
        if (progressChange > 10 && avgAccuracySlope > 0.01) {
          correlation = 'positive';
        } else if (progressChange < -10 && avgAccuracySlope < -0.01) {
          correlation = 'negative';
        } else if (Math.abs(progressChange) < 10 || Math.abs(avgAccuracySlope) < 0.01) {
          correlation = 'neutral';
        }

        // Calculate confidence based on data quality
        const totalTrials = relevantRates.reduce((sum, lr) => sum + lr.trialCount, 0);
        const avgConfidence =
          relevantRates.reduce((sum, lr) => sum + (lr.confidence || 0), 0) / relevantRates.length;
        const confidence = Math.min(avgConfidence * (totalTrials / 100), 1);

        correlationData.push({
          goalId: goal.id,
          goalText: goal.goal_text,
          domain: goal.target_domain,
          progressChange,
          learningRateChange: avgAccuracySlope,
          correlation,
          confidence: Math.round(confidence * 100),
          timeWindow: relevantRates[0]?.window
            ? `${relevantRates[0].window} days`
            : 'Recent',
        });
      }

      setCorrelations(correlationData);
    } catch (error) {
      console.error('Error analyzing correlations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    analyzeCorrelations();
  }, [goals, learningRates, userId]);

  return {
    correlations,
    loading,
    refresh: analyzeCorrelations,
  };
};
