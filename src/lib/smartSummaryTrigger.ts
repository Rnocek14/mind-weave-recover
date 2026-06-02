import { supabase } from '@/integrations/supabase/client';

const TRIAL_THRESHOLD = 20; // Regenerate after 20+ new trials

/**
 * Check if summary regeneration is needed and trigger it in the background
 * Called after session completion
 */
export const checkAndTriggerSummaryRegeneration = async (
  userId: string,
  profileId?: string | null,
) => {
  try {
    // Get all session IDs for this user (scoped to active profile)
    let sessionsQuery = supabase
      .from('sessions')
      .select('id')
      .eq('user_id', userId);
    if (profileId) sessionsQuery = sessionsQuery.eq('profile_id', profileId);
    const { data: sessions } = await sessionsQuery;

    if (!sessions || sessions.length === 0) return;

    const sessionIds = sessions.map(s => s.id);

    // Get current trial count
    const { count: currentTrialCount } = await supabase
      .from('exercise_events')
      .select('*', { count: 'exact', head: true })
      .in('session_id', sessionIds);

    if (!currentTrialCount) return;

    // Get latest summaries for both types (scoped to active profile)
    let summariesQuery = supabase
      .from('recovery_summaries')
      .select('summary_type, trial_count_at_generation, generated_at')
      .eq('user_id', userId);
    if (profileId) summariesQuery = summariesQuery.eq('profile_id', profileId);
    const { data: summaries } = await summariesQuery
      .order('generated_at', { ascending: false })
      .limit(2);

    const summaryTypes: ('progress' | 'education')[] = ['progress', 'education'];

    for (const summaryType of summaryTypes) {
      const latestSummary = summaries?.find(s => s.summary_type === summaryType);
      
      // Trigger regeneration if:
      // 1. No summary exists OR
      // 2. 20+ new trials since last generation
      const shouldRegenerate = !latestSummary || 
        (currentTrialCount - (latestSummary.trial_count_at_generation || 0) >= TRIAL_THRESHOLD);

      if (shouldRegenerate) {
        console.log(`Triggering background regeneration for ${summaryType} summary`);
        
        // Fire and forget - don't await
        supabase.functions
          .invoke('generate-recovery-summary', {
            body: {
              userId,
              profileId: profileId ?? null,
              summaryType,
              trialCount: currentTrialCount
            }
          })
          .then(() => {
            console.log(`${summaryType} summary regeneration completed`);
          })
          .catch(err => {
            console.error(`Error regenerating ${summaryType} summary:`, err);
          });
      }
    }
  } catch (error) {
    console.error('Error in checkAndTriggerSummaryRegeneration:', error);
    // Don't throw - this is a background task
  }
};
