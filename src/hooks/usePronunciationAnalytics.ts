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

interface PronunciationDataPoint {
  date: string;
  speechRate: number;
  pauseFrequency: number;
  avgPauseDuration: number;
  confidence: number;
  trialCount: number;
}

interface PronunciationAnalytics {
  timeSeries: PronunciationDataPoint[];
  overallStats: {
    avgSpeechRate: number;
    avgPauseFrequency: number;
    avgConfidence: number;
    totalTrials: number;
    improvementTrend: {
      speechRate: number;
      confidence: number;
      pauseFrequency: number;
    };
  };
}

export const usePronunciationAnalytics = (userId?: string) => {
  return useQuery({
    queryKey: ['pronunciation-analytics', userId],
    queryFn: async (): Promise<PronunciationAnalytics> => {
      if (!userId) {
        return {
          timeSeries: [],
          overallStats: {
            avgSpeechRate: 0,
            avgPauseFrequency: 0,
            avgConfidence: 0,
            totalTrials: 0,
            improvementTrend: { speechRate: 0, confidence: 0, pauseFrequency: 0 }
          }
        };
      }

      // Get user's sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', userId);

      if (sessionsError) throw sessionsError;
      if (!sessions || sessions.length === 0) {
        return {
          timeSeries: [],
          overallStats: {
            avgSpeechRate: 0,
            avgPauseFrequency: 0,
            avgConfidence: 0,
            totalTrials: 0,
            improvementTrend: { speechRate: 0, confidence: 0, pauseFrequency: 0 }
          }
        };
      }

      const sessionIds = sessions.map(s => s.id);

      // Fetch exercise events with acoustic metrics
      const { data: events, error: eventsError } = await supabase
        .from('exercise_events')
        .select('created_at, acoustic_metrics, whisper_confidence')
        .in('session_id', sessionIds)
        .not('acoustic_metrics', 'is', null)
        .not('whisper_confidence', 'is', null)
        .order('created_at', { ascending: true });

      if (eventsError) throw eventsError;
      if (!events || events.length === 0) {
        return {
          timeSeries: [],
          overallStats: {
            avgSpeechRate: 0,
            avgPauseFrequency: 0,
            avgConfidence: 0,
            totalTrials: 0,
            improvementTrend: { speechRate: 0, confidence: 0, pauseFrequency: 0 }
          }
        };
      }

      // Group by day
      const dailyData = new Map<string, {
        speechRates: number[];
        pauseFrequencies: number[];
        pauseDurations: number[];
        confidences: number[];
      }>();

      events.forEach(event => {
        const date = format(startOfDay(new Date(event.created_at)), 'yyyy-MM-dd');
        const metrics = event.acoustic_metrics as unknown as AcousticMetrics;
        const confidence = event.whisper_confidence || 0;

        if (!dailyData.has(date)) {
          dailyData.set(date, {
            speechRates: [],
            pauseFrequencies: [],
            pauseDurations: [],
            confidences: []
          });
        }

        const dayData = dailyData.get(date)!;
        dayData.speechRates.push(metrics.speechRateWpm);
        dayData.pauseFrequencies.push(metrics.pauseCount / (metrics.totalDurationSec / 60)); // pauses per minute
        dayData.pauseDurations.push(metrics.avgPauseDurationMs);
        dayData.confidences.push(confidence);
      });

      // Calculate daily averages
      const timeSeries: PronunciationDataPoint[] = Array.from(dailyData.entries())
        .map(([date, data]) => ({
          date,
          speechRate: data.speechRates.reduce((a, b) => a + b, 0) / data.speechRates.length,
          pauseFrequency: data.pauseFrequencies.reduce((a, b) => a + b, 0) / data.pauseFrequencies.length,
          avgPauseDuration: data.pauseDurations.reduce((a, b) => a + b, 0) / data.pauseDurations.length,
          confidence: data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length,
          trialCount: data.speechRates.length
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Calculate overall stats
      const allSpeechRates = events.map(e => (e.acoustic_metrics as unknown as AcousticMetrics).speechRateWpm);
      const allPauseFrequencies = events.map(e => {
        const m = e.acoustic_metrics as unknown as AcousticMetrics;
        return m.pauseCount / (m.totalDurationSec / 60);
      });
      const allConfidences = events.map(e => e.whisper_confidence || 0);

      const avgSpeechRate = allSpeechRates.reduce((a, b) => a + b, 0) / allSpeechRates.length;
      const avgPauseFrequency = allPauseFrequencies.reduce((a, b) => a + b, 0) / allPauseFrequencies.length;
      const avgConfidence = allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length;

      // Calculate improvement trends (first half vs second half)
      const halfPoint = Math.floor(timeSeries.length / 2);
      const firstHalf = timeSeries.slice(0, halfPoint);
      const secondHalf = timeSeries.slice(halfPoint);

      const calculateTrend = (data: PronunciationDataPoint[], key: keyof PronunciationDataPoint) => {
        if (firstHalf.length === 0 || secondHalf.length === 0) return 0;
        const firstAvg = firstHalf.reduce((sum, d) => sum + (d[key] as number), 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, d) => sum + (d[key] as number), 0) / secondHalf.length;
        return ((secondAvg - firstAvg) / firstAvg) * 100;
      };

      return {
        timeSeries,
        overallStats: {
          avgSpeechRate,
          avgPauseFrequency,
          avgConfidence,
          totalTrials: events.length,
          improvementTrend: {
            speechRate: calculateTrend(timeSeries, 'speechRate'),
            confidence: calculateTrend(timeSeries, 'confidence'),
            pauseFrequency: calculateTrend(timeSeries, 'pauseFrequency')
          }
        }
      };
    },
    enabled: !!userId
  });
};
