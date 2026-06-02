import { supabase } from '@/integrations/supabase/client';

export interface LearningRateResult {
  userId: string;
  profileId?: string | null;
  domain: string;
  timeWindowDays: number;
  accuracySlope: number;
  rtSlope: number;
  trialCount: number;
  startAccuracy: number;
  endAccuracy: number;
  startDate: string;
  endDate: string;
  confidenceScore: number;
}

/**
 * Calculates learning rate (improvement velocity) for a user in a specific domain
 * Uses linear regression to compute daily improvement slope
 */
export const calculateLearningRate = async (
  userId: string,
  domain: string,
  windowDays: number
): Promise<LearningRateResult | null> => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - windowDays);

  // First get session IDs for this user in the time window
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId)
    .gte('started_at', startDate.toISOString())
    .lte('started_at', endDate.toISOString());

  if (!sessions || sessions.length === 0) {
    return null;
  }

  const sessionIds = sessions.map(s => s.id);

  // Fetch all exercise events for this domain in the time window
  const { data: events, error } = await supabase
    .from('exercise_events')
    .select('score, reaction_time_ms, created_at, session_id')
    .in('session_id', sessionIds)
    .eq('exercise_slug', getDomainExerciseSlug(domain))
    .not('reaction_time_ms', 'is', null)
    .order('created_at', { ascending: true });

  if (error || !events || events.length < 10) {
    // Need minimum 10 trials for meaningful regression
    return null;
  }

  // Group by day and calculate daily accuracy
  const dailyData = groupByDay(events);
  
  if (dailyData.length < 3) {
    // Need at least 3 days of data
    return null;
  }

  // Linear regression: accuracy ~ day
  const accuracySlope = linearRegression(
    dailyData.map(d => d.dayIndex),
    dailyData.map(d => d.accuracy)
  );

  // Linear regression: reaction time ~ day
  const rtSlope = linearRegression(
    dailyData.map(d => d.dayIndex),
    dailyData.map(d => d.avgReactionTime)
  );

  // Calculate confidence based on sample size and R²
  const confidenceScore = calculateConfidence(events.length, dailyData.length);

  return {
    userId,
    domain,
    timeWindowDays: windowDays,
    accuracySlope,
    rtSlope,
    trialCount: events.length,
    startAccuracy: dailyData[0].accuracy,
    endAccuracy: dailyData[dailyData.length - 1].accuracy,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    confidenceScore
  };
};

/**
 * Save calculated learning rate to database
 */
export const saveLearningRate = async (result: LearningRateResult): Promise<void> => {
  const { error } = await supabase
    .from('learning_rates')
    .upsert({
      user_id: result.userId,
      domain: result.domain,
      time_window_days: result.timeWindowDays,
      accuracy_slope: result.accuracySlope,
      rt_slope: result.rtSlope,
      trial_count: result.trialCount,
      start_accuracy: result.startAccuracy,
      end_accuracy: result.endAccuracy,
      start_date: result.startDate,
      end_date: result.endDate,
      confidence_score: result.confidenceScore,
      calculated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,domain,time_window_days,end_date'
    });

  if (error) {
    console.error('Error saving learning rate:', error);
    throw error;
  }
};

/**
 * Calculate learning rates for all domains and all time windows for a user
 * Calls the edge function to perform the calculation
 */
export const calculateAllLearningRates = async (userId: string, profileId?: string | null): Promise<void> => {
  const { data, error } = await supabase.functions.invoke('calculate-learning-rates', {
    body: profileId ? { userId, profileId } : { userId }
  });

  if (error) {
    console.error('Error calculating learning rates:', error);
    throw error;
  }

  console.log('Learning rates calculated:', data);
};

// Helper functions

function getDomainExerciseSlug(domain: string): string {
  const mapping: Record<string, string> = {
    'phonological': 'phonological-game',
    'semantic': 'semantic-feature-game',
    'grammar': 'sentence-construction',
    'motor': 'reach-tap',
    'visuospatial': 'left-side-hunt'
  };
  return mapping[domain] || 'photo-naming';
}

interface DailyDataPoint {
  dayIndex: number;
  date: string;
  accuracy: number;
  avgReactionTime: number;
  trialCount: number;
}

function groupByDay(events: any[]): DailyDataPoint[] {
  const dayMap = new Map<string, { correct: number; total: number; rtSum: number; rtCount: number }>();

  events.forEach(event => {
    const date = event.created_at.split('T')[0];
    const existing = dayMap.get(date) || { correct: 0, total: 0, rtSum: 0, rtCount: 0 };
    
    existing.total += 1;
    if (event.score > 0) existing.correct += 1;
    if (event.reaction_time_ms) {
      existing.rtSum += event.reaction_time_ms;
      existing.rtCount += 1;
    }
    
    dayMap.set(date, existing);
  });

  const sortedDays = Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data], index) => ({
      dayIndex: index,
      date,
      accuracy: data.total > 0 ? data.correct / data.total : 0,
      avgReactionTime: data.rtCount > 0 ? data.rtSum / data.rtCount : 0,
      trialCount: data.total
    }));

  return sortedDays;
}

/**
 * Simple linear regression: returns slope
 */
function linearRegression(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  return isNaN(slope) ? 0 : slope;
}

/**
 * Calculate confidence score based on sample size
 */
function calculateConfidence(trialCount: number, dayCount: number): number {
  // More trials and more days = higher confidence
  const trialScore = Math.min(1, trialCount / 50); // Max at 50 trials
  const dayScore = Math.min(1, dayCount / 7); // Max at 7 days
  
  return Math.round((trialScore * 0.6 + dayScore * 0.4) * 100) / 100;
}
