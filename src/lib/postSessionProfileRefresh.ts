/**
 * Post-Session Profile Refresh
 * 
 * Automatically triggers speech profile recomputation after session completion.
 * This closes the critical gap where profiles become stale because recompute
 * was only triggered manually or from PhotoNaming.
 * 
 * Design:
 * - Fire-and-forget: never blocks session end UX
 * - Respects server-side debounce (force: false)
 * - Logs outcome for observability
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Trigger speech profile recomputation after a session ends.
 * Non-blocking, safe to call from cleanup paths.
 */
export async function triggerPostSessionProfileRefresh(
  userId: string,
  profileId: string,
  sessionId: string,
): Promise<void> {
  console.log('[PostSessionRefresh] Triggering speech profile recompute', {
    userId: userId.slice(0, 8),
    profileId: profileId.slice(0, 8),
    sessionId: sessionId.slice(0, 8),
  });

  const { data, error } = await supabase.functions.invoke('compute-speech-profile', {
    body: {
      user_id: userId,
      profile_id: profileId,
      force: false, // Respect server-side debounce (won't recompute if <N minutes since last)
      trigger_source: 'post_session',
      session_id: sessionId,
    },
  });

  if (error) {
    console.warn('[PostSessionRefresh] Edge function error:', error.message);
    return;
  }

  if (data?.skipped) {
    console.log('[PostSessionRefresh] Skipped (debounced):', data.reason);
  } else if (data?.success) {
    console.log('[PostSessionRefresh] Profile recomputed successfully', {
      analysesProcessed: data.analysesProcessed,
      newTrials: data.newTrials,
    });
  }
}
