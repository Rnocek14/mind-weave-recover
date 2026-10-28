import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, format } from 'date-fns';

interface AcousticMetrics {
  speechRateWpm: number | null;
  totalDurationSec: number | null;
  wordCount: number | null;
  pauseCount: number | null;
  avgPauseDurationMs: number | null;
  totalPauseDurationSec: number | null;
  speechToPauseRatio: number | null;
  segmentCount: number;
}

interface AzureGopData {
  pronunciationScore?: number | null;
  accuracyScore?: number | null;
  fluencyScore?: number | null;
  completenessScore?: number | null;
  prosodyScore?: number | null;
  words?: unknown[];
  source?: string;
}

interface PronunciationDataPoint {
  date: string;
  speechRate: number | null;
  pauseFrequency: number | null;
  avgPauseDuration: number | null;
  confidence: number | null;
  trialCount: number;
  // Azure Pronunciation Assessment
  pronunciationScore?: number | null;
  accuracyScore?: number | null;
  fluencyScore?: number | null;
  completenessScore?: number | null;
}

interface PronunciationAnalytics {
  timeSeries: PronunciationDataPoint[];
  overallStats: {
    avgSpeechRate: number | null;
    avgPauseFrequency: number | null;
    avgConfidence: number | null;
    totalTrials: number;
    // Azure Pronunciation Assessment averages
    avgPronunciationScore: number | null;
    avgAccuracyScore: number | null;
    avgFluencyScore: number | null;
    hasAzureData: boolean;
    improvementTrend: {
      speechRate: number;
      confidence: number;
      pauseFrequency: number;
      pronunciationScore: number;
    };
  };
}

const measured = (value: unknown, max = Infinity): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
// Each measurement has its own denominator. Zero is an observation; missing
// evidence is not an observation and an empty series has no measured average.
const avg = (values: number[]): number | null =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export const usePronunciationAnalytics = (userId?: string, profileId?: string | null) => {
  return useQuery({
    queryKey: ['pronunciation-analytics', userId, profileId],
    queryFn: async (): Promise<PronunciationAnalytics> => {
      if (!userId) {
        return {
          timeSeries: [],
          overallStats: {
            avgSpeechRate: null,
            avgPauseFrequency: null,
            avgConfidence: null,
            totalTrials: 0,
            avgPronunciationScore: null,
            avgAccuracyScore: null,
            avgFluencyScore: null,
            hasAzureData: false,
            improvementTrend: { speechRate: 0, confidence: 0, pauseFrequency: 0, pronunciationScore: 0 }
          }
        };
      }

      // Fetch from utterance_analyses (preferred - includes Azure GOP data)
      let uaQuery = supabase
        .from('utterance_analyses')
        .select('created_at, speech_rate_wpm, pause_count, avg_pause_duration_ms, asr_confidence, gop_data, recording_duration_ms')
        .eq('user_id', userId);
      if (profileId) uaQuery = uaQuery.eq('profile_id', profileId);
      const { data: utterances, error: uaError } = await uaQuery.order('created_at', { ascending: true });

      if (uaError) throw uaError;

      // If no data from utterance_analyses, fall back to exercise_events
      if (!utterances || utterances.length === 0) {
        // Fallback to legacy exercise_events query
        let sessQuery = supabase
          .from('sessions')
          .select('id')
          .eq('user_id', userId);
        if (profileId) sessQuery = sessQuery.eq('profile_id', profileId);
        const { data: sessions } = await sessQuery;

        if (!sessions || sessions.length === 0) {
          return {
            timeSeries: [],
            overallStats: {
              avgSpeechRate: null,
              avgPauseFrequency: null,
              avgConfidence: null,
              totalTrials: 0,
              avgPronunciationScore: null,
              avgAccuracyScore: null,
              avgFluencyScore: null,
              hasAzureData: false,
              improvementTrend: { speechRate: 0, confidence: 0, pauseFrequency: 0, pronunciationScore: 0 }
            }
          };
        }

        const sessionIds = sessions.map(s => s.id);
        const { data: events } = await supabase
          .from('exercise_events')
          .select('created_at, acoustic_metrics, whisper_confidence')
          .in('session_id', sessionIds)
          .not('acoustic_metrics', 'is', null)
          .order('created_at', { ascending: true });

        if (!events || events.length === 0) {
          return {
            timeSeries: [],
            overallStats: {
              avgSpeechRate: null,
              avgPauseFrequency: null,
              avgConfidence: null,
              totalTrials: 0,
              avgPronunciationScore: null,
              avgAccuracyScore: null,
              avgFluencyScore: null,
              hasAzureData: false,
              improvementTrend: { speechRate: 0, confidence: 0, pauseFrequency: 0, pronunciationScore: 0 }
            }
          };
        }

        // Process legacy events without Azure data
        return processLegacyEvents(events);
      }

      // Process utterance_analyses with Azure data
      const dailyData = new Map<string, {
        trials: number;
        speechRates: number[];
        pauseFrequencies: number[];
        pauseDurations: number[];
        confidences: number[];
        pronunciationScores: number[];
        accuracyScores: number[];
        fluencyScores: number[];
        completenessScores: number[];
      }>();

      let hasAzureData = false;

      utterances.forEach(ua => {
        const date = format(startOfDay(new Date(ua.created_at)), 'yyyy-MM-dd');
        const gopData = ua.gop_data as AzureGopData | null;
        const durationMin = measured(ua.recording_duration_ms) && ua.recording_duration_ms > 0
          ? ua.recording_duration_ms / 60000 : null;

        if (!dailyData.has(date)) {
          dailyData.set(date, {
            trials: 0,
            speechRates: [],
            pauseFrequencies: [],
            pauseDurations: [],
            confidences: [],
            pronunciationScores: [],
            accuracyScores: [],
            fluencyScores: [],
            completenessScores: []
          });
        }

        const dayData = dailyData.get(date)!;
        dayData.trials += 1;
        
        if (measured(ua.speech_rate_wpm)) {
          dayData.speechRates.push(ua.speech_rate_wpm);
        }
        if (measured(ua.pause_count) && durationMin !== null) {
          dayData.pauseFrequencies.push(ua.pause_count / durationMin);
        }
        if (measured(ua.avg_pause_duration_ms)) {
          dayData.pauseDurations.push(ua.avg_pause_duration_ms);
        }
        if (measured(ua.asr_confidence, 1)) {
          dayData.confidences.push(ua.asr_confidence);
        }

        // Azure Pronunciation Assessment scores
        if (gopData?.source === 'azure') {
          hasAzureData = true;
          if (measured(gopData.pronunciationScore, 100)) dayData.pronunciationScores.push(gopData.pronunciationScore);
          if (measured(gopData.accuracyScore, 100)) dayData.accuracyScores.push(gopData.accuracyScore);
          if (measured(gopData.fluencyScore, 100)) dayData.fluencyScores.push(gopData.fluencyScore);
          if (measured(gopData.completenessScore, 100)) dayData.completenessScores.push(gopData.completenessScore);
        }
      });

      // Calculate daily averages
      
      const timeSeries: PronunciationDataPoint[] = Array.from(dailyData.entries())
        .map(([date, data]) => ({
          date,
          speechRate: avg(data.speechRates),
          pauseFrequency: avg(data.pauseFrequencies),
          avgPauseDuration: avg(data.pauseDurations),
          confidence: avg(data.confidences),
          trialCount: data.trials,
          pronunciationScore: avg(data.pronunciationScores),
          accuracyScore: avg(data.accuracyScores),
          fluencyScore: avg(data.fluencyScores),
          completenessScore: avg(data.completenessScores)
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Collect all values for overall stats
      const allSpeechRates: number[] = [];
      const allPauseFreqs: number[] = [];
      const allConfidences: number[] = [];
      const allPronScores: number[] = [];
      const allAccScores: number[] = [];
      const allFluScores: number[] = [];

      dailyData.forEach(d => {
        allSpeechRates.push(...d.speechRates);
        allPauseFreqs.push(...d.pauseFrequencies);
        allConfidences.push(...d.confidences);
        allPronScores.push(...d.pronunciationScores);
        allAccScores.push(...d.accuracyScores);
        allFluScores.push(...d.fluencyScores);
      });

      // Calculate improvement trends
      const halfPoint = Math.floor(timeSeries.length / 2);
      const firstHalf = timeSeries.slice(0, halfPoint);
      const secondHalf = timeSeries.slice(halfPoint);

      const calculateTrend = (key: keyof PronunciationDataPoint) => {
        if (firstHalf.length === 0 || secondHalf.length === 0) return 0;
        const firstVals = firstHalf.map(d => d[key]).filter((value): value is number => measured(value));
        const secondVals = secondHalf.map(d => d[key]).filter((value): value is number => measured(value));
        if (firstVals.length === 0 || secondVals.length === 0) return 0;
        const firstAvg = avg(firstVals);
        const secondAvg = avg(secondVals);
        return firstAvg !== null && secondAvg !== null && firstAvg > 0
          ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
      };

      return {
        timeSeries,
        overallStats: {
          avgSpeechRate: avg(allSpeechRates),
          avgPauseFrequency: avg(allPauseFreqs),
          avgConfidence: avg(allConfidences),
          totalTrials: utterances.length,
          avgPronunciationScore: avg(allPronScores),
          avgAccuracyScore: avg(allAccScores),
          avgFluencyScore: avg(allFluScores),
          hasAzureData,
          improvementTrend: {
            speechRate: calculateTrend('speechRate'),
            confidence: calculateTrend('confidence'),
            pauseFrequency: calculateTrend('pauseFrequency'),
            pronunciationScore: calculateTrend('pronunciationScore')
          }
        }
      };
    },
    enabled: !!userId
  });
};

// Legacy processor for exercise_events fallback
function processLegacyEvents(events: Array<{
  created_at: string; acoustic_metrics: unknown; whisper_confidence: number | null;
}>): PronunciationAnalytics {
  const dailyData = new Map<string, {
    trials: number;
    speechRates: number[];
    pauseFrequencies: number[];
    pauseDurations: number[];
    confidences: number[];
  }>();

  events.forEach(event => {
    const date = format(startOfDay(new Date(event.created_at)), 'yyyy-MM-dd');
    const metrics = event.acoustic_metrics as AcousticMetrics;
    const confidence = event.whisper_confidence;

    if (!dailyData.has(date)) {
      dailyData.set(date, { trials: 0, speechRates: [], pauseFrequencies: [], pauseDurations: [], confidences: [] });
    }

    const dayData = dailyData.get(date)!;
    dayData.trials += 1;
    if (measured(metrics?.speechRateWpm)) dayData.speechRates.push(metrics.speechRateWpm);
    if (measured(metrics?.pauseCount) && measured(metrics?.totalDurationSec) && metrics.totalDurationSec > 0) {
      dayData.pauseFrequencies.push(metrics.pauseCount / (metrics.totalDurationSec / 60));
    }
    if (measured(metrics?.avgPauseDurationMs)) dayData.pauseDurations.push(metrics.avgPauseDurationMs);
    if (measured(confidence, 1)) dayData.confidences.push(confidence);
  });


  const timeSeries = Array.from(dailyData.entries())
    .map(([date, data]) => ({
      date,
      speechRate: avg(data.speechRates),
      pauseFrequency: avg(data.pauseFrequencies),
      avgPauseDuration: avg(data.pauseDurations),
      confidence: avg(data.confidences),
      trialCount: data.trials
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const days = Array.from(dailyData.values());
  const allSpeechRates = days.flatMap(day => day.speechRates);
  const allPauseFreqs = days.flatMap(day => day.pauseFrequencies);
  const allConfidences = days.flatMap(day => day.confidences);

  return {
    timeSeries,
    overallStats: {
      avgSpeechRate: avg(allSpeechRates),
      avgPauseFrequency: avg(allPauseFreqs),
      avgConfidence: avg(allConfidences),
      totalTrials: events.length,
      avgPronunciationScore: null,
      avgAccuracyScore: null,
      avgFluencyScore: null,
      hasAzureData: false,
      improvementTrend: { speechRate: 0, confidence: 0, pauseFrequency: 0, pronunciationScore: 0 }
    }
  };
}
