import { supabase } from '@/integrations/supabase/client';
import { ExerciseModality, normalizeExerciseSlug } from './exerciseSlugNormalizer';
import { trackEvent, FUNNEL_EVENTS } from './appEvents';

export interface SessionPlan {
  blocks: Array<{
    exercise: string;
    duration: number;
  }>;
  // Optional metadata for filtering
  modality?: ExerciseModality;
}

export interface SessionSummary {
  durationSec: number;
  scores: Record<string, number>;
  reps: number;
}

export interface StartSessionOptions {
  profileId?: string;
  /** Exercise modality - used to filter sessions for analytics */
  modality?: ExerciseModality;
}

export const startSession = async (
  userId: string, 
  plan: SessionPlan, 
  options?: StartSessionOptions | string // string for backward compatibility (profileId)
) => {
  // Handle backward compatibility - string means it's profileId
  const opts: StartSessionOptions = typeof options === 'string' 
    ? { profileId: options } 
    : options || {};
  
  // Get active profile if not provided
  let actualProfileId = opts.profileId;
  if (!actualProfileId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();
    
    actualProfileId = profile?.id;
  }
  
  // Store modality in plan for later filtering
  const planWithModality = {
    ...plan,
    modality: opts.modality || plan.modality
  };
  
  // Retry with backoff — a transient network blip at session start must not
  // silently drop the whole session (which would leave the game running with
  // no session id, so every trial goes unlogged).
  let data: any = null;
  let error: any = null;
  const backoffMs = [0, 800, 1800, 4000];
  for (let attempt = 0; attempt < backoffMs.length; attempt++) {
    if (backoffMs[attempt] > 0) {
      await new Promise((r) => setTimeout(r, backoffMs[attempt]));
    }
    ({ data, error } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        profile_id: actualProfileId,
        plan: planWithModality as any
      })
      .select()
      .single());
    if (!error) break;
    console.warn(`⚠️ Session create failed (attempt ${attempt + 1}/${backoffMs.length}):`, error?.message);
  }

  if (error) {
    console.error('❌ Failed to create session after retries:', error);
    throw error;
  }
  
  console.log('✅ Session created:', data.id, 'profile:', actualProfileId, 'modality:', opts.modality);
  // Funnel: every session start flows through here or useStandaloneSession
  // (which also calls this). One chokepoint = one consistent event.
  trackEvent(FUNNEL_EVENTS.SESSION_STARTED, {
    session_id: data.id,
    block_count: Array.isArray((planWithModality as any)?.blocks)
      ? (planWithModality as any).blocks.length
      : null,
  });
  return data;
};

/**
 * Track a round/trial in an exercise session.
 * IMPORTANT: exerciseSlug is normalized before writing to ensure consistency.
 */
export const trackRound = async (
  sessionId: string, 
  exerciseSlug: string, 
  round: number, 
  score: number,
  inputs?: any,
  outputs?: any
) => {
  // Normalize slug at write boundary
  const normalizedSlug = normalizeExerciseSlug(exerciseSlug);
  
  const { error } = await supabase
    .from('exercise_events')
    .insert({
      session_id: sessionId,
      exercise_slug: normalizedSlug,
      round,
      score,
      inputs: inputs || {},
      outputs: outputs || { timestamp: new Date().toISOString() }
    });
  
  if (error) throw error;
};

export const endSession = async (
  sessionId: string,
  summary: SessionSummary,
  reason: 'completed' | 'abandoned' | 'skipped' | 'manual' = 'completed'
) => {
  // Preserve any mode/metadata that was stamped at session creation time
  // (e.g. 'lesson' from LessonFlow, 'standalone' from useStandaloneSession,
  // 'smart_coach' from SmartCoach). Without merging, the final UPDATE would
  // wipe these flags and analytics could no longer distinguish session types.
  const { data: existing } = await supabase
    .from('sessions')
    .select('summary')
    .eq('id', sessionId)
    .maybeSingle();

  const existingSummary = (existing?.summary as Record<string, any> | null) ?? {};

  // Stamp canonical top-level accuracy fields so plateau/regression detectors
  // (which read summary.accuracy) actually receive a value. Computed from the
  // raw exercise_events ground truth, split into independent vs cue-assisted.
  const { computeSessionAccuracySummary, accuracySummaryToSummaryFields } = await import('./sessionAccuracySummary');
  const acc = await computeSessionAccuracySummary(sessionId);

  const mergedSummary = {
    ...existingSummary,
    ...summary,
    ...accuracySummaryToSummaryFields(acc),
  };

  // Idempotent: only set ended_at + ended_reason if not already ended.
  // This prevents overwriting a server-side sweeper close or a prior call.
  const { error } = await supabase
    .from('sessions')
    .update({
      ended_at: new Date().toISOString(),
      duration_sec: summary.durationSec,
      summary: mergedSummary as any,
      ended_reason: reason,
    })
    .eq('id', sessionId)
    .is('ended_at', null);
  
  if (error) throw error;

  if (reason === 'completed') {
    trackEvent(FUNNEL_EVENTS.SESSION_COMPLETED, {
      session_id: sessionId,
      duration_sec: summary.durationSec ?? null,
    });
  }

  // Get user_id for post-session tasks
  const { data: session } = await supabase
    .from('sessions')
    .select('user_id, profile_id')
    .eq('id', sessionId)
    .single();
    
  if (session) {
    // Import here to avoid circular dependencies
    const { checkAndTriggerSummaryRegeneration } = await import('./smartSummaryTrigger');
    
    // Check achievements
    await checkAchievements(session.user_id);
    
    // Trigger learning rate calculation in background (don't await)
    supabase.functions.invoke('calculate-learning-rates', {
      body: { userId: session.user_id, profileId: session.profile_id }
    }).then(() => {
      console.log('Learning rates calculation triggered for user:', session.user_id);
    }).catch(err => {
      console.error('Error triggering learning rate calculation:', err);
    });
    
    // Trigger smart summary regeneration in background (don't await)
    checkAndTriggerSummaryRegeneration(session.user_id, session.profile_id).catch(err => {
      console.error('Error checking summary regeneration:', err);
    });
  }
};

export const checkAchievements = async (userId: string) => {
  // Get all sessions
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, ended_at')
    .eq('user_id', userId)
    .not('ended_at', 'is', null);
  
  if (!sessions) return;

  // Achievement types MUST match ACHIEVEMENT_DEFS in useAchievements.ts —
  // AchievementBadges only renders defs whose type equals an earned row, so a
  // mismatched taxonomy leaves the badge wall permanently empty. Award the
  // session- and streak-milestone types the UI actually displays.
  const sessionCount = sessions.length;
  const SESSION_TIERS: Array<[number, string]> = [
    [5, 'sessions_5'], [25, 'sessions_25'], [50, 'sessions_50'], [100, 'sessions_100'],
  ];
  for (const [threshold, type] of SESSION_TIERS) {
    if (sessionCount >= threshold) await awardAchievement(userId, type, sessionCount);
  }

  // Longest consecutive-day streak across all completed sessions.
  const dates = sessions
    .map(s => new Date(s.ended_at!).toDateString())
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort();
  let maxStreak = dates.length > 0 ? 1 : 0;
  let streak = maxStreak;
  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / (1000 * 60 * 60 * 24);
    streak = diff === 1 ? streak + 1 : 1;
    if (streak > maxStreak) maxStreak = streak;
  }
  const STREAK_TIERS: Array<[number, string]> = [
    [3, 'streak_3'], [7, 'streak_7'], [14, 'streak_14'], [30, 'streak_30'],
  ];
  for (const [threshold, type] of STREAK_TIERS) {
    if (maxStreak >= threshold) await awardAchievement(userId, type, maxStreak);
  }
};

export const awardAchievement = async (userId: string, type: string, value: number) => {
  // Must include profile_id for RLS policy
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (!profile) {
    console.error('Cannot award achievement: no active profile found');
    return;
  }

  const { error } = await supabase
    .from('achievements')
    .upsert(
      // Conflict target must match the existing unique index
      // achievements_profile_id_type_key (profile_id, type). The previous
      // 'user_id,type' target had no matching constraint -> Postgres 42P10.
      { user_id: userId, profile_id: profile.id, type, value, awarded_at: new Date().toISOString() },
      { onConflict: 'profile_id,type', ignoreDuplicates: true }
    );
  
  if (error && !error.message.includes('duplicate')) {
    console.error('Achievement award error:', error);
  }
};
