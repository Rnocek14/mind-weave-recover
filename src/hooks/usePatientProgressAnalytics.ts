import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, format, subWeeks } from 'date-fns';

export interface DomainProgressPoint {
  date: string;
  motor_accuracy?: number;
  speech_accuracy?: number;
  motor_rt?: number;
  speech_rt?: number;
}

export interface DomainTrend {
  domain: string;
  currentAccuracy: number;
  previousAccuracy: number;
  improvement: number; // percentage change
  trialCount: number;
}

export const usePatientProgressAnalytics = (userId: string | undefined, weeksBack: number = 8) => {
  const [progressData, setProgressData] = useState<DomainProgressPoint[]>([]);
  const [domainTrends, setDomainTrends] = useState<DomainTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchProgressData();
    }
  }, [userId, weeksBack]);

  const fetchProgressData = async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const startDate = subWeeks(new Date(), weeksBack);

      // Fetch exercise events grouped by exercise type and week
      // First get session IDs
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', userId)
        .gte('started_at', startDate.toISOString());

      if (sessionsError) throw sessionsError;

      const sessionIds = sessions?.map(s => s.id) || [];
      
      if (sessionIds.length === 0) {
        setProgressData([]);
        setDomainTrends([]);
        setIsLoading(false);
        return;
      }

      const { data: events, error: eventsError } = await supabase
        .from('exercise_events')
        .select(`
          exercise_slug,
          score,
          reaction_time_ms,
          created_at,
          session_id
        `)
        .in('session_id', sessionIds);

      if (eventsError) throw eventsError;

      // Group by week and exercise type
      const weeklyStats: Record<string, {
        motor: { accuracy: number[]; rt: number[] };
        speech: { accuracy: number[]; rt: number[] };
      }> = {};

      events?.forEach(event => {
        const weekStart = startOfWeek(new Date(event.created_at));
        const weekKey = format(weekStart, 'MMM d');

        if (!weeklyStats[weekKey]) {
          weeklyStats[weekKey] = {
            motor: { accuracy: [], rt: [] },
            speech: { accuracy: [], rt: [] }
          };
        }

        const isMotor = event.exercise_slug === 'reach-tap';
        const isSpeech = event.exercise_slug === 'photo-naming';
        
        if (isMotor) {
          weeklyStats[weekKey].motor.accuracy.push(event.score || 0);
          if (event.reaction_time_ms) {
            weeklyStats[weekKey].motor.rt.push(event.reaction_time_ms);
          }
        } else if (isSpeech) {
          weeklyStats[weekKey].speech.accuracy.push(event.score || 0);
          if (event.reaction_time_ms) {
            weeklyStats[weekKey].speech.rt.push(event.reaction_time_ms);
          }
        }
      });

      // Calculate averages per week
      const progressArray = Object.entries(weeklyStats).map(([date, stats]) => {
        const point: DomainProgressPoint = { date };

        if (stats.motor.accuracy.length > 0) {
          point.motor_accuracy = Math.round(
            (stats.motor.accuracy.reduce((a, b) => a + b, 0) / stats.motor.accuracy.length) * 100
          );
        }

        if (stats.speech.accuracy.length > 0) {
          point.speech_accuracy = Math.round(
            (stats.speech.accuracy.reduce((a, b) => a + b, 0) / stats.speech.accuracy.length) * 100
          );
        }

        if (stats.motor.rt.length > 0) {
          point.motor_rt = Math.round(
            stats.motor.rt.reduce((a, b) => a + b, 0) / stats.motor.rt.length
          );
        }

        if (stats.speech.rt.length > 0) {
          point.speech_rt = Math.round(
            stats.speech.rt.reduce((a, b) => a + b, 0) / stats.speech.rt.length
          );
        }

        return point;
      });

      setProgressData(progressArray);

      // Calculate domain trends (last 4 weeks vs previous 4 weeks)
      const midPoint = Math.floor(weeksBack / 2);
      const recentWeeks = progressArray.slice(-midPoint);
      const previousWeeks = progressArray.slice(0, midPoint);

      const calculateTrend = (
        domain: string,
        accuracyKey: 'motor_accuracy' | 'speech_accuracy'
      ): DomainTrend | null => {
        const recentAcc = recentWeeks
          .map(w => w[accuracyKey])
          .filter((a): a is number => a !== undefined);
        
        const prevAcc = previousWeeks
          .map(w => w[accuracyKey])
          .filter((a): a is number => a !== undefined);

        if (recentAcc.length === 0) return null;

        const currentAccuracy = Math.round(
          recentAcc.reduce((a, b) => a + b, 0) / recentAcc.length
        );

        const previousAccuracy = prevAcc.length > 0
          ? Math.round(prevAcc.reduce((a, b) => a + b, 0) / prevAcc.length)
          : currentAccuracy;

        const improvement = previousAccuracy > 0
          ? Math.round(((currentAccuracy - previousAccuracy) / previousAccuracy) * 100)
          : 0;

        return {
          domain,
          currentAccuracy,
          previousAccuracy,
          improvement,
          trialCount: recentAcc.length
        };
      };

      const trends: DomainTrend[] = [];
      const motorTrend = calculateTrend('Motor', 'motor_accuracy');
      const speechTrend = calculateTrend('Speech', 'speech_accuracy');

      if (motorTrend) trends.push(motorTrend);
      if (speechTrend) trends.push(speechTrend);

      setDomainTrends(trends);
    } catch (err: any) {
      console.error('Error fetching patient progress:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return { progressData, domainTrends, isLoading, error, refetch: fetchProgressData };
};
