/**
 * Unified Analytics Hook
 * 
 * Aggregates all analytics data sources into a single model for the
 * UnifiedAnalyticsPanel. Consolidates data from:
 * - Learning rates
 * - Error patterns  
 * - Cue telemetry
 * - Speech profile
 * - Capability assessments
 * - Adaptation events
 * - TodayFocus (shadow mode)
 */

import { useMemo } from 'react';
import { useLearningRate } from './useLearningRate';
import { useWeeklyTrends } from './useWeeklyTrends';
import { useErrorPatternAnalytics } from './useErrorPatternAnalytics';
import { useCueTelemetry } from './useCueTelemetry';
import { useUserSpeechProfile } from './useUserSpeechProfile';
import { useCapabilitySpeechCorrelation } from './useCapabilitySpeechCorrelation';
import { useRedFlagDetection } from './useRedFlagDetection';
import { useAdaptationTimeline } from './useAdaptationTimeline';
import type { TodayFocus } from '@/lib/adaptiveDecisionEngine';

// Import cue telemetry stats type
interface CueEffectivenessEntry {
  cueType: string;
  total: number;
  effective: number;
  ineffective: number;
  ambiguous: number;
}

// ============ Unified Analytics Model ============

export interface WordMetrics {
  word: string;
  successRate: number;
  trials: number;
  lastAttempt: string;
  errorTypes: Record<string, number>;
}

export interface PhonemeMetrics {
  phoneme: string;
  accuracy: number;
  trials: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface CueMetrics {
  cueType: 'semantic' | 'phonemic' | 'full_word' | 'none';
  deliveryCount: number;
  effectiveCount: number;
  successRate: number;
  avgTimeToSuccessMs: number | null;
}

export interface ExerciseMetrics {
  exerciseSlug: string;
  totalTrials: number;
  accuracy: number;
  avgReactionTimeMs: number;
  lastPlayed: string;
}

export interface TrendMetrics {
  domain: string;
  accuracySlope: number;
  trend: 'improving' | 'plateau' | 'declining';
  confidence: number;
  trialCount: number;
}

export interface UnifiedAnalyticsModel {
  // Loading state
  isLoading: boolean;
  
  // Time window
  window: {
    startDate: string;
    endDate: string;
    days: number;
  };
  
  // Summary stats
  summary: {
    totalTrials: number;
    totalSessions: number;
    overallAccuracy: number;
    trend: 'improving' | 'steady' | 'declining' | 'insufficient_data';
  };
  
  // Aggregated metrics
  trends: TrendMetrics[];
  cues: CueMetrics[];
  phonemes: PhonemeMetrics[];
  
  // Challenges and recommendations
  challenges: Array<{
    type: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
  }>;
  recommendations: string[];
  
  // Red flags
  alerts: Array<{
    type: string;
    severity: 'red' | 'amber';
    message: string;
  }>;
  
  // Data quality
  dataCompleteness: {
    hasLearningRates: boolean;
    hasCueTelemetry: boolean;
    hasSpeechProfile: boolean;
    hasCapabilityAssessment: boolean;
  };
}

export interface ActiveAdaptation {
  adaptationType: string;
  layer: 'session' | 'in_game';
  currentValue: unknown;
  triggerReason: string;
  evidenceSummary: string;
  ruleId?: string;
}

export interface UseUnifiedAnalyticsResult {
  analytics: UnifiedAnalyticsModel;
  
  // TodayFocus (session-level adaptations)
  todayFocus: TodayFocus | null;
  
  // Active adaptations (derived from TodayFocus)
  activeAdaptations: ActiveAdaptation[];
  
  // Adaptation timeline
  adaptationTimeline: Array<{
    id: string;
    timestamp: string;
    type: string;
    layer: string;
    description: string;
    evidence: Record<string, unknown>;
  }>;
  
  // Refresh
  refresh: () => void;
}

export const useUnifiedAnalytics = (
  userId: string | undefined,
  profileId: string | undefined,
  todayFocus: TodayFocus | null,
  daysBack = 7
): UseUnifiedAnalyticsResult => {
  // Gate all hooks - don't call with empty strings
  const enabled = !!userId;
  
  // Fetch all data sources (properly gated)
  const { learningRates, isLoading: learningLoading } = useLearningRate(userId, { enabled });
  const { trends: weeklyTrends, loading: trendsLoading } = useWeeklyTrends();
  const { analytics: errorAnalytics, isLoading: errorLoading } = useErrorPatternAnalytics(userId, { weeksBack: 4, enabled });
  const { stats: cueStats, loading: cueLoading } = useCueTelemetry(userId, { daysBack, enabled });
  const { profile: speechProfile, loading: speechLoading } = useUserSpeechProfile(userId, { profileId, enabled });
  const { analytics: crossDomain, isLoading: crossLoading } = useCapabilitySpeechCorrelation(userId, { profileId, enabled });
  const { flags: redFlags, isLoading: flagsLoading } = useRedFlagDetection(userId, { enabled });
  const { events: adaptationEvents, isLoading: timelineLoading, refresh: refreshTimeline } = useAdaptationTimeline(userId, daysBack);

  // Only loading if enabled and any source is loading
  const isLoading = enabled && (learningLoading || trendsLoading || errorLoading || cueLoading || 
                    speechLoading || crossLoading || flagsLoading || timelineLoading);

  // Compute unified model
  const analytics = useMemo<UnifiedAnalyticsModel>(() => {
    const now = new Date();
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    
    // Filter trends to window
    const windowTrends = weeklyTrends.filter(t => new Date(t.date) >= startDate);
    const totalTrials = windowTrends.reduce((sum, t) => sum + t.totalTrials, 0);
    const totalSessions = windowTrends.filter(t => t.totalTrials > 0).length;
    const overallAccuracy = totalTrials > 0 
      ? Math.round(windowTrends.reduce((sum, t) => sum + t.accuracy * t.totalTrials, 0) / totalTrials)
      : 0;

    // Determine overall trend
    let trend: 'improving' | 'steady' | 'declining' | 'insufficient_data' = 'insufficient_data';
    if (learningRates.length > 0) {
      const avgSlope = learningRates.reduce((sum, r) => sum + (r.accuracySlope || 0), 0) / learningRates.length;
      trend = avgSlope > 0.01 ? 'improving' : avgSlope < -0.01 ? 'declining' : 'steady';
    }

    // Map learning rates to trend metrics
    const trends: TrendMetrics[] = learningRates.map(lr => ({
      domain: lr.domain,
      accuracySlope: lr.accuracySlope || 0,
      trend: (lr.accuracySlope || 0) > 0.01 ? 'improving' : (lr.accuracySlope || 0) < -0.01 ? 'declining' : 'plateau',
      confidence: lr.confidence || 0,
      trialCount: lr.trialCount || 0,
    }));

    // Map cue stats - use errorAnalytics.cueEfficacy instead of cue telemetry
    const cues: CueMetrics[] = (errorAnalytics?.cueEfficacy || []).map(cue => ({
      cueType: cue.cueType as CueMetrics['cueType'],
      deliveryCount: cue.totalGiven,
      effectiveCount: cue.effectiveCount,
      successRate: cue.efficacyRate,
      avgTimeToSuccessMs: cue.avgTimeToSuccessMs,
    }));

    // Map phoneme data from speech profile
    const phonemes: PhonemeMetrics[] = speechProfile?.phoneme_difficulty_map 
      ? Object.entries(speechProfile.phoneme_difficulty_map).map(([phoneme, stats]) => ({
          phoneme,
          accuracy: stats.accuracy,
          trials: stats.trials,
          trend: 'stable' as const,
        }))
      : [];

    // Build challenges using errorRate (not successRate)
    const challenges: UnifiedAnalyticsModel['challenges'] = [];
    
    if (errorAnalytics?.challengingTargets) {
      errorAnalytics.challengingTargets.slice(0, 3).forEach(target => {
        challenges.push({
          type: 'word',
          description: `"${target.target}" - ${Math.round(target.errorRate * 100)}% error rate`,
          severity: target.errorRate > 0.7 ? 'high' : target.errorRate > 0.5 ? 'medium' : 'low',
        });
      });
    }

    // Build recommendations from cross-domain analytics
    const recommendations = crossDomain?.recommendations || [];

    // Build alerts from red flags
    const alerts = redFlags.map(flag => ({
      type: flag.type,
      severity: flag.severity as 'red' | 'amber',
      message: flag.message,
    }));

    return {
      isLoading,
      window: {
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        days: daysBack,
      },
      summary: {
        totalTrials,
        totalSessions,
        overallAccuracy,
        trend,
      },
      trends,
      cues,
      phonemes,
      challenges,
      recommendations,
      alerts,
      dataCompleteness: {
        hasLearningRates: learningRates.length > 0,
        hasCueTelemetry: (errorAnalytics?.cueEfficacy?.length || 0) > 0,
        hasSpeechProfile: !!speechProfile,
        hasCapabilityAssessment: !!crossDomain,
      },
    };
  }, [
    isLoading, daysBack, weeklyTrends, learningRates, cueStats, 
    speechProfile, errorAnalytics, crossDomain, redFlags
  ]);

  // Derive active adaptations from TodayFocus
  const activeAdaptations = useMemo<ActiveAdaptation[]>(() => {
    if (!todayFocus) return [];

    const adaptations: ActiveAdaptation[] = [];
    const { adaptations: proposed, rulesApplied } = todayFocus;

    if (proposed.startDifficulty !== undefined) {
      const rule = rulesApplied.find(r => r.adaptation.includes('difficulty'));
      adaptations.push({
        adaptationType: 'start_difficulty_set',
        layer: 'session',
        currentValue: proposed.startDifficulty,
        triggerReason: rule?.description || 'Low accuracy detected',
        evidenceSummary: rule?.condition || '',
        ruleId: rule?.ruleId,
      });
    }

    if (proposed.timeoutMultiplier && proposed.timeoutMultiplier > 1) {
      const rule = rulesApplied.find(r => r.adaptation.includes('timeout'));
      adaptations.push({
        adaptationType: 'timeout_extended',
        layer: 'session',
        currentValue: `${proposed.timeoutMultiplier}x`,
        triggerReason: rule?.description || 'Extended response time',
        evidenceSummary: rule?.condition || '',
        ruleId: rule?.ruleId,
      });
    }

    if (proposed.slowerTTS) {
      adaptations.push({
        adaptationType: 'slower_tts_enabled',
        layer: 'session',
        currentValue: true,
        triggerReason: 'Gentler audio pacing',
        evidenceSummary: 'TTS playback slowed for clarity',
      });
    }

    if (proposed.largeTargets) {
      const rule = rulesApplied.find(r => r.adaptation.includes('target'));
      adaptations.push({
        adaptationType: 'large_targets_enabled',
        layer: 'session',
        currentValue: true,
        triggerReason: rule?.description || 'Motor challenges detected',
        evidenceSummary: rule?.condition || '',
        ruleId: rule?.ruleId,
      });
    }

    if (proposed.focusPhonemes && proposed.focusPhonemes.length > 0) {
      const rule = rulesApplied.find(r => r.ruleId === 'phoneme_weakness_targeting');
      adaptations.push({
        adaptationType: 'focus_phonemes_set',
        layer: 'session',
        currentValue: proposed.focusPhonemes.join(', '),
        triggerReason: rule?.description || 'Targeting struggling sounds',
        evidenceSummary: rule?.condition || '',
        ruleId: rule?.ruleId,
      });
    }

    if (proposed.preferredCueType) {
      const rule = rulesApplied.find(r => r.adaptation.includes('cue'));
      adaptations.push({
        adaptationType: 'preferred_cue_type_set',
        layer: 'session',
        currentValue: proposed.preferredCueType,
        triggerReason: rule?.description || 'Optimized cue strategy',
        evidenceSummary: rule?.condition || '',
        ruleId: rule?.ruleId,
      });
    }

    return adaptations;
  }, [todayFocus]);

  // Map adaptation events to timeline format
  const adaptationTimeline = useMemo(() => {
    return adaptationEvents.map(event => ({
      id: event.id,
      timestamp: event.created_at,
      type: event.adaptation_type,
      layer: event.layer,
      description: formatAdaptationDescription(event),
      evidence: event.evidence as Record<string, unknown>,
    }));
  }, [adaptationEvents]);

  const refresh = () => {
    refreshTimeline();
  };

  return {
    analytics,
    todayFocus,
    activeAdaptations,
    adaptationTimeline,
    refresh,
  };
};

// Helper to format adaptation event for timeline display
function formatAdaptationDescription(event: any): string {
  // Handle raw JSONB values (no longer wrapped in {value: ...})
  const before = event.value_before;
  const after = event.value_after;
  
  switch (event.adaptation_type) {
    case 'difficulty_up':
      return `Difficulty increased: ${before} → ${after}`;
    case 'difficulty_down':
      return `Difficulty decreased: ${before} → ${after}`;
    case 'lane_switch':
      return `Content lane: ${before} → ${after}`;
    case 'cue_delivered':
      return `Cue shown: ${after} (${event.trigger_condition})`;
    case 'frustration_stepdown':
      return 'Emergency difficulty reduction due to frustration';
    default:
      return event.adaptation_type.replace(/_/g, ' ');
  }
}
