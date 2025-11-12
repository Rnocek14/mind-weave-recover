import { supabase } from '@/integrations/supabase/client';

export interface SessionPlan {
  blocks: Array<{
    exercise: string;
    duration: number;
  }>;
}

export interface SessionSummary {
  durationSec: number;
  scores: Record<string, number>;
  reps: number;
}

export const startSession = async (userId: string, plan: SessionPlan) => {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      plan: plan as any
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const trackRound = async (
  sessionId: string, 
  exerciseSlug: string, 
  round: number, 
  score: number,
  inputs?: any,
  outputs?: any
) => {
  const { error } = await supabase
    .from('exercise_events')
    .insert({
      session_id: sessionId,
      exercise_slug: exerciseSlug,
      round,
      score,
      inputs: inputs || {},
      outputs: outputs || { timestamp: new Date().toISOString() }
    });
  
  if (error) throw error;
};

export const endSession = async (sessionId: string, summary: SessionSummary) => {
  const { error } = await supabase
    .from('sessions')
    .update({
      ended_at: new Date().toISOString(),
      duration_sec: summary.durationSec,
      summary: summary as any
    })
    .eq('id', sessionId);
  
  if (error) throw error;
  
  // Check achievements after session
  const { data: session } = await supabase
    .from('sessions')
    .select('user_id')
    .eq('id', sessionId)
    .single();
    
  if (session) {
    await checkAchievements(session.user_id);
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

  // First session
  if (sessions.length === 1) {
    await awardAchievement(userId, 'first-session', 1);
  }

  // Get total reps
  const { data: events } = await supabase
    .from('exercise_events')
    .select('id')
    .in('session_id', sessions.map(s => s.id));
  
  if (events && events.length >= 50) {
    await awardAchievement(userId, '50-reps', events.length);
  }

  // Check for 3-day streak
  if (sessions.length >= 3) {
    const dates = sessions
      .map(s => new Date(s.ended_at!).toDateString())
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort();
    
    let streak = 1;
    for (let i = 1; i < dates.length; i++) {
      const diff = (new Date(dates[i]).getTime() - new Date(dates[i-1]).getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        streak++;
        if (streak >= 3) {
          await awardAchievement(userId, '3-day-streak', streak);
          break;
        }
      } else {
        streak = 1;
      }
    }
  }
};

export const awardAchievement = async (userId: string, type: string, value: number) => {
  // Using upsert with onConflict to make it idempotent
  const { error } = await supabase
    .from('achievements')
    .upsert(
      { user_id: userId, type, value, awarded_at: new Date().toISOString() },
      { onConflict: 'user_id,type', ignoreDuplicates: true }
    );
  
  if (error && !error.message.includes('duplicate')) {
    console.error('Achievement award error:', error);
  }
};
