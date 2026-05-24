import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProfileId } from '@/hooks/useActiveProfileId';

interface ErrorBreakdown {
  correct: number;
  attempted: number;
  semantic_paraphasia: number;
  phonemic_paraphasia: number;
  circumlocution: number;
  neologism: number;
  no_response: number;
  timeout: number;
}

interface CueTrend {
  date: string;
  avgCues: number;
  trialCount: number;
}

interface CueEfficacy {
  cueType: string;
  totalGiven: number;
  effectiveCount: number;
  efficacyRate: number;
  avgTimeToSuccessMs: number | null;
}

interface FluencyMetrics {
  avgSpeechRateWpm: number | null;
  avgPauseCount: number | null;
  avgPauseDurationMs: number | null;
  effortfulSpeechRate: number;
}

interface ErrorTypeExample {
  target: string;
  transcript: string | null;
  audioPath: string;
  createdAt: string;
}

interface ErrorPatternAnalytics {
  errorBreakdown: ErrorBreakdown;
  cueTrends: CueTrend[];
  cueEfficacy: CueEfficacy[];
  fluencyMetrics: FluencyMetrics;
  totalTrials: number;
  overallAccuracy: number;
  challengingTargets: { target: string; errorRate: number; attempts: number; exampleAudioPath?: string }[];
  categoryPerformance: { category: string; accuracy: number; attempts: number }[];
  errorTypeExamples: Record<string, ErrorTypeExample[]>;
}

interface UseErrorPatternOptions {
  weeksBack?: number;
  enabled?: boolean;
}

export const useErrorPatternAnalytics = (
  userId: string | null | undefined,
  options: UseErrorPatternOptions = {}
) => {
  const { weeksBack = 12, enabled = true } = options;
  const activeProfileId = useActiveProfileId();
  const [analytics, setAnalytics] = useState<ErrorPatternAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!enabled || !userId) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (weeksBack * 7));

      // Fetch from utterance_analyses for accurate error classification
      let uaQ = supabase
        .from('utterance_analyses')
        .select(`
          error_type,
          is_correct,
          target_word,
          category,
          cue_type_given,
          cue_was_effective,
          time_to_success_after_cue_ms,
          speech_rate_wpm,
          pause_count,
          avg_pause_duration_ms,
          effortful_speech,
          phonological_similarity,
          semantic_similarity,
          created_at,
          audio_storage_path,
          transcript
        `)
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });
      if (activeProfileId) uaQ = uaQ.eq('profile_id', activeProfileId);
      const { data: utteranceData, error: utteranceError } = await uaQ;

      if (utteranceError) throw utteranceError;

      const data = utteranceData || [];

      // Calculate error breakdown using proper error types
      const errorBreakdown: ErrorBreakdown = {
        correct: 0,
        attempted: 0,
        semantic_paraphasia: 0,
        phonemic_paraphasia: 0,
        circumlocution: 0,
        neologism: 0,
        no_response: 0,
        timeout: 0,
      };

      data.forEach(event => {
        const errorType = event.error_type?.toLowerCase() || '';
        if (event.is_correct) {
          errorBreakdown.correct++;
        } else if (errorType === 'attempted') {
          errorBreakdown.attempted++;
        } else if (errorType === 'semantic_paraphasia' || errorType.includes('semantic')) {
          errorBreakdown.semantic_paraphasia++;
        } else if (errorType === 'phonemic_paraphasia' || errorType.includes('phonemic') || errorType.includes('phonological')) {
          errorBreakdown.phonemic_paraphasia++;
        } else if (errorType === 'circumlocution') {
          errorBreakdown.circumlocution++;
        } else if (errorType === 'neologism') {
          errorBreakdown.neologism++;
        } else if (errorType === 'no_response') {
          errorBreakdown.no_response++;
        } else if (errorType === 'timeout') {
          errorBreakdown.timeout++;
        }
      });

      // Calculate cue trends (weekly)
      const cueTrendsMap = new Map<string, { totalCues: number; count: number }>();
      
      data.forEach(event => {
        const date = new Date(event.created_at!);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];

        if (!cueTrendsMap.has(weekKey)) {
          cueTrendsMap.set(weekKey, { totalCues: 0, count: 0 });
        }

        const weekData = cueTrendsMap.get(weekKey)!;
        weekData.totalCues += event.cue_type_given ? 1 : 0;
        weekData.count++;
      });

      const cueTrends: CueTrend[] = Array.from(cueTrendsMap.entries())
        .map(([date, d]) => ({
          date,
          avgCues: d.count > 0 ? d.totalCues / d.count : 0,
          trialCount: d.count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Calculate cue efficacy by type
      const cueEfficacyMap = new Map<string, { given: number; effective: number; totalTimeMs: number; countWithTime: number }>();
      
      data.forEach(event => {
        if (event.cue_type_given) {
          const cueType = event.cue_type_given;
          const existing = cueEfficacyMap.get(cueType) || { given: 0, effective: 0, totalTimeMs: 0, countWithTime: 0 };
          existing.given++;
          if (event.cue_was_effective) {
            existing.effective++;
            if (event.time_to_success_after_cue_ms) {
              existing.totalTimeMs += event.time_to_success_after_cue_ms;
              existing.countWithTime++;
            }
          }
          cueEfficacyMap.set(cueType, existing);
        }
      });

      const cueEfficacy: CueEfficacy[] = Array.from(cueEfficacyMap.entries())
        .map(([cueType, d]) => ({
          cueType,
          totalGiven: d.given,
          effectiveCount: d.effective,
          efficacyRate: d.given > 0 ? d.effective / d.given : 0,
          avgTimeToSuccessMs: d.countWithTime > 0 ? d.totalTimeMs / d.countWithTime : null,
        }));

      // Calculate fluency metrics
      const withSpeechRate = data.filter(e => e.speech_rate_wpm !== null);
      const withPauseCount = data.filter(e => e.pause_count !== null);
      const withPauseDuration = data.filter(e => e.avg_pause_duration_ms !== null);
      const withEffortful = data.filter(e => e.effortful_speech !== null);

      const fluencyMetrics: FluencyMetrics = {
        avgSpeechRateWpm: withSpeechRate.length > 0 
          ? withSpeechRate.reduce((sum, e) => sum + (e.speech_rate_wpm || 0), 0) / withSpeechRate.length 
          : null,
        avgPauseCount: withPauseCount.length > 0 
          ? withPauseCount.reduce((sum, e) => sum + (e.pause_count || 0), 0) / withPauseCount.length 
          : null,
        avgPauseDurationMs: withPauseDuration.length > 0 
          ? withPauseDuration.reduce((sum, e) => sum + (e.avg_pause_duration_ms || 0), 0) / withPauseDuration.length 
          : null,
        effortfulSpeechRate: withEffortful.length > 0 
          ? withEffortful.filter(e => e.effortful_speech).length / withEffortful.length 
          : 0,
      };

      // Calculate challenging targets (highest error rate with min 3 attempts)
      const targetStatsMap = new Map<string, { errors: number; total: number; exampleAudioPath?: string }>();
      data.forEach(event => {
        if (event.target_word) {
          const existing = targetStatsMap.get(event.target_word) || { errors: 0, total: 0, exampleAudioPath: undefined };
          existing.total++;
          if (!event.is_correct) {
            existing.errors++;
            // Keep first error audio example
            if (!existing.exampleAudioPath && event.audio_storage_path) {
              existing.exampleAudioPath = event.audio_storage_path;
            }
          }
          targetStatsMap.set(event.target_word, existing);
        }
      });

      const challengingTargets = Array.from(targetStatsMap.entries())
        .filter(([_, d]) => d.total >= 3)
        .map(([target, d]) => ({
          target,
          errorRate: d.total > 0 ? d.errors / d.total : 0,
          attempts: d.total,
          exampleAudioPath: d.exampleAudioPath,
        }))
        .sort((a, b) => b.errorRate - a.errorRate)
        .slice(0, 10);

      // Calculate category performance
      const categoryStatsMap = new Map<string, { correct: number; total: number }>();
      data.forEach(event => {
        const category = event.category || 'unknown';
        const existing = categoryStatsMap.get(category) || { correct: 0, total: 0 };
        existing.total++;
        if (event.is_correct) existing.correct++;
        categoryStatsMap.set(category, existing);
      });

      const categoryPerformance = Array.from(categoryStatsMap.entries())
        .map(([category, d]) => ({
          category,
          accuracy: d.total > 0 ? d.correct / d.total : 0,
          attempts: d.total,
        }))
        .sort((a, b) => b.attempts - a.attempts);

      // Collect audio examples per error type (up to 3 per type)
      const errorTypeExamplesMap = new Map<string, ErrorTypeExample[]>();
      const errorTypeKeys = ['semantic_paraphasia', 'phonemic_paraphasia', 'circumlocution', 'neologism', 'no_response', 'timeout', 'attempted'];
      
      data.forEach(event => {
        if (!event.is_correct && event.audio_storage_path && event.error_type) {
          const errorType = event.error_type.toLowerCase();
          const matchedType = errorTypeKeys.find(key => 
            errorType === key || errorType.includes(key.split('_')[0])
          );
          
          if (matchedType) {
            const existing = errorTypeExamplesMap.get(matchedType) || [];
            if (existing.length < 3) {
              existing.push({
                target: event.target_word,
                transcript: event.transcript,
                audioPath: event.audio_storage_path,
                createdAt: event.created_at!,
              });
              errorTypeExamplesMap.set(matchedType, existing);
            }
          }
        }
      });

      const errorTypeExamples: Record<string, ErrorTypeExample[]> = {};
      errorTypeExamplesMap.forEach((examples, type) => {
        errorTypeExamples[type] = examples;
      });

      // Calculate overall stats
      const totalTrials = data.length;
      const correctTrials = data.filter(e => e.is_correct).length;
      const overallAccuracy = totalTrials > 0 ? (correctTrials / totalTrials) * 100 : 0;

      setAnalytics({
        errorBreakdown,
        cueTrends,
        cueEfficacy,
        fluencyMetrics,
        totalTrials,
        overallAccuracy,
        challengingTargets,
        categoryPerformance,
        errorTypeExamples,
      });
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setIsLoading(false);
    }
  }, [userId, weeksBack, enabled, activeProfileId]);

  useEffect(() => {
    if (enabled && userId) {
      fetchAnalytics();
    }
  }, [userId, weeksBack, enabled, activeProfileId, fetchAnalytics]);

  // Set up real-time subscription to utterance_analyses
  useEffect(() => {
    if (!enabled || !userId) return;

    const channel = supabase
      .channel('utterance-analytics')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'utterance_analyses',
        },
        () => {
          console.log('New utterance analysis detected, refreshing analytics...');
          fetchAnalytics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchAnalytics]);

  return {
    analytics,
    isLoading,
    error,
    refetch: fetchAnalytics,
  };
};
