import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

type EndedReason = 'completed' | 'abandoned' | 'pagehide' | 'visibility_timeout' | 'unmount' | 'manual';

interface SessionLifecycleOptions {
  /** Session ID to manage */
  sessionId: string | null | undefined;
  /** User ID for validation */
  userId: string | undefined;
  /** Profile ID for validation */
  profileId: string | undefined;
  /** Exercise slug for logging */
  exerciseSlug: string;
  /** Get current session stats for summary */
  getSessionStats: () => { score: number; totalTrials: number; startTime: number };
  /** Callback when session ends */
  onSessionEnded?: (reason: EndedReason) => void;
  /** Visibility hidden timeout (ms) before auto-ending - default 5 minutes */
  visibilityTimeoutMs?: number;
}

/**
 * Hook to manage session lifecycle with guaranteed cleanup.
 * Handles: unmount, pagehide, visibility change, and manual completion.
 * 
 * Key features:
 * - Idempotent: Safe to call end multiple times
 * - Race-safe: Uses pendingEndPromise to prevent concurrent end calls
 * - Captures context at mount time to prevent stale closures
 * - Works on iOS Safari (pagehide) and all browsers
 * - Relies on server-side sweeper for guaranteed cleanup
 */
export const useSessionLifecycle = ({
  sessionId,
  userId,
  profileId,
  exerciseSlug,
  getSessionStats,
  onSessionEnded,
  visibilityTimeoutMs = 5 * 60 * 1000, // 5 minutes
}: SessionLifecycleOptions) => {
  // Capture values at mount time to prevent stale closure issues
  const sessionRef = useRef<string | null>(null);
  const userRef = useRef<string | undefined>(undefined);
  const profileRef = useRef<string | undefined>(undefined);
  const endedRef = useRef(false);
  const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const getStatsRef = useRef(getSessionStats);
  
  // Race condition prevention: track pending end promise
  const pendingEndPromiseRef = useRef<Promise<void> | null>(null);
  
  // Update refs when values change
  useEffect(() => {
    sessionRef.current = sessionId ?? null;
    userRef.current = userId;
    profileRef.current = profileId;
    getStatsRef.current = getSessionStats;
  }, [sessionId, userId, profileId, getSessionStats]);
  
  /**
   * End session with reason tracking - idempotent and race-safe
   */
  const endSessionWithReason = useCallback(async (reason: EndedReason): Promise<void> => {
    const sid = sessionRef.current;
    
    // Guard: already ended or no session
    if (endedRef.current || !sid) {
      console.log(`[SessionLifecycle] Skip end - already ended: ${endedRef.current}, sessionId: ${sid}`);
      return;
    }
    
    // Race prevention: if end is already in progress, reuse the same promise
    if (pendingEndPromiseRef.current) {
      console.log(`[SessionLifecycle] End already in progress, waiting for existing promise`);
      return pendingEndPromiseRef.current;
    }
    
    // Create the end promise
    const endPromise = (async () => {
      // Mark as ended immediately to prevent new calls
      endedRef.current = true;
      
      try {
        const stats = getStatsRef.current();
        const durationSec = Math.floor((Date.now() - stats.startTime) / 1000);
        
        console.log(`[SessionLifecycle] Ending session`, {
          sessionId: sid,
          reason,
          durationSec,
          score: stats.score,
          trials: stats.totalTrials,
          exerciseSlug,
        });
        
        // Use direct update to include ended_reason
        const { error } = await supabase
          .from('sessions')
          .update({
            ended_at: new Date().toISOString(),
            duration_sec: durationSec,
            summary: {
              durationSec,
              scores: { [exerciseSlug]: stats.score },
              reps: stats.totalTrials,
            },
            ended_reason: reason,
          })
          .eq('id', sid)
          .is('ended_at', null); // Only update if not already ended (idempotent)
        
        if (error) {
          console.error(`[SessionLifecycle] Failed to end session:`, error);
          // Reset flag to allow retry, but only if it was a real failure
          if (!error.message?.includes('0 rows')) {
            endedRef.current = false;
          }
        } else {
          console.log(`[SessionLifecycle] Session ended successfully: ${reason}`);
          
          // Auto-populate speech dose into recovery spine
          if (durationSec > 0) {
            const speechMinutes = Math.round(durationSec / 60);
            if (speechMinutes > 0 && userRef.current && profileRef.current) {
              try {
                await (supabase as any)
                  .from('dose_logs')
                  .insert({
                    user_id: userRef.current,
                    profile_id: profileRef.current,
                    domain_slug: 'speech',
                    log_date: new Date().toISOString().slice(0, 10),
                    dose_value: speechMinutes,
                    source: 'system',
                    metadata: {
                      session_id: sid,
                      exercise_slug: exerciseSlug,
                      trials: stats.totalTrials,
                      duration_sec: durationSec,
                    },
                  });
                console.log(`[SessionLifecycle] Speech dose logged: ${speechMinutes}min`);
              } catch (doseErr) {
                console.warn('[SessionLifecycle] Failed to log speech dose:', doseErr);
              }
            }
          }
          
          onSessionEnded?.(reason);
        }
      } catch (err) {
        console.error(`[SessionLifecycle] Error ending session:`, err);
        endedRef.current = false;
      } finally {
        pendingEndPromiseRef.current = null;
      }
    })();
    
    pendingEndPromiseRef.current = endPromise;
    return endPromise;
  }, [exerciseSlug, onSessionEnded]);
  
  /**
   * Complete session normally (user finished all trials)
   */
  const completeSession = useCallback(async () => {
    await endSessionWithReason('completed');
  }, [endSessionWithReason]);
  
  /**
   * Manually end session (e.g., user clicks "Exit")
   */
  const abandonSession = useCallback(async () => {
    await endSessionWithReason('abandoned');
  }, [endSessionWithReason]);
  
  // Setup cleanup handlers on mount
  useEffect(() => {
    if (!sessionId) return;
    
    // Reset ended flag for new session
    endedRef.current = false;
    pendingEndPromiseRef.current = null;
    
    // Handle pagehide (works reliably on iOS Safari)
    // Note: This is best-effort. Server sweeper handles cases where this fails.
    const handlePageHide = () => {
      console.log('[SessionLifecycle] pagehide event');
      // Fire and forget - browser may kill us before this completes
      endSessionWithReason('pagehide');
    };
    
    // Handle visibility change (tab switch, minimize)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('[SessionLifecycle] Page hidden, starting timeout');
        // Start timer to end session if hidden too long
        visibilityTimerRef.current = setTimeout(() => {
          console.log('[SessionLifecycle] Visibility timeout reached');
          endSessionWithReason('visibility_timeout');
        }, visibilityTimeoutMs);
      } else {
        // Page visible again, clear timer
        if (visibilityTimerRef.current) {
          console.log('[SessionLifecycle] Page visible, clearing timeout');
          clearTimeout(visibilityTimerRef.current);
          visibilityTimerRef.current = null;
        }
      }
    };
    
    // Add event listeners
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup on unmount
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (visibilityTimerRef.current) {
        clearTimeout(visibilityTimerRef.current);
      }
      
      // End session on unmount if not already ended
      // This is also best-effort - server sweeper handles failures
      if (!endedRef.current && sessionRef.current) {
        console.log('[SessionLifecycle] Unmount cleanup');
        endSessionWithReason('unmount');
      }
    };
  }, [sessionId, endSessionWithReason, visibilityTimeoutMs]);
  
  return {
    /** Call when user completes all trials */
    completeSession,
    /** Call when user explicitly exits/abandons */
    abandonSession,
    /** Check if session has been ended */
    isEnded: () => endedRef.current,
    /** Force end with custom reason */
    endWithReason: endSessionWithReason,
  };
};
