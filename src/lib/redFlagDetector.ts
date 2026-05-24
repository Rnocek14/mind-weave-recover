import { supabase } from '@/integrations/supabase/client';
import { ExerciseModality } from './exerciseSlugNormalizer';
import { pronunciationHealth } from './pipelineOpsClient';

export type RedFlagType = 
  | 'plateau' | 'regression' | 'low_adherence' | 'high_fatigue' | 'quit_early' | 'low_mood_streak'
  // New speech-specific flags
  | 'wpm_drop' | 'pause_burden_up' | 'effortful_spike' 
  // Micro-fluency flags (require alignment)
  | 'longest_pause_spike' | 'pre_word_pause_high' | 'intra_word_silence'
  // Pipeline flags
  | 'worker_offline' | 'queue_stuck' | 'high_failure_rate';

export type RedFlagSeverity = 'yellow' | 'orange' | 'red';

export interface RedFlag {
  type: RedFlagType;
  severity: RedFlagSeverity;
  message: string;
  details: string;
  detectedAt: string;
  sessionId?: string;
  evidence?: { n: number; window: string; change?: number };
}

// Minimum sample sizes for different checks
const MIN_SAMPLES = {
  speech_regression: 10,
  micro_fluency: 5,
  baseline: 10,
};

// Modalities that should be excluded from speech-related detection
const NON_SPEECH_MODALITIES: ExerciseModality[] = ['listening', 'motor'];

/**
 * Check if a session should be included in speech-related analytics
 */
const isSpeechSession = (session: { plan?: any }): boolean => {
  const plan = session.plan;
  if (!plan) return true; // If no plan, assume it's a speech session (legacy)
  
  const modality = plan.modality as ExerciseModality | undefined;
  if (!modality) return true; // If no modality specified, assume speech
  
  return !NON_SPEECH_MODALITIES.includes(modality);
};

/**
 * Detects if user has plateaued (no improvement for 14+ days)
 * Only considers speaking sessions
 */
export const detectPlateau = async (userId: string, profileId?: string): Promise<RedFlag | null> => {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  let q = supabase
    .from('sessions')
    .select('summary, plan')
    .eq('user_id', userId)
    .gte('started_at', fourteenDaysAgo.toISOString())
    .order('started_at', { ascending: true });
  if (profileId) q = q.eq('profile_id', profileId);
  const { data: sessions, error } = await q;

  if (error || !sessions || sessions.length < 5) {
    return null;
  }

  // Filter to only speech sessions
  const speechSessions = sessions.filter(isSpeechSession);
  
  if (speechSessions.length < 5) {
    return null;
  }

  const accuracies = speechSessions
    .map(s => (s.summary as any)?.accuracy)
    .filter(a => a !== undefined && a !== null) as number[];

  if (accuracies.length < 5) return null;

  const firstHalf = accuracies.slice(0, Math.floor(accuracies.length / 2));
  const secondHalf = accuracies.slice(Math.floor(accuracies.length / 2));

  const firstHalfAvg = firstHalf.reduce((sum, a) => sum + a, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, a) => sum + a, 0) / secondHalf.length;

  const improvement = secondHalfAvg - firstHalfAvg;

  if (improvement < 0.05 && improvement > -0.05) {
    return {
      type: 'plateau',
      severity: 'orange',
      message: 'No Progress Detected',
      details: `Accuracy has remained stable at ${Math.round(firstHalfAvg * 100)}% for 14+ days. Consider adjusting therapy approach or difficulty level.`,
      detectedAt: new Date().toISOString(),
      evidence: { n: accuracies.length, window: '14 days' }
    };
  }

  return null;
};

/**
 * Detects if user's performance is declining (regression)
 * Only considers speaking sessions
 */
export const detectRegression = async (userId: string, profileId?: string): Promise<RedFlag | null> => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  let baselineQ = supabase
    .from('sessions')
    .select('summary, plan')
    .eq('user_id', userId)
    .gte('started_at', thirtyDaysAgo.toISOString())
    .lt('started_at', sevenDaysAgo.toISOString());
  if (profileId) baselineQ = baselineQ.eq('profile_id', profileId);
  const { data: baselineSessions } = await baselineQ;

  let recentQ = supabase
    .from('sessions')
    .select('summary, plan')
    .eq('user_id', userId)
    .gte('started_at', sevenDaysAgo.toISOString());
  if (profileId) recentQ = recentQ.eq('profile_id', profileId);
  const { data: recentSessions } = await recentQ;

  if (!baselineSessions || !recentSessions) {
    return null;
  }

  // Filter to only speech sessions
  const speechBaseline = baselineSessions.filter(isSpeechSession);
  const speechRecent = recentSessions.filter(isSpeechSession);

  if (speechBaseline.length < 3 || speechRecent.length < 2) {
    return null;
  }

  const baselineAccuracies = speechBaseline
    .map(s => (s.summary as any)?.accuracy)
    .filter(a => a !== undefined && a !== null) as number[];

  const recentAccuracies = speechRecent
    .map(s => (s.summary as any)?.accuracy)
    .filter(a => a !== undefined && a !== null) as number[];

  if (baselineAccuracies.length === 0 || recentAccuracies.length === 0) return null;

  const baselineAvg = baselineAccuracies.reduce((sum, a) => sum + a, 0) / baselineAccuracies.length;
  const recentAvg = recentAccuracies.reduce((sum, a) => sum + a, 0) / recentAccuracies.length;

  const decline = baselineAvg - recentAvg;

  if (decline >= 0.15) {
    return {
      type: 'regression',
      severity: 'red',
      message: 'Performance Decline Detected',
      details: `Accuracy has dropped ${Math.round(decline * 100)}% from ${Math.round(baselineAvg * 100)}% to ${Math.round(recentAvg * 100)}%. Immediate review recommended.`,
      detectedAt: new Date().toISOString(),
      evidence: { n: recentAccuracies.length, window: '7 days vs prior 23 days', change: -decline * 100 }
    };
  }

  return null;
};

/**
 * Detects low adherence (fewer than 3 sessions per week)
 */
export const detectLowAdherence = async (userId: string, profileId?: string): Promise<RedFlag | null> => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  let q = supabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId)
    .gte('started_at', sevenDaysAgo.toISOString());
  if (profileId) q = q.eq('profile_id', profileId);
  const { data: sessions, error } = await q;

  if (error) return null;

  const sessionCount = sessions?.length || 0;

  if (sessionCount < 3) {
    return {
      type: 'low_adherence',
      severity: sessionCount === 0 ? 'red' : 'yellow',
      message: 'Low Practice Frequency',
      details: `Only ${sessionCount} session${sessionCount !== 1 ? 's' : ''} completed in the last 7 days. Recommended: 3+ sessions per week.`,
      detectedAt: new Date().toISOString(),
      evidence: { n: sessionCount, window: '7 days' }
    };
  }

  return null;
};

/**
 * Detects sessions with high fatigue or quit early
 */
export const detectHighFatigueOrQuit = async (userId: string, profileId?: string): Promise<RedFlag | null> => {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  let q = supabase
    .from('sessions')
    .select('id, engagement_summary, duration_sec, started_at')
    .eq('user_id', userId)
    .gte('started_at', threeDaysAgo.toISOString())
    .order('started_at', { ascending: false })
    .limit(5);
  if (profileId) q = q.eq('profile_id', profileId);
  const { data: sessions, error } = await q;

  if (error || !sessions || sessions.length === 0) return null;

  const highFatigueSessions = sessions.filter(s => {
    const summary = s.engagement_summary as any;
    return summary?.fatigue === 'high';
  });

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
      sessionId: highFatigueSessions[0].id,
      evidence: { n: sessions.length, window: '3 days' }
    };
  }

  if (quitEarlySessions.length >= 2) {
    return {
      type: 'quit_early',
      severity: 'orange',
      message: 'Sessions Ended Early',
      details: `${quitEarlySessions.length} of last ${sessions.length} sessions were quit early. User may be experiencing frustration or difficulty.`,
      detectedAt: new Date().toISOString(),
      sessionId: quitEarlySessions[0].id,
      evidence: { n: sessions.length, window: '3 days' }
    };
  }

  return null;
};

/**
 * Detects low mood streaks (3+ consecutive sessions with mood <= 2)
 */
export const detectLowMoodStreak = async (userId: string, profileId?: string): Promise<RedFlag | null> => {
  let q = supabase
    .from('sessions')
    .select('mood_rating, started_at')
    .eq('user_id', userId)
    .not('mood_rating', 'is', null)
    .order('started_at', { ascending: false })
    .limit(5);
  if (profileId) q = q.eq('profile_id', profileId);
  const { data: sessions, error } = await q;

  if (error || !sessions || sessions.length < 3) {
    return null;
  }

  const recentMoods = sessions.slice(0, 3).map(s => s.mood_rating);
  const lowMoodCount = recentMoods.filter(m => m !== null && m <= 2).length;

  if (lowMoodCount >= 3) {
    return {
      type: 'low_mood_streak',
      severity: 'orange',
      message: 'Persistent Low Mood Detected',
      details: `User has reported low mood (≤2) for ${lowMoodCount} consecutive sessions. Consider checking in with patient or caregiver about emotional well-being.`,
      detectedAt: new Date().toISOString(),
      evidence: { n: lowMoodCount, window: 'last 3 sessions' }
    };
  }

  return null;
};


/**
 * NEW: Detects speech fluency regression (WPM, pause burden, effortful rate)
 */
export const detectSpeechRegressions = async (userId: string, profileId?: string): Promise<RedFlag[]> => {
  const flags: RedFlag[] = [];
  const now = new Date();
  
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Resolve profile session scope (utterance_analyses has no profile_id)
  let sessionIds: string[] | null = null;
  if (profileId) {
    const { data: sessRows } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('profile_id', profileId)
      .gte('started_at', fourteenDaysAgo.toISOString());
    sessionIds = (sessRows || []).map((s) => s.id);
    if (sessionIds.length === 0) return flags;
  }

  // Get baseline (days 8-14)
  let baselineQ = supabase
    .from('utterance_analyses')
    .select('speech_rate_wpm, pause_count, avg_pause_duration_ms, effortful_speech')
    .eq('user_id', userId)
    .gte('created_at', fourteenDaysAgo.toISOString())
    .lt('created_at', sevenDaysAgo.toISOString())
    .not('speech_rate_wpm', 'is', null);
  if (sessionIds) baselineQ = baselineQ.in('session_id', sessionIds);
  const { data: baseline } = await baselineQ;

  // Get recent (last 7 days)
  let recentQ = supabase
    .from('utterance_analyses')
    .select('speech_rate_wpm, pause_count, avg_pause_duration_ms, effortful_speech')
    .eq('user_id', userId)
    .gte('created_at', sevenDaysAgo.toISOString())
    .not('speech_rate_wpm', 'is', null);
  if (sessionIds) recentQ = recentQ.in('session_id', sessionIds);
  const { data: recent } = await recentQ;


  if (!baseline || !recent || baseline.length < MIN_SAMPLES.speech_regression || recent.length < MIN_SAMPLES.speech_regression) {
    return flags;
  }

  // Calculate averages
  const baselineWpm = baseline.reduce((s, r) => s + (r.speech_rate_wpm || 0), 0) / baseline.length;
  const recentWpm = recent.reduce((s, r) => s + (r.speech_rate_wpm || 0), 0) / recent.length;
  const wpmChange = (recentWpm - baselineWpm) / baselineWpm;

  const baselinePauses = baseline.reduce((s, r) => s + (r.pause_count || 0), 0) / baseline.length;
  const recentPauses = recent.reduce((s, r) => s + (r.pause_count || 0), 0) / recent.length;
  const pauseChange = baselinePauses > 0 ? (recentPauses - baselinePauses) / baselinePauses : 0;

  const baselineEffortful = baseline.filter(r => r.effortful_speech === true).length / baseline.length;
  const recentEffortful = recent.filter(r => r.effortful_speech === true).length / recent.length;
  const effortfulChange = recentEffortful - baselineEffortful;

  // WPM drop ≥20%
  if (wpmChange <= -0.20) {
    flags.push({
      type: 'wpm_drop',
      severity: wpmChange <= -0.30 ? 'red' : 'orange',
      message: 'Speech Rate Decline',
      details: `Speaking rate dropped ${Math.round(Math.abs(wpmChange) * 100)}% (${Math.round(baselineWpm)} → ${Math.round(recentWpm)} WPM). Pattern consistent with increased word-finding difficulty.`,
      detectedAt: now.toISOString(),
      evidence: { n: recent.length, window: '7 days vs prior 7 days', change: wpmChange * 100 }
    });
  }

  // Pause burden up ≥30%
  if (pauseChange >= 0.30) {
    flags.push({
      type: 'pause_burden_up',
      severity: pauseChange >= 0.50 ? 'orange' : 'yellow',
      message: 'Increased Hesitations',
      details: `Pause frequency increased ${Math.round(pauseChange * 100)}%. Consider reviewing session timing or cognitive load.`,
      detectedAt: now.toISOString(),
      evidence: { n: recent.length, window: '7 days vs prior 7 days', change: pauseChange * 100 }
    });
  }

  // Effortful rate spike ≥25 percentage points
  if (effortfulChange >= 0.25) {
    flags.push({
      type: 'effortful_spike',
      severity: effortfulChange >= 0.40 ? 'orange' : 'yellow',
      message: 'Speech More Effortful',
      details: `Effortful speech rate increased from ${Math.round(baselineEffortful * 100)}% to ${Math.round(recentEffortful * 100)}%. Consider reducing session length or difficulty.`,
      detectedAt: now.toISOString(),
      evidence: { n: recent.length, window: '7 days vs prior 7 days', change: effortfulChange * 100 }
    });
  }

  return flags;
};

/**
 * NEW: Detects micro-fluency issues (requires alignment data)
 */
export const detectMicroFluencyFlags = async (userId: string, profileId?: string): Promise<RedFlag[]> => {
  const flags: RedFlag[] = [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let sessionIds: string[] | null = null;
  if (profileId) {
    const { data: sessRows } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('profile_id', profileId)
      .gte('started_at', sevenDaysAgo.toISOString());
    sessionIds = (sessRows || []).map((s) => s.id);
    if (sessionIds.length === 0) return flags;
  }

  // Get recent utterances with alignment
  let q = supabase
    .from('utterance_analyses')
    .select('alignment_data, gop_data')
    .eq('user_id', userId)
    .eq('analysis_status', 'complete')
    .gte('created_at', sevenDaysAgo.toISOString())
    .not('alignment_data', 'is', null);
  if (sessionIds) q = q.in('session_id', sessionIds);
  const { data: recent } = await q;


  if (!recent || recent.length < MIN_SAMPLES.micro_fluency) {
    return flags; // Not enough aligned data
  }

  // Extract micro-fluency from alignment
  let totalLongestPause = 0;
  let totalPreWordPause = 0;
  let intraWordCount = 0;
  let validCount = 0;

  for (const row of recent) {
    const align = row.alignment_data as any;
    if (!align?.word_segments) continue;
    
    validCount++;
    
    // Calculate longest pause
    let longestPause = 0;
    const words = align.word_segments || [];
    for (let i = 1; i < words.length; i++) {
      const gap = (words[i].start_time - words[i - 1].end_time) * 1000;
      if (gap > longestPause) longestPause = gap;
    }
    totalLongestPause += longestPause;
    
    // Pre-word pauses (gap before first word)
    if (words.length > 0 && words[0].start_time > 0) {
      totalPreWordPause += words[0].start_time * 1000;
    }
    
    // Intra-word pauses (from phone_segments)
    const phones = align.phone_segments || [];
    for (let i = 1; i < phones.length; i++) {
      const gap = (phones[i].start_time - phones[i - 1].end_time) * 1000;
      if (gap > 100) intraWordCount++; // >100ms gap within word
    }
  }

  if (validCount < MIN_SAMPLES.micro_fluency) return flags;

  const avgLongestPause = totalLongestPause / validCount;
  const avgPreWordPause = totalPreWordPause / validCount;

  // Pre-word pause p90 high: avg ≥ 800ms
  if (avgPreWordPause >= 800) {
    flags.push({
      type: 'pre_word_pause_high',
      severity: avgPreWordPause >= 1200 ? 'orange' : 'yellow',
      message: 'Extended Word-Finding Pauses',
      details: `Average pre-word pause ${Math.round(avgPreWordPause)}ms. Pattern consistent with lexical retrieval load. Consider semantic cueing strategies.`,
      detectedAt: now.toISOString(),
      evidence: { n: validCount, window: '7 days' }
    });
  }

  // Intra-word silence: count ≥ 2 in last 10 valid samples
  if (intraWordCount >= 2) {
    flags.push({
      type: 'intra_word_silence',
      severity: 'yellow',
      message: 'Intra-Word Pauses Detected',
      details: `${intraWordCount} intra-word silences detected. Review for possible motor planning difficulty (not diagnostic).`,
      detectedAt: now.toISOString(),
      evidence: { n: validCount, window: '7 days' }
    });
  }

  return flags;
};

/**
 * NEW: Detects pipeline health issues
 * Now checks Azure health endpoint directly instead of relying on database checks
 */
export const detectPipelineFlags = async (): Promise<RedFlag[]> => {
  const flags: RedFlag[] = [];
  const now = new Date();

  // Check Azure health via endpoint directly
  let azureConfigured = false;
  try {
    const health = await pronunciationHealth();
    azureConfigured = health.configured && health.hasKey && health.hasRegion;
  } catch (e) {
    console.warn('Azure health check failed:', e);
  }

  // Check worker heartbeat (fallback if Azure not configured)
  let heartbeatAge: number | null = null;
  if (!azureConfigured) {
    const { data: heartbeat } = await supabase
      .from('worker_heartbeats')
      .select('last_seen, status')
      .order('last_seen', { ascending: false })
      .limit(1);

    const lastHeartbeat = heartbeat?.[0];
    heartbeatAge = lastHeartbeat 
      ? (now.getTime() - new Date(lastHeartbeat.last_seen).getTime()) / 60000
      : null;
  }

  // Check queue status
  const { data: queueStats } = await supabase
    .from('utterance_analyses')
    .select('analysis_status, created_at, gop_data')
    .in('analysis_status', ['pending', 'processing', 'failed'])
    .gte('created_at', new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString());

  const pending = queueStats?.filter(r => r.analysis_status === 'pending') || [];
  const processing = queueStats?.filter(r => r.analysis_status === 'processing') || [];
  const failed = queueStats?.filter(r => r.analysis_status === 'failed') || [];

  // Only warn about RECENT pending jobs (< 2 hours old) that aren't being handled
  const recentPending = pending.filter(r => {
    const age = (now.getTime() - new Date(r.created_at!).getTime()) / 3600000; // hours
    return age < 2;
  });

  // Worker offline - only warn if Azure NOT configured AND no worker heartbeat
  // If Azure IS configured, the pipeline is considered healthy
  if (recentPending.length > 0 && !azureConfigured && (heartbeatAge === null || heartbeatAge > 5)) {
    flags.push({
      type: 'worker_offline',
      severity: 'red',
      message: 'Speech Worker Offline',
      details: `${recentPending.length} recent job(s) waiting but no worker heartbeat in ${heartbeatAge ? Math.round(heartbeatAge) + ' min' : 'unknown time'}. Configure Azure Pronunciation Assessment to process jobs.`,
      detectedAt: now.toISOString(),
      evidence: { n: recentPending.length, window: '2 hours' }
    });
  }

  // Queue stuck (processing > 10 min without progress)
  const stuckProcessing = processing.filter(r => {
    const age = (now.getTime() - new Date(r.created_at!).getTime()) / 60000;
    return age > 10;
  });
  
  if (stuckProcessing.length > 0) {
    flags.push({
      type: 'queue_stuck',
      severity: 'orange',
      message: 'Jobs Stuck in Queue',
      details: `${stuckProcessing.length} job(s) stuck in processing state. May need manual intervention.`,
      detectedAt: now.toISOString(),
      evidence: { n: stuckProcessing.length, window: 'current' }
    });
  }

  // High failure rate
  if (failed.length > 5) {
    flags.push({
      type: 'high_failure_rate',
      severity: 'orange',
      message: 'High Analysis Failure Rate',
      details: `${failed.length} failed analysis jobs in last 48 hours. Check pipeline logs.`,
      detectedAt: now.toISOString(),
      evidence: { n: failed.length, window: '48 hours' }
    });
  }

  return flags;
};

/**
 * Runs all red flag checks and returns all detected flags
 */
export const detectAllRedFlags = async (userId: string, profileId?: string): Promise<RedFlag[]> => {
  const [
    plateau,
    regression,
    lowAdherence,
    highFatigueOrQuit,
    lowMoodStreak,
    speechRegressions,
    microFluencyFlags,
    pipelineFlags
  ] = await Promise.all([
    detectPlateau(userId, profileId),
    detectRegression(userId, profileId),
    detectLowAdherence(userId, profileId),
    detectHighFatigueOrQuit(userId, profileId),
    detectLowMoodStreak(userId, profileId),
    detectSpeechRegressions(userId, profileId),
    detectMicroFluencyFlags(userId, profileId),

    detectPipelineFlags()
  ]);

  return [
    plateau, 
    regression, 
    lowAdherence, 
    highFatigueOrQuit, 
    lowMoodStreak,
    ...speechRegressions,
    ...microFluencyFlags,
    ...pipelineFlags
  ].filter((flag): flag is RedFlag => flag !== null);
};
