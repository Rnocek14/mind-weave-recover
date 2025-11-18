import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface GoalPrediction {
  goalText: string;
  achievementProbability: number;
  expectedWeeks: number;
  confidence: 'low' | 'medium' | 'high';
  keyFactors: string[];
  recommendations: string[];
}

interface RecoveryTrajectory {
  overallPrognosis: string;
  expectedImprovementRate: string;
  milestones: Array<{
    week: number;
    expectedStatus: string;
  }>;
  riskFactors: string[];
  strengths: string[];
}

interface OutcomePrediction {
  goalPredictions: GoalPrediction[];
  recoveryTrajectory: RecoveryTrajectory;
  generatedAt: string;
}

export const useOutcomePrediction = () => {
  const [prediction, setPrediction] = useState<OutcomePrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generatePrediction = async (
    userId: string,
    clinicalProfile: any,
    currentGoals: any[]
  ) => {
    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('predict-outcomes', {
        body: {
          userId,
          clinicalProfile,
          currentGoals,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Prediction failed');
      }

      // Map snake_case to camelCase
      const mappedPrediction: OutcomePrediction = {
        goalPredictions: data.prediction.goal_predictions.map((gp: any) => ({
          goalText: gp.goal_text,
          achievementProbability: gp.achievement_probability,
          expectedWeeks: gp.expected_weeks,
          confidence: gp.confidence,
          keyFactors: gp.key_factors,
          recommendations: gp.recommendations,
        })),
        recoveryTrajectory: {
          overallPrognosis: data.prediction.recovery_trajectory.overall_prognosis,
          expectedImprovementRate: data.prediction.recovery_trajectory.expected_improvement_rate,
          milestones: data.prediction.recovery_trajectory.milestones.map((m: any) => ({
            week: m.week,
            expectedStatus: m.expected_status,
          })),
          riskFactors: data.prediction.recovery_trajectory.risk_factors,
          strengths: data.prediction.recovery_trajectory.strengths,
        },
        generatedAt: data.generated_at,
      };

      setPrediction(mappedPrediction);

      toast({
        title: 'Prediction Generated',
        description: 'AI outcome prediction completed successfully',
      });

      return mappedPrediction;
    } catch (error) {
      console.error('Error generating prediction:', error);
      
      let errorMessage = 'Failed to generate prediction';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast({
        title: 'Prediction Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    prediction,
    loading,
    generatePrediction,
  };
};
