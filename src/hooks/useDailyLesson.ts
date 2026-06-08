import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAssessmentContext } from '@/contexts/AssessmentContext';
import { useExerciseGating } from './useExerciseGating';
import { useAdaptiveDecisionLog } from './useAdaptiveDecisionLog';
import { useDailyReadiness } from './useDailyReadiness';
import { 
  generateDailyLesson, 
  aggregatePerformanceSignals,
  detectAphasiaType,
  type DailyLesson,
  type PerformanceSignals,
  type LearningRateData,
  type ReadinessInput,
  type LessonPreset,
} from '@/lib/dailyLessonEngine';
import type { ClinicalProfile } from '@/lib/clinicalProfileMapper';
import { suggestInteractionMode, type CaregiverObservations } from '@/lib/capabilityScoreSmoothing';
import { 
  computeTodayFocus, 
  type TodayFocus, 
  type AdaptiveEngineInput,
  type SignalCounts,
  type SpeechProfileSummary,
  type DomainExposure7d,
} from '@/lib/adaptiveDecisionEngine';
import { COGNITIVE_DOMAINS } from '@/lib/cognitiveStateEngine';
import { fetchRecentExerciseUsage, calculateRecencyPenalties, type RecencyPenalties } from '@/lib/exerciseRecency';
import { fetchExerciseStruggleData, calculateStrugglePenalties } from '@/lib/exerciseStruggleTracker';
import { fetchProgressionPlanningSignals, type ProgressionPlanningSignal } from '@/lib/progressionPlanningSignals';
import type { CapabilityScores } from '@/lib/capabilityAssessor';

interface UseDailyLessonResult {
  lesson: DailyLesson | null;
  performanceSignals: PerformanceSignals | null;
  todayFocus: TodayFocus | null;
  loading: boolean;
  error: string | null;
  needsReassessment: boolean;
  reassessmentReason: string | null;
  regenerateLesson: (freshAssessment?: any) => Promise<DailyLesson | null>;
}

// Cache key for session storage
const LESSON_CACHE_KEY = 'dailyLessonCache';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const FALLBACK_CAPABILITY_SCORES: CapabilityScores = {
  vision: 6,
  motor: 6,
  attention: 6,
  confidence: 0.35,
};

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
  clinicalProfile: ClinicalProfile | null,
  preset?: LessonPreset | null,
): UseDailyLessonResult => {
  const [lesson, setLesson] = useState<DailyLesson | null>(null);
  const [performanceSignals, setPerformanceSignals] = useState<PerformanceSignals | null>(null);
  const [todayFocus, setTodayFocus] = useState<TodayFocus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsReassessment, setNeedsReassessment] = useState(false);
  const [reassessmentReason, setReassessmentReason] = useState<string | null>(null);
  
  const hasBuiltRef = useRef(false);
  const { logDecision } = useAdaptiveDecisionLog();
  
  // Fetch today's readiness check-in for dose modulation
  const { todayCheckin, isLoading: readinessLoading } = useDailyReadiness(profileId);

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
    } : capabilityScores ?? FALLBACK_CAPABILITY_SCORES;

    if (!userId) {
      console.log('[useDailyLesson] Cannot build lesson: missing userId', { userId });
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

      // Fetch recent trials (last 7 days for lesson, 14 days for adaptive engine)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      // First get user's sessions
      const { data: recentSessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('id, started_at, ended_at, engagement_summary')
        .eq('user_id', userId)
        .eq('profile_id', profileId)
        .gte('started_at', sevenDaysAgo.toISOString())
        .order('started_at', { ascending: false })
        .limit(20);

      if (sessionsError) throw sessionsError;

      // Convert readiness check-in to ReadinessInput
      const readinessInput: ReadinessInput | null = todayCheckin ? {
        fatigue_rating: todayCheckin.fatigue_rating,
        sleep_quality: todayCheckin.sleep_quality,
        mood_rating: todayCheckin.mood_rating,
        pain_level: todayCheckin.pain_level,
        fatigue_limited_practice: todayCheckin.fatigue_limited_practice,
      } : null;

      if (!recentSessions || recentSessions.length === 0) {
        // No recent activity - use defaults but still fetch recency for returning users
        const defaultSignals = aggregatePerformanceSignals([], []);
        setPerformanceSignals(defaultSignals);
        
        const caregiverObs = assessmentToUse?.clinical_snapshot?.caregiver_observations as CaregiverObservations | undefined;
        const mode = suggestInteractionMode(caregiverObs);
        
        // Fetch recency even for "no recent sessions" — user may have older data
        let recency: RecencyPenalties | null = null;
        try {
          const usage = await fetchRecentExerciseUsage(userId, profileId, 7);
          if (usage.length > 0) {
            recency = calculateRecencyPenalties(usage);
          }
        } catch (e) {
          console.warn('[useDailyLesson] Recency fetch failed (non-blocking):', e);
        }

        // Fetch longitudinal progression so the planner reflects per-game levels
        // even when there are no trials in the last 7 days (returning users).
        let progressionSignals: Map<string, ProgressionPlanningSignal> | null = null;
        try {
          const prog = await fetchProgressionPlanningSignals(userId, profileId);
          if (prog.byExercise.size > 0) {
            progressionSignals = prog.byExercise;
            console.log('[useDailyLesson] Progression planning (no-recent path):',
              Array.from(prog.byExercise.values()).map(s => `${s.exerciseSlug}: ${s.status} (${s.planningBoost >= 0 ? '+' : ''}${s.planningBoost})`));
          }
        } catch (e) {
          console.warn('[useDailyLesson] Progression fetch failed (non-blocking):', e);
        }
        
        const defaultLesson = generateDailyLesson(
          scores,
          clinicalProfile,
          accessibleExercises,
          defaultSignals,
          [],
          mode,
          readinessInput,
          null,
          preset,
          recency,
          null,
          null,
          null,
          null,
          progressionSignals,
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
        .eq('profile_id', profileId)
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

      // Compute TodayFocus FIRST so its adaptations feed into lesson generation
      let focus: TodayFocus | null = null;
      let speechProfileForSelection: { errorTypeDistribution?: Record<string, number>; mostChallengingCategories?: string[]; phonemeDifficultyMap?: Record<string, { accuracy: number; trials: number }> } | null = null;
      try {
        // Get utterance count with alignment data
        const { count: utteranceCount } = await supabase
          .from('utterance_analyses')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('profile_id', profileId)
          .not('alignment_data', 'is', null)
          .gte('created_at', fourteenDaysAgo.toISOString());

        // Get speech profile for error distribution + freshness check
        const { data: speechProfile } = await supabase
          .from('user_speech_profiles')
          .select('error_type_distribution, cue_efficacy_by_type, most_challenging_categories, last_computed_at, phoneme_difficulty_map')
          .eq('user_id', userId)
          .eq('profile_id', profileId)
          .maybeSingle();

        // Log profile freshness for observability
        if (speechProfile?.last_computed_at) {
          const hoursAgo = Math.round((Date.now() - new Date(speechProfile.last_computed_at).getTime()) / (1000 * 60 * 60));
          console.log(`[useDailyLesson] Speech profile age: ${hoursAgo}h`, 
            hoursAgo > 72 ? '⚠️ STALE' : hoursAgo > 24 ? '⏳ aging' : '✅ fresh');
        } else {
          console.warn('[useDailyLesson] No speech profile found — using defaults');
        }

        const assessmentAgeDays = assessmentToUse?.assessed_at 
          ? Math.floor((Date.now() - new Date(assessmentToUse.assessed_at).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        const signalCounts: SignalCounts = {
          trialsLast14Days: recentTrials.length,
          utterancesWithAlignmentLast14Days: utteranceCount || 0,
          assessmentAgeDays,
        };

        const speechProfileSummary: SpeechProfileSummary | null = speechProfile ? {
          errorTypeDistribution: speechProfile.error_type_distribution as Record<string, number> | undefined,
          cueEfficacyByType: speechProfile.cue_efficacy_by_type as Record<string, { successRate: number; trials: number }> | undefined,
          mostChallengingCategories: speechProfile.most_challenging_categories as string[] | undefined,
          phonemeDifficultyMap: speechProfile.phoneme_difficulty_map as Record<string, { accuracy: number; trials: number }> | undefined,
        } : null;

        // Extract selection-relevant signals for exercise scoring
        speechProfileForSelection = speechProfile ? {
          errorTypeDistribution: speechProfile.error_type_distribution as Record<string, number> | undefined,
          mostChallengingCategories: speechProfile.most_challenging_categories as string[] | undefined,
          phonemeDifficultyMap: speechProfile.phoneme_difficulty_map as Record<string, { accuracy: number; trials: number }> | undefined,
        } : null;

        // Compute 7-day domain exposure from recent trials
        const sevenDaysAgoStr = sevenDaysAgo.toISOString();
        const domainExposure7d: DomainExposure7d[] = COGNITIVE_DOMAINS
          .filter(d => d.exerciseSlugs.length > 0)
          .map(domain => {
            const domainTrials = (recentTrials || []).filter(
              (t: any) => (domain.exerciseSlugs as readonly string[]).includes(t.exercise_slug) &&
                t.created_at >= sevenDaysAgoStr
            );
            const uniqueSessions = new Set(domainTrials.map((t: any) => t.session_id));
            return {
              domainSlug: domain.slug,
              sessionCount: uniqueSessions.size,
              trialCount: domainTrials.length,
            };
          });

        // Inject clinical aphasia type into engine input so adaptive rules can fire
        // even with low/no performance data (clinical profile is ground truth)
        const aphasiaType = detectAphasiaType(clinicalProfile);
        
        const engineInput: AdaptiveEngineInput = {
          capabilityScores: scores,
          performanceSignals: signals,
          speechProfile: speechProfileSummary,
          signalCounts,
          domainExposure7d,
        };
        
        // Pass aphasia type as a sideband signal for the clinical_profile_naming_deficit rule
        if (aphasiaType) {
          (engineInput as any)._clinicalAphasiaType = aphasiaType;
        }

        focus = computeTodayFocus(engineInput);
        console.log('[useDailyLesson] TodayFocus computed (ACTIVE):', {
          confidence: focus.confidence,
          rulesApplied: focus.rulesApplied.map(r => r.ruleId),
          adaptations: focus.adaptations,
        });
        
        // Log decision idempotently (once per user per day)
        if (userId) {
          logDecision({
            userId,
            profileId,
            todayFocus: focus,
            performanceSignals: signals,
          }).catch(() => {});
        }
      } catch (focusErr) {
        console.warn('[useDailyLesson] Failed to compute TodayFocus:', focusErr);
      }

      // Fetch exercise recency for variety optimization
      let recency: RecencyPenalties | null = null;
      let struggleBoosts: Map<string, number> | null = null;
      let struggleReEntryConfigs: Map<string, { difficulty: number; cueLevel: number }> | null = null;
      try {
        const usage = await fetchRecentExerciseUsage(userId, profileId, 7);
        if (usage.length > 0) {
          recency = calculateRecencyPenalties(usage);
          console.log('[useDailyLesson] Recency penalties computed:', {
            penalizedExercises: Array.from(recency.exercisePenalties.entries()),
            penalizedComponents: Array.from(recency.componentPenalties.entries()),
          });
        }
        
        // Fetch exercise struggle data for carryover
        const struggleData = await fetchExerciseStruggleData(userId, profileId, 14);
        const struggling = struggleData.filter(s => s.isStruggling);
        if (struggling.length > 0) {
          const recentSessionCounts = new Map<string, number>();
          for (const u of usage) {
            recentSessionCounts.set(u.exerciseSlug, u.sessionCount);
          }
          const penalties = calculateStrugglePenalties(struggling, recentSessionCounts);
          struggleBoosts = penalties.exerciseBoosts;
          struggleReEntryConfigs = penalties.reEntryConfigs;
          console.log('[useDailyLesson] Struggle carryover:', {
            struggling: struggling.map(s => `${s.exerciseSlug} (${s.struggleSignals.join(', ')})`),
            boosts: Array.from(penalties.exerciseBoosts.entries()),
            reasons: Array.from(penalties.reasons.entries()),
          });
        }
      } catch (e) {
        console.warn('[useDailyLesson] Recency/struggle fetch failed (non-blocking):', e);
      }

      // Generate daily lesson WITH readiness + TodayFocus adaptations + recency + struggle
      const dailyLesson = generateDailyLesson(
        scores,
        clinicalProfile,
        accessibleExercises,
        signals,
        formattedLearningRates,
        mode,
        readinessInput,
        focus ? {
          startDifficulty: focus.adaptations.startDifficulty,
          sessionDurationCap: focus.adaptations.sessionDurationCap,
          suggestedSessionMinutes: focus.suggestedSessionMinutes,
        } : null,
        preset,
        recency,
        focus?.primaryDomains || null,
        speechProfileForSelection,
        struggleBoosts,
        struggleReEntryConfigs,
      );

      setLesson(dailyLesson);
      setPerformanceSignals(signals);
      setTodayFocus(focus);
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
  // Wait for readiness to load so dose modulation is accurate
  useEffect(() => {
    // Skip if already built this mount
    if (hasBuiltRef.current && lesson) {
      setLoading(false);
      return;
    }
    
    // Don't build yet if readiness is still loading
    if (readinessLoading) return;
    
    // Build even when a newly scoped profile has no capability assessment yet.
    // A conservative fallback prevents the patient from being stuck on Today.
    if (userId && profileId) {
      buildLessonFromState();
    }
  }, [userId, profileId, effectiveAssessment?.id, capabilityScores, readinessLoading]);

  return {
    lesson,
    performanceSignals,
    todayFocus,
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
