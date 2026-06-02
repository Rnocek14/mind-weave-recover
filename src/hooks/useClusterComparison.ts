import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useActiveProfileId } from '@/hooks/useActiveProfileId';

interface ClusterProfile {
  lesionZone: string | null;
  strokeMechanism: string | null;
  chronicity: string | null;
  hemisphere: string | null;
}

interface LearningRateComparison {
  domain: string;
  userSlope: number;
  clusterMedian: number;
  clusterP25: number;
  clusterP75: number;
  percentile: number;
  userCount: number;
}

interface ErrorPatternComparison {
  errorType: string;
  userRate: number;
  clusterAvg: number;
  percentile: number;
}

interface AssessmentComparison {
  assessmentType: string;
  userLatestScore: number;
  clusterAvg: number;
  percentile: number;
  scoreDate: string;
}

interface GoalAchievementComparison {
  domain: string;
  userAchievementRate: number;
  clusterAvg: number;
  percentile: number;
}

export interface ClusterComparisonData {
  clusterProfile: ClusterProfile;
  clusterSize: number;
  learningRates: LearningRateComparison[];
  errorPatterns: ErrorPatternComparison[];
  assessments: AssessmentComparison[];
  goalAchievement: GoalAchievementComparison[];
  overallPercentile: number;
}

export const useClusterComparison = (userId: string | undefined, clinicalProfile: any) => {
  const [data, setData] = useState<ClusterComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchClusterComparison = async () => {
      if (!userId || !clinicalProfile) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Extract cluster dimensions from clinical profile
        const strokeLocation = Array.isArray(clinicalProfile.stroke_location)
          ? clinicalProfile.stroke_location[0]
          : clinicalProfile.stroke_location;

        const clusterProfile: ClusterProfile = {
          lesionZone: strokeLocation || null,
          strokeMechanism: clinicalProfile.stroke_mechanism || null,
          chronicity: clinicalProfile.chronicity || null,
          hemisphere: clinicalProfile.affected_side === 'left' ? 'right' : 
                      clinicalProfile.affected_side === 'right' ? 'left' : null,
        };

        // Fetch cluster learning rates
        const { data: clusterLR } = await supabase
          .from('cluster_learning_rates')
          .select('*')
          .eq('lesion_zone', clusterProfile.lesionZone)
          .eq('stroke_mechanism', clusterProfile.strokeMechanism);

        // Fetch user's learning rates
        const { data: userLR } = await supabase
          .from('learning_rates')
          .select('*')
          .eq('user_id', userId)
          .eq('time_window_days', 14)
          .order('calculated_at', { ascending: false });

        // Compare learning rates
        const learningRates: LearningRateComparison[] = (userLR || []).map((ulr) => {
          const cluster = clusterLR?.find(
            (c) => c.domain === ulr.domain && c.time_window_days === 14
          );

          const percentile = cluster
            ? calculatePercentile(
                Number(ulr.accuracy_slope),
                Number(cluster.p25_accuracy_slope || 0),
                Number(cluster.median_accuracy_slope || 0),
                Number(cluster.p75_accuracy_slope || 0)
              )
            : 50;

          return {
            domain: ulr.domain,
            userSlope: Number(ulr.accuracy_slope || 0),
            clusterMedian: Number(cluster?.median_accuracy_slope || 0),
            clusterP25: Number(cluster?.p25_accuracy_slope || 0),
            clusterP75: Number(cluster?.p75_accuracy_slope || 0),
            percentile,
            userCount: Number(cluster?.user_count || 0),
          };
        });

        // Fetch and compare error patterns
        const { data: userSessions } = await supabase
          .from('sessions')
          .select('id')
          .eq('user_id', userId);

        const sessionIds = (userSessions || []).map((s) => s.id);

        const { data: userErrors } = await supabase
          .from('exercise_events')
          .select('error_type')
          .in('session_id', sessionIds);

        const errorCounts: Record<string, number> = {};
        let totalErrors = 0;
        
        (userErrors || []).forEach((e) => {
          if (e.error_type) {
            errorCounts[e.error_type] = (errorCounts[e.error_type] || 0) + 1;
            totalErrors++;
          }
        });

        const errorPatterns: ErrorPatternComparison[] = Object.entries(errorCounts).map(
          ([errorType, count]) => ({
            errorType,
            userRate: totalErrors > 0 ? count / totalErrors : 0,
            clusterAvg: 0.33, // Placeholder - would calculate from cluster data
            percentile: 50, // Placeholder - would calculate from cluster distribution
          })
        );

        // Fetch and compare assessments
        const { data: userAssessments } = await supabase
          .from('standardized_assessments')
          .select('*')
          .eq('user_id', userId)
          .order('assessment_date', { ascending: false });

        const assessmentsByType: Record<string, any> = {};
        (userAssessments || []).forEach((a) => {
          if (!assessmentsByType[a.assessment_type]) {
            assessmentsByType[a.assessment_type] = a;
          }
        });

        const assessments: AssessmentComparison[] = Object.values(assessmentsByType).map(
          (a: any) => {
            const primaryScore = getPrimaryScore(a.assessment_type, a.scores);
            return {
              assessmentType: a.assessment_type,
              userLatestScore: primaryScore,
              clusterAvg: getClusterAvgScore(a.assessment_type),
              percentile: 50, // Would calculate from cluster distribution
              scoreDate: a.assessment_date,
            };
          }
        );

        // Fetch and compare goal achievement
        const { data: userGoals } = await supabase
          .from('functional_goals')
          .select('*, goal_progress_ratings(*)')
          .eq('user_id', userId);

        const goalsByDomain: Record<string, { total: number; achieved: number }> = {};
        
        (userGoals || []).forEach((goal: any) => {
          const domain = goal.target_domain;
          if (!goalsByDomain[domain]) {
            goalsByDomain[domain] = { total: 0, achieved: 0 };
          }
          goalsByDomain[domain].total++;

          // Check if goal achieved based on latest rating
          const latestRating = goal.goal_progress_ratings?.[0];
          if (latestRating?.status === 'achieved') {
            goalsByDomain[domain].achieved++;
          }
        });

        const goalAchievement: GoalAchievementComparison[] = Object.entries(goalsByDomain).map(
          ([domain, stats]) => ({
            domain,
            userAchievementRate: stats.total > 0 ? stats.achieved / stats.total : 0,
            clusterAvg: 0.4, // Placeholder
            percentile: 50, // Placeholder
          })
        );

        // Calculate overall percentile
        const allPercentiles = [
          ...learningRates.map((lr) => lr.percentile),
          ...assessments.map((a) => a.percentile),
        ];
        const overallPercentile =
          allPercentiles.length > 0
            ? allPercentiles.reduce((sum, p) => sum + p, 0) / allPercentiles.length
            : 50;

        setData({
          clusterProfile,
          clusterSize: Number(clusterLR?.[0]?.user_count || 0),
          learningRates,
          errorPatterns,
          assessments,
          goalAchievement,
          overallPercentile,
        });
      } catch (error) {
        console.error('Error fetching cluster comparison:', error);
        toast({
          title: 'Error',
          description: 'Failed to load cluster comparison data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    void fetchClusterComparison();
  }, [userId, clinicalProfile]);

  return { data, loading };
};

// Helper functions
function calculatePercentile(value: number, p25: number, median: number, p75: number): number {
  if (value <= p25) return 25;
  if (value <= median) return 25 + ((value - p25) / (median - p25)) * 25;
  if (value <= p75) return 50 + ((value - median) / (p75 - median)) * 25;
  return 75 + Math.min(((value - p75) / (p75 - median)) * 25, 25);
}

function getPrimaryScore(assessmentType: string, scores: any): number {
  const scoreMap: Record<string, string> = {
    'WAB-R': 'aphasia_quotient',
    'BNT': 'total_correct',
    'NIHSS': 'total_score',
    'ASHA-NOMS': 'spoken_expression',
  };
  const key = scoreMap[assessmentType];
  return scores?.[key] || 0;
}

function getClusterAvgScore(assessmentType: string): number {
  // Placeholder cluster averages - would fetch from database
  const avgScores: Record<string, number> = {
    'WAB-R': 65,
    'BNT': 35,
    'NIHSS': 8,
    'ASHA-NOMS': 4,
  };
  return avgScores[assessmentType] || 0;
}
