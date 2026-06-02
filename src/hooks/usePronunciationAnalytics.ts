import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, format } from 'date-fns';

interface AcousticMetrics {
  speechRateWpm: number;
  totalDurationSec: number;
  wordCount: number;
  pauseCount: number;
  avgPauseDurationMs: number;
  totalPauseDurationSec: number;
  speechToPauseRatio: number;
  segmentCount: number;
}

interface AzureGopData {
  pronunciationScore?: number;
  accuracyScore?: number;
  fluencyScore?: number;
  completenessScore?: number;
  prosodyScore?: number;
  words?: any[];
  source?: string;
}

interface PronunciationDataPoint {
  date: string;
  speechRate: number;
  pauseFrequency: number;
  avgPauseDuration: number;
  confidence: number;
  trialCount: number;
  // Azure Pronunciation Assessment
  pronunciationScore?: number;
  accuracyScore?: number;
  fluencyScore?: number;
  completenessScore?: number;
}

interface PronunciationAnalytics {
  timeSeries: PronunciationDataPoint[];
  overallStats: {
    avgSpeechRate: number;
    avgPauseFrequency: number;
    avgConfidence: number;
    totalTrials: number;
    // Azure Pronunciation Assessment averages
    avgPronunciationScore: number;
    avgAccuracyScore: number;
    avgFluencyScore: number;
    hasAzureData: boolean;
    improvementTrend: {
      speechRate: number;
      confidence: number;
      pauseFrequency: number;
      pronunciationScore: number;
    };
  };
}

export const usePronunciationAnalytics = (userId?: string, profileId?: string | null) => {
  return useQuery({
    queryKey: ['pronunciation-analytics', userId, profileId],
    queryFn: async (): Promise<PronunciationAnalytics> => {
      if (!userId) {
        return {
          timeSeries: [],
          overallStats: {
            avgSpeechRate: 0,
            avgPauseFrequency: 0,
            avgConfidence: 0,
            totalTrials: 0,
            avgPronunciationScore: 0,
            avgAccuracyScore: 0,
            avgFluencyScore: 0,
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
              avgSpeechRate: 0,
              avgPauseFrequency: 0,
              avgConfidence: 0,
              totalTrials: 0,
              avgPronunciationScore: 0,
              avgAccuracyScore: 0,
              avgFluencyScore: 0,
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
              avgSpeechRate: 0,
              avgPauseFrequency: 0,
              avgConfidence: 0,
              totalTrials: 0,
              avgPronunciationScore: 0,
              avgAccuracyScore: 0,
              avgFluencyScore: 0,
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
        const durationMin = (ua.recording_duration_ms || 1000) / 60000; // Convert to minutes

        if (!dailyData.has(date)) {
          dailyData.set(date, {
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
        
        if (ua.speech_rate_wpm) {
          dayData.speechRates.push(ua.speech_rate_wpm);
        }
        if (ua.pause_count !== null && durationMin > 0) {
          dayData.pauseFrequencies.push(ua.pause_count / durationMin);
        }
        if (ua.avg_pause_duration_ms) {
          dayData.pauseDurations.push(ua.avg_pause_duration_ms);
        }
        if (ua.asr_confidence) {
          dayData.confidences.push(ua.asr_confidence);
        }

        // Azure Pronunciation Assessment scores
        if (gopData?.source === 'azure') {
          hasAzureData = true;
          if (gopData.pronunciationScore) dayData.pronunciationScores.push(gopData.pronunciationScore);
          if (gopData.accuracyScore) dayData.accuracyScores.push(gopData.accuracyScore);
          if (gopData.fluencyScore) dayData.fluencyScores.push(gopData.fluencyScore);
          if (gopData.completenessScore) dayData.completenessScores.push(gopData.completenessScore);
        }
      });

      // Calculate daily averages
      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      
      const timeSeries: PronunciationDataPoint[] = Array.from(dailyData.entries())
        .map(([date, data]) => ({
          date,
          speechRate: avg(data.speechRates),
          pauseFrequency: avg(data.pauseFrequencies),
          avgPauseDuration: avg(data.pauseDurations),
          confidence: avg(data.confidences),
          trialCount: Math.max(data.speechRates.length, data.pronunciationScores.length, 1),
          pronunciationScore: avg(data.pronunciationScores) || undefined,
          accuracyScore: avg(data.accuracyScores) || undefined,
          fluencyScore: avg(data.fluencyScores) || undefined,
          completenessScore: avg(data.completenessScores) || undefined
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
        const firstVals = firstHalf.map(d => d[key] as number).filter(v => v !== undefined && !isNaN(v));
        const secondVals = secondHalf.map(d => d[key] as number).filter(v => v !== undefined && !isNaN(v));
        if (firstVals.length === 0 || secondVals.length === 0) return 0;
        const firstAvg = avg(firstVals);
        const secondAvg = avg(secondVals);
        return firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
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
function processLegacyEvents(events: any[]): PronunciationAnalytics {
  const dailyData = new Map<string, {
    speechRates: number[];
    pauseFrequencies: number[];
    pauseDurations: number[];
    confidences: number[];
  }>();

  events.forEach(event => {
    const date = format(startOfDay(new Date(event.created_at)), 'yyyy-MM-dd');
    const metrics = event.acoustic_metrics as AcousticMetrics;
    const confidence = event.whisper_confidence || 0;

    if (!dailyData.has(date)) {
      dailyData.set(date, { speechRates: [], pauseFrequencies: [], pauseDurations: [], confidences: [] });
    }

    const dayData = dailyData.get(date)!;
    if (metrics?.speechRateWpm) dayData.speechRates.push(metrics.speechRateWpm);
    if (metrics?.pauseCount && metrics?.totalDurationSec) {
      dayData.pauseFrequencies.push(metrics.pauseCount / (metrics.totalDurationSec / 60));
    }
    if (metrics?.avgPauseDurationMs) dayData.pauseDurations.push(metrics.avgPauseDurationMs);
    dayData.confidences.push(confidence);
  });

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const timeSeries = Array.from(dailyData.entries())
    .map(([date, data]) => ({
      date,
      speechRate: avg(data.speechRates),
      pauseFrequency: avg(data.pauseFrequencies),
      avgPauseDuration: avg(data.pauseDurations),
      confidence: avg(data.confidences),
      trialCount: data.speechRates.length
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const allSpeechRates = events.map(e => (e.acoustic_metrics as AcousticMetrics)?.speechRateWpm).filter(Boolean);
  const allPauseFreqs = events.map(e => {
    const m = e.acoustic_metrics as AcousticMetrics;
    return m?.pauseCount && m?.totalDurationSec ? m.pauseCount / (m.totalDurationSec / 60) : null;
  }).filter(Boolean) as number[];
  const allConfidences = events.map(e => e.whisper_confidence || 0);

  return {
    timeSeries,
    overallStats: {
      avgSpeechRate: avg(allSpeechRates as number[]),
      avgPauseFrequency: avg(allPauseFreqs),
      avgConfidence: avg(allConfidences),
      totalTrials: events.length,
      avgPronunciationScore: 0,
      avgAccuracyScore: 0,
      avgFluencyScore: 0,
      hasAzureData: false,
      improvementTrend: { speechRate: 0, confidence: 0, pauseFrequency: 0, pronunciationScore: 0 }
    }
  };
}
