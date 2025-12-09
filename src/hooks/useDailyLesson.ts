import { useEffect, useState, useRef, useCallback } from 'react';
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
  regenerateLesson: (freshAssessment?: any) => Promise<DailyLesson | null>;
}

// Cache key for session storage
const LESSON_CACHE_KEY = 'dailyLessonCache';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface LessonCache {
  lesson: DailyLesson;
  performanceSignals: PerformanceSignals;
  assessmentId: string | null;
  profileId: string | undefined;
  timestamp: number;
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
  
  const hasBuiltRef = useRef(false);

  const { currentAssessment, previousAssessment } = useAssessmentContext();
  const { capabilityScores, accessibleExercises } = useExerciseGating();
  
  // Get the best available completed assessment
  const effectiveAssessment = currentAssessment?.completed ? currentAssessment : previousAssessment?.completed ? previousAssessment : null;

  // Extract lesson generation into reusable function
  const buildLessonFromState = async (freshAssessment?: any): Promise<DailyLesson | null> => {
    // Derive scores directly from fresh assessment if provided, otherwise use best available
    const assessmentToUse = freshAssessment || effectiveAssessment;
    
    const scores = assessmentToUse?.completed ? {
      vision: assessmentToUse.vision_score || 0,
      motor: assessmentToUse.motor_score || 0,
      attention: assessmentToUse.attention_score || 0,
      confidence: assessmentToUse.confidence_score || 0,
    } : capabilityScores;

    if (!userId || !scores) {
      console.log('[useDailyLesson] Cannot build lesson: missing userId or scores', { userId, scores });
      setLoading(false);
      return null;
    }
    
    // Check cache first (skip if force regenerate via freshAssessment)
    if (!freshAssessment) {
      try {
        const cached = sessionStorage.getItem(LESSON_CACHE_KEY);
        if (cached) {
          const cache: LessonCache = JSON.parse(cached);
          const isValid = 
            cache.profileId === profileId &&
            cache.assessmentId === assessmentToUse?.id &&
            Date.now() - cache.timestamp < CACHE_TTL_MS;
          
          if (isValid) {
            console.log('[useDailyLesson] Using cached lesson');
            setLesson(cache.lesson);
            setPerformanceSignals(cache.performanceSignals);
            setLoading(false);
            hasBuiltRef.current = true;
            return cache.lesson;
          }
        }
      } catch (e) {
        // Ignore cache errors
      }
    }

    try {
      setLoading(true);
      setError(null);

      console.log('[DailyLesson] Building lesson', {
        hasCapability: !!scores,
        accessibleCount: accessibleExercises.length,
        usingFreshAssessment: !!freshAssessment,
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
        const caregiverObs = assessmentToUse?.clinical_snapshot?.caregiver_observations as CaregiverObservations | undefined;
        const mode = suggestInteractionMode(caregiverObs);
        
        const defaultLesson = generateDailyLesson(
          scores,
          clinicalProfile,
          accessibleExercises,
          defaultSignals,
          [],
          mode
        );
        setLesson(defaultLesson);
        setLoading(false);
        return defaultLesson;
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
        assessmentToUse,
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

      // Get suggested mode from assessment
      const caregiverObs = assessmentToUse?.clinical_snapshot?.caregiver_observations as CaregiverObservations | undefined;
      const mode = suggestInteractionMode(caregiverObs);

      // Generate daily lesson
      const dailyLesson = generateDailyLesson(
        scores,
        clinicalProfile,
        accessibleExercises,
        signals,
        formattedLearningRates,
        mode
      );

      setLesson(dailyLesson);
      setPerformanceSignals(signals);
      hasBuiltRef.current = true;
      
      // Cache the lesson
      try {
        const cache: LessonCache = {
          lesson: dailyLesson,
          performanceSignals: signals,
          assessmentId: assessmentToUse?.id || null,
          profileId,
          timestamp: Date.now(),
        };
        sessionStorage.setItem(LESSON_CACHE_KEY, JSON.stringify(cache));
      } catch (e) {
        // Ignore cache errors
      }
      
      console.log('[useDailyLesson] Lesson built successfully:', !!dailyLesson);
      return dailyLesson;
    } catch (err) {
      console.error('[useDailyLesson] Error generating lesson:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate lesson');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate lesson only once on mount (use cache thereafter)
  useEffect(() => {
    // Skip if already built this mount
    if (hasBuiltRef.current && lesson) {
      setLoading(false);
      return;
    }
    
    // Only build if we have the required data (use effective assessment which handles fallback)
    if (userId && (capabilityScores || effectiveAssessment?.completed)) {
      buildLessonFromState();
    }
  }, [userId, profileId, effectiveAssessment?.id]);

  return {
    lesson,
    performanceSignals,
    loading,
    error,
    needsReassessment,
    reassessmentReason,
    regenerateLesson: buildLessonFromState,
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
