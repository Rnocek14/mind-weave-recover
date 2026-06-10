import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { localYYYYMMDD } from '@/lib/localDate';
import { triggerPostSessionProfileRefresh } from '@/lib/postSessionProfileRefresh';
import { flushMasteryShadow } from '@/lib/mastery/flushMasteryShadow';
import { clearStandaloneSessionMutex } from '@/hooks/useStandaloneSession';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';
import { computeSessionAccuracySummary } from '@/lib/sessionAccuracySummary';

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
  /**
   * If true, the parent flow (e.g. LessonFlow / SmartCoach) owns the session
   * lifecycle. This hook will NOT write `ended_at` and will NOT replace
   * `summary`. It will only fire local callbacks and best-effort dose logging.
   * Auto-detected from sessionStorage when not explicitly provided.
   */
  ownedByParentFlow?: boolean;
}

/**
 * Detect whether the given sessionId is owned by a parent flow (LessonFlow
 * or SmartCoach). Used to prevent child exercises from prematurely closing
 * a multi-exercise session.
 */
const detectParentOwnership = (sessionId: string | null | undefined): boolean => {
  if (!sessionId) return false;
  try {
    const lessonRaw = sessionStorage.getItem('lessonFlowState');
    if (lessonRaw) {
      const parsed = JSON.parse(lessonRaw);
      if (parsed?.sessionId === sessionId) return true;
    }
    const coachRaw = sessionStorage.getItem('smartCoachState');
    if (coachRaw) {
      const parsed = JSON.parse(coachRaw);
      if (parsed?.sessionId === sessionId) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
};

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
  exerciseSlug: rawExerciseSlug,
  getSessionStats,
  onSessionEnded,
  visibilityTimeoutMs = 5 * 60 * 1000, // 5 minutes
  ownedByParentFlow,
}: SessionLifecycleOptions) => {
  // Normalize once — guarantees summary.scores keys, lastExerciseSlug, and
  // dose_logs.metadata.exercise_slug all use the canonical slug.
  const exerciseSlug = normalizeExerciseSlug(rawExerciseSlug);
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

        // Re-check ownership at the moment we end (sessionStorage may have updated)
        const isOwnedByParent = ownedByParentFlow ?? detectParentOwnership(sid);

        console.log(`[SessionLifecycle] Ending session`, {
          sessionId: sid,
          reason,
          durationSec,
          score: stats.score,
          trials: stats.totalTrials,
          exerciseSlug,
          ownedByParentFlow: isOwnedByParent,
        });

        let updateError: { message?: string } | null = null;

        // Canonical top-level accuracy (independent vs cue-assisted) computed
        // from the raw exercise_events for this session. Powers plateau /
        // regression detectors that read summary.accuracy.
        const acc = await computeSessionAccuracySummary(sid);
        const accFields = {
          ...(acc.accuracy != null ? { accuracy: acc.accuracy } : {}),
          independent_accuracy: acc.independent_accuracy,
          cue_assisted_accuracy: acc.cue_assisted_accuracy,
          scored_trials: acc.scored_trials,
        };

        if (isOwnedByParent) {
          // Parent flow (LessonFlow / SmartCoach) owns ended_at + ended_reason.
          // We must NOT close the session here, otherwise the next exercise
          // in the lesson will be orphaned. We also must NOT replace summary —
          // we merge our exercise stats into it so analytics keep mode/etc.
          const { data: existing } = await supabase
            .from('sessions')
            .select('summary')
            .eq('id', sid)
            .maybeSingle();

          const existingSummary = (existing?.summary as Record<string, any> | null) ?? {};
          const exerciseScores = (existingSummary.scores as Record<string, number> | undefined) ?? {};

          const mergedSummary = {
            ...existingSummary,
            scores: { ...exerciseScores, [exerciseSlug]: stats.score },
            // Track per-exercise reps without clobbering totals owned by parent
            lastExerciseReps: stats.totalTrials,
            lastExerciseDurationSec: durationSec,
            lastExerciseSlug: exerciseSlug,
            lastExerciseEndedAt: new Date().toISOString(),
            ...accFields,
          };

          const { error } = await supabase
            .from('sessions')
            .update({ summary: mergedSummary as any })
            .eq('id', sid)
            .is('ended_at', null);
          updateError = error;
        } else {
          // Standalone exercise — we own the session, close it.
          // Merge into existing summary so prior metadata (mode, etc.) survives.
          const { data: existing } = await supabase
            .from('sessions')
            .select('summary')
            .eq('id', sid)
            .maybeSingle();

          const existingSummary = (existing?.summary as Record<string, any> | null) ?? {};
          const existingScores = (existingSummary.scores as Record<string, number> | undefined) ?? {};

          const mergedSummary = {
            ...existingSummary,
            durationSec,
            scores: { ...existingScores, [exerciseSlug]: stats.score },
            reps: stats.totalTrials,
            ...accFields,
          };

          const { error } = await supabase
            .from('sessions')
            .update({
              ended_at: new Date().toISOString(),
              duration_sec: durationSec,
              summary: mergedSummary as any,
              ended_reason: reason,
            })
            .eq('id', sid)
            .is('ended_at', null);
          updateError = error;
        }

        if (updateError) {
          console.error(`[SessionLifecycle] Failed to end session:`, updateError);
          // Reset flag to allow retry, but only if it was a real failure
          if (!updateError.message?.includes('0 rows')) {
            endedRef.current = false;
          }
        } else {
          console.log(`[SessionLifecycle] Session ${isOwnedByParent ? 'sub-exercise recorded' : 'ended successfully'}: ${reason}`);
          // Release standalone-session mutex once the session is closed
          if (!isOwnedByParent) clearStandaloneSessionMutex();

          
          // Auto-populate speech dose into recovery spine
          if (durationSec > 0) {
            const speechMinutes = Math.round(durationSec / 60);
            if (speechMinutes > 0 && userRef.current && profileRef.current) {
              try {
                await (supabase as any)
                  .from('dose_logs')
                  .upsert({
                    user_id: userRef.current,
                    profile_id: profileRef.current,
                    domain_slug: 'speech',
                    log_date: localYYYYMMDD(),
                    dose_value: speechMinutes,
                    source: 'system',
                    session_id: sid,
                    metadata: {
                      exercise_slug: exerciseSlug,
                      trials: stats.totalTrials,
                      duration_sec: durationSec,
                    },
                  }, { onConflict: 'session_id' });
                console.log(`[SessionLifecycle] Speech dose logged: ${speechMinutes}min`);
              } catch (doseErr) {
                console.warn('[SessionLifecycle] Failed to log speech dose:', doseErr);
              }
            }
          }
          
          // Auto-trigger speech profile recompute (fire-and-forget)
          if (userRef.current && profileRef.current) {
            triggerPostSessionProfileRefresh(userRef.current, profileRef.current, sid)
              .catch(err => console.warn('[SessionLifecycle] Profile refresh failed:', err));

            // Shadow-mode mastery layer recompute (fire-and-forget; never blocks)
            flushMasteryShadow({ sessionId: sid, userId: userRef.current, profileId: profileRef.current })
              .catch(err => console.warn('[SessionLifecycle] Mastery flush failed:', err));
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
  }, [exerciseSlug, onSessionEnded, ownedByParentFlow]);
  
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
