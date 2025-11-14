import { supabase } from '@/integrations/supabase/client';

export type RedFlagType = 'plateau' | 'regression' | 'low_adherence' | 'high_fatigue' | 'quit_early';
export type RedFlagSeverity = 'yellow' | 'orange' | 'red';

export interface RedFlag {
  type: RedFlagType;
  severity: RedFlagSeverity;
  message: string;
  details: string;
  detectedAt: string;
  sessionId?: string;
}

/**
 * Detects if user has plateaued (no improvement for 14+ days)
 */
export const detectPlateau = async (userId: string): Promise<RedFlag | null> => {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('summary')
    .eq('user_id', userId)
    .gte('started_at', fourteenDaysAgo.toISOString())
    .order('started_at', { ascending: true });

  if (error || !sessions || sessions.length < 5) {
    return null; // Need at least 5 sessions to detect plateau
  }

  // Calculate accuracy trend
  const accuracies = sessions
    .map(s => (s.summary as any)?.accuracy)
    .filter(a => a !== undefined && a !== null) as number[];

  if (accuracies.length < 5) return null;

  const firstHalf = accuracies.slice(0, Math.floor(accuracies.length / 2));
  const secondHalf = accuracies.slice(Math.floor(accuracies.length / 2));

  const firstHalfAvg = firstHalf.reduce((sum, a) => sum + a, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, a) => sum + a, 0) / secondHalf.length;

  const improvement = secondHalfAvg - firstHalfAvg;

  // Plateau if improvement is less than 5% over 14 days
  if (improvement < 0.05 && improvement > -0.05) {
    return {
      type: 'plateau',
      severity: 'orange',
      message: 'No Progress Detected',
      details: `Accuracy has remained stable at ${Math.round(firstHalfAvg * 100)}% for 14+ days. Consider adjusting therapy approach or difficulty level.`,
      detectedAt: new Date().toISOString()
    };
  }

  return null;
};

/**
 * Detects if user's performance is declining (regression)
 */
export const detectRegression = async (userId: string): Promise<RedFlag | null> => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get 30-day baseline
  const { data: baselineSessions } = await supabase
    .from('sessions')
    .select('summary')
    .eq('user_id', userId)
    .gte('started_at', thirtyDaysAgo.toISOString())
    .lt('started_at', sevenDaysAgo.toISOString());

  // Get last 7 days
  const { data: recentSessions } = await supabase
    .from('sessions')
    .select('summary')
    .eq('user_id', userId)
    .gte('started_at', sevenDaysAgo.toISOString());

  if (!baselineSessions || !recentSessions || baselineSessions.length < 3 || recentSessions.length < 2) {
    return null; // Need sufficient data
  }

  const baselineAccuracies = baselineSessions
    .map(s => (s.summary as any)?.accuracy)
    .filter(a => a !== undefined && a !== null) as number[];

  const recentAccuracies = recentSessions
    .map(s => (s.summary as any)?.accuracy)
    .filter(a => a !== undefined && a !== null) as number[];

  if (baselineAccuracies.length === 0 || recentAccuracies.length === 0) return null;

  const baselineAvg = baselineAccuracies.reduce((sum, a) => sum + a, 0) / baselineAccuracies.length;
  const recentAvg = recentAccuracies.reduce((sum, a) => sum + a, 0) / recentAccuracies.length;

  const decline = baselineAvg - recentAvg;

  // Regression if accuracy dropped by 15% or more
  if (decline >= 0.15) {
    return {
      type: 'regression',
      severity: 'red',
      message: 'Performance Decline Detected',
      details: `Accuracy has dropped ${Math.round(decline * 100)}% from ${Math.round(baselineAvg * 100)}% to ${Math.round(recentAvg * 100)}%. Immediate review recommended.`,
      detectedAt: new Date().toISOString()
    };
  }

  return null;
};

/**
 * Detects low adherence (fewer than 3 sessions per week)
 */
export const detectLowAdherence = async (userId: string): Promise<RedFlag | null> => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId)
    .gte('started_at', sevenDaysAgo.toISOString());

  if (error) return null;

  const sessionCount = sessions?.length || 0;

  if (sessionCount < 3) {
    return {
      type: 'low_adherence',
      severity: sessionCount === 0 ? 'red' : 'yellow',
      message: 'Low Practice Frequency',
      details: `Only ${sessionCount} session${sessionCount !== 1 ? 's' : ''} completed in the last 7 days. Recommended: 3+ sessions per week.`,
      detectedAt: new Date().toISOString()
    };
  }

  return null;
};

/**
 * Detects sessions with high fatigue or quit early
 */
export const detectHighFatigueOrQuit = async (userId: string): Promise<RedFlag | null> => {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, engagement_summary, duration_sec, started_at')
    .eq('user_id', userId)
    .gte('started_at', threeDaysAgo.toISOString())
    .order('started_at', { ascending: false })
    .limit(5);

  if (error || !sessions || sessions.length === 0) return null;

  // Check for high fatigue in recent sessions
  const highFatigueSessions = sessions.filter(s => {
    const summary = s.engagement_summary as any;
    return summary?.fatigue === 'high';
  });

  // Check for sessions quit early (< 5 minutes)
  const quitEarlySessions = sessions.filter(s => 
    s.duration_sec && s.duration_sec < 300
  );

  if (highFatigueSessions.length >= 2) {
    return {
      type: 'high_fatigue',
      severity: 'orange',
      message: 'Persistent High Fatigue',
      details: `${highFatigueSessions.length} of last ${sessions.length} sessions showed high fatigue. Consider shorter sessions or more breaks.`,
      detectedAt: new Date().toISOString(),
      sessionId: highFatigueSessions[0].id
    };
  }

  if (quitEarlySessions.length >= 2) {
    return {
      type: 'quit_early',
      severity: 'orange',
      message: 'Sessions Ended Early',
      details: `${quitEarlySessions.length} of last ${sessions.length} sessions were quit early. User may be experiencing frustration or difficulty.`,
      detectedAt: new Date().toISOString(),
      sessionId: quitEarlySessions[0].id
    };
  }

  return null;
};

/**
 * Runs all red flag checks and returns all detected flags
 */
export const detectAllRedFlags = async (userId: string): Promise<RedFlag[]> => {
  const [
    plateau,
    regression,
    lowAdherence,
    highFatigueOrQuit
  ] = await Promise.all([
    detectPlateau(userId),
    detectRegression(userId),
    detectLowAdherence(userId),
    detectHighFatigueOrQuit(userId)
  ]);

  return [plateau, regression, lowAdherence, highFatigueOrQuit]
    .filter((flag): flag is RedFlag => flag !== null);
};
