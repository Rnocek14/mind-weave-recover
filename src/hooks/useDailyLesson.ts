import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAssessmentContext } from '@/contexts/AssessmentContext';
import { useExerciseGating } from './useExerciseGating';
import { 
  generateDailyLesson, 
  aggregatePerformanceSignals,
  type DailyLesson,
  type PerformanceSignals,
  type LearningRateData
} from '@/lib/dailyLessonEngine';
import type { ClinicalProfile } from '@/lib/clinicalProfileMapper';
import { suggestInteractionMode, type CaregiverObservations } from '@/lib/capabilityScoreSmoothing';

interface UseDailyLessonResult {
  lesson: DailyLesson | null;
  performanceSignals: PerformanceSignals | null;
  loading: boolean;
  error: string | null;
  needsReassessment: boolean;
  reassessmentReason: string | null;
}

export const useDailyLesson = (
  userId: string | undefined,
  profileId: string | undefined,
  clinicalProfile: ClinicalProfile | null
): UseDailyLessonResult => {
  const [lesson, setLesson] = useState<DailyLesson | null>(null);
  const [performanceSignals, setPerformanceSignals] = useState<PerformanceSignals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsReassessment, setNeedsReassessment] = useState(false);
  const [reassessmentReason, setReassessmentReason] = useState<string | null>(null);

  const { currentAssessment } = useAssessmentContext();
  const { capabilityScores, accessibleExercises } = useExerciseGating();

  useEffect(() => {
    if (!userId || !capabilityScores) {
      setLoading(false);
      return;
    }

    const generateLesson = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('[DailyLesson]', {
          hasCapability: !!capabilityScores,
          accessibleCount: accessibleExercises.length,
        });

        // Fetch recent trials (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // First get user's sessions
        const { data: recentSessions, error: sessionsError } = await supabase
          .from('sessions')
          .select('id, started_at, ended_at, engagement_summary')
          .eq('user_id', userId)
          .gte('started_at', sevenDaysAgo.toISOString())
          .order('started_at', { ascending: false })
          .limit(20);

        if (sessionsError) throw sessionsError;

        if (!recentSessions || recentSessions.length === 0) {
          // No recent activity - use defaults
          const defaultSignals = aggregatePerformanceSignals([], []);
          setPerformanceSignals(defaultSignals);
          
          // Get suggested mode from current assessment
          const caregiverObs = currentAssessment?.clinical_snapshot?.caregiver_observations as CaregiverObservations | undefined;
          const mode = suggestInteractionMode(caregiverObs);
          
          const defaultLesson = generateDailyLesson(
            capabilityScores,
            clinicalProfile,
            accessibleExercises,
            defaultSignals,
            [],
            mode
          );
          setLesson(defaultLesson);
          setLoading(false);
          return;
        }

        const sessionIds = recentSessions.map(s => s.id);

        // Then get trials from those sessions
        let recentTrials: any[] = [];

        if (sessionIds.length > 0) {
          const { data, error: trialsError } = await supabase
            .from('exercise_events')
            .select('*')
            .in('session_id', sessionIds)
            .order('created_at', { ascending: false })
            .limit(200);

          if (trialsError) throw trialsError;
          recentTrials = data || [];
        }

        // Aggregate performance signals
        const signals = aggregatePerformanceSignals(recentTrials || [], recentSessions || []);
        setPerformanceSignals(signals);

        // Check if reassessment is needed
        const { needs, reason } = checkReassessmentNeeded(
          currentAssessment,
          signals,
          recentTrials || []
        );
        setNeedsReassessment(needs);
        setReassessmentReason(reason);

        // Fetch learning rates
        const { data: learningRates } = await supabase
          .from('learning_rates')
          .select('*')
          .eq('user_id', userId)
          .gte('calculated_at', sevenDaysAgo.toISOString())
          .order('calculated_at', { ascending: false });

        const formattedLearningRates: LearningRateData[] = (learningRates || []).map(lr => ({
          domain: lr.domain,
          accuracySlope: lr.accuracy_slope || 0,
          rtSlope: lr.rt_slope || 0,
          confidenceScore: lr.confidence_score || 0.5,
          trialCount: lr.trial_count || 0,
        }));

        // Get suggested mode from current assessment
        const caregiverObs = currentAssessment?.clinical_snapshot?.caregiver_observations as CaregiverObservations | undefined;
        const mode = suggestInteractionMode(caregiverObs);

        // Generate daily lesson
        const dailyLesson = generateDailyLesson(
          capabilityScores,
          clinicalProfile,
          accessibleExercises,
          signals,
          formattedLearningRates,
          mode
        );

        setLesson(dailyLesson);
      } catch (err) {
        console.error('[useDailyLesson] Error generating lesson:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate lesson');
      } finally {
        setLoading(false);
      }
    };

    generateLesson();
  }, [userId, capabilityScores, accessibleExercises, clinicalProfile, currentAssessment]);

  return {
    lesson,
    performanceSignals,
    loading,
    error,
    needsReassessment,
    reassessmentReason,
  };
};

/**
 * Check if capability reassessment is needed
 */
function checkReassessmentNeeded(
  currentAssessment: any,
  signals: PerformanceSignals,
  recentTrials: any[]
): { needs: boolean; reason: string | null } {
  if (!currentAssessment) {
    return { needs: false, reason: null };
  }

  // Check days since last assessment
  const assessedAt = new Date(currentAssessment.assessed_at);
  const daysSince = (Date.now() - assessedAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSince > 14) {
    return { 
      needs: true, 
      reason: 'It has been over 2 weeks since your last capability check. A quick re-check can help keep exercises matched to your current abilities.' 
    };
  }

  // Check for performance degradation
  if (signals.avgAccuracy < 0.4 && recentTrials.length >= 30) {
    return {
      needs: true,
      reason: 'We noticed your accuracy has been lower than usual. A capability check can help us adjust exercises to better support you.',
    };
  }

  if (signals.timeoutRate > 0.3 && recentTrials.length >= 30) {
    return {
      needs: true,
      reason: 'There have been more timeouts recently. A quick check can help us adjust timing and difficulty to reduce frustration.',
    };
  }

  if (signals.fatigueLevel === 'high' && signals.frustrationLevel === 'high') {
    return {
      needs: true,
      reason: 'Recent sessions show signs of increased fatigue and frustration. A capability check can help us find the right balance.',
    };
  }

  return { needs: false, reason: null };
}
