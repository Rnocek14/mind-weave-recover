import { useState, useEffect, useRef } from 'react';
import { startSession } from '@/lib/sessionTracking';
import { useProfile } from '@/hooks/useProfile';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';

/** sessionStorage mutex preventing duplicate standalone session creation
 *  during React 18 double-invoked effects or mobile re-hydration races. */
const STANDALONE_MUTEX_KEY = 'standaloneSessionMutex';
const STANDALONE_MUTEX_TTL_MS = 30_000;

interface MutexEntry {
  exerciseSlug: string;
  createdAt: number;
  sessionId?: string;
}

function readMutex(): MutexEntry | null {
  try {
    const raw = sessionStorage.getItem(STANDALONE_MUTEX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MutexEntry;
    if (!parsed?.createdAt) return null;
    if (!parsed.sessionId && Date.now() - parsed.createdAt > STANDALONE_MUTEX_TTL_MS) {
      sessionStorage.removeItem(STANDALONE_MUTEX_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}
function writeMutex(entry: MutexEntry) {
  try { sessionStorage.setItem(STANDALONE_MUTEX_KEY, JSON.stringify(entry)); } catch { /* ignore */ }
}
function clearStandaloneSessionMutex() {
  try { sessionStorage.removeItem(STANDALONE_MUTEX_KEY); } catch { /* ignore */ }
}
export { clearStandaloneSessionMutex };

interface UseStandaloneSessionOptions {
  /**
   * If true, the hook will NOT create a session even when providedSessionId is null.
   * Use this when the exercise is part of a lesson/coaching flow that owns its own
   * session lifecycle but route state may temporarily be missing (e.g. on remount).
   */
  disabled?: boolean;
  /**
   * Mode to stamp on the created session's plan/summary. Defaults to 'standalone'.
   */
  mode?: 'standalone' | 'lesson' | 'smart_coach';
}

/**
 * Hook to auto-create a session for standalone game usage.
 *
 * IMPORTANT: To prevent duplicate sessions during lesson/coach flow, this hook
 *  - skips creation if `providedSessionId` is set, AND
 *  - skips creation if `disabled` is true (caller signals lesson context), AND
 *  - skips creation if `lessonFlowState` or `smartCoachState` exist in sessionStorage
 *    (defensive guard for race conditions where route state hasn't propagated yet).
 */
export const useStandaloneSession = (
  userId: string | undefined,
  providedSessionId: string | null | undefined,
  rawExerciseSlug: string,
  options: UseStandaloneSessionOptions = {}
) => {
  // Single normalization at the write boundary — every downstream read
  // (sessions.plan.blocks[].exercise, mutex, logs) gets the canonical slug.
  const exerciseSlug = normalizeExerciseSlug(rawExerciseSlug);
  const [localSessionId, setLocalSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const inFlightRef = useRef(false); // synchronous guard against double-invoked effects
  const { activeProfile } = useProfile();

  const { disabled = false, mode = 'standalone' } = options;

  // Defensive: detect an in-flight lesson/coach session via sessionStorage.
  const hasOwnedSessionContext = (): boolean => {
    try {
      const lessonRaw = sessionStorage.getItem('lessonFlowState');
      if (lessonRaw) {
        const parsed = JSON.parse(lessonRaw);
        if (parsed?.sessionId) return true;
      }
      const coachRaw = sessionStorage.getItem('smartCoachState');
      if (coachRaw) {
        const parsed = JSON.parse(coachRaw);
        if (parsed?.sessionId) return true;
      }
    } catch { /* ignore */ }
    return false;
  };

  const activeSessionId = providedSessionId || localSessionId;

  useEffect(() => {
    if (providedSessionId || localSessionId || isCreatingSession) return;
    if (inFlightRef.current) return;
    if (!userId || !activeProfile?.id) return;
    if (disabled) {
      console.log('[useStandaloneSession] skipped: disabled by caller (lesson/coach flow)', { exerciseSlug });
      return;
    }
    if (hasOwnedSessionContext()) {
      console.log('[useStandaloneSession] skipped: lessonFlowState/smartCoachState present in sessionStorage', { exerciseSlug });
      return;
    }

    // sessionStorage mutex — survives React 18 double-effect AND remounts
    const existingMutex = readMutex();
    if (existingMutex) {
      if (existingMutex.sessionId) {
        console.log('[useStandaloneSession] reusing session from mutex:', existingMutex.sessionId);
        setLocalSessionId(existingMutex.sessionId);
        return;
      }
      // Acquisition in flight elsewhere — wait, then check again
      console.log('[useStandaloneSession] mutex held by concurrent acquisition, waiting…');
      const waitId = setTimeout(() => {
        const refreshed = readMutex();
        if (refreshed?.sessionId && !localSessionId) setLocalSessionId(refreshed.sessionId);
      }, 250);
      return () => clearTimeout(waitId);
    }

    // Acquire mutex BEFORE async work
    inFlightRef.current = true;
    writeMutex({ exerciseSlug, createdAt: Date.now() });
    setIsCreatingSession(true);
    console.log('📝 Creating standalone session for', exerciseSlug, 'profile:', activeProfile.id, 'mode:', mode);

    startSession(
      userId,
      { blocks: [{ exercise: exerciseSlug, duration: 10 }] },
      { profileId: activeProfile.id }
    )
      .then(async (session) => {
        if (!session?.id) {
          console.warn('⚠️ [useStandaloneSession] startSession returned no session');
          clearStandaloneSessionMutex();
          return;
        }
        setLocalSessionId(session.id);
        writeMutex({ exerciseSlug, createdAt: Date.now(), sessionId: session.id });

        try {
          const { supabase } = await import('@/integrations/supabase/client');
          await supabase
            .from('sessions')
            .update({ summary: { mode } as any })
            .eq('id', session.id)
            .is('ended_at', null);
        } catch (err) {
          console.warn('[useStandaloneSession] failed to stamp summary.mode:', err);
        }

        console.log('✅ [useStandaloneSession] Session created:', {
          sessionId: session.id, profileId: activeProfile?.id, exerciseSlug, mode,
        });
      })
      .catch((error) => {
        console.error('❌ [useStandaloneSession] Failed to create session:', { error, exerciseSlug });
        clearStandaloneSessionMutex();
      })
      .finally(() => {
        setIsCreatingSession(false);
        inFlightRef.current = false;
      });
  }, [providedSessionId, userId, activeProfile?.id, localSessionId, isCreatingSession, exerciseSlug, disabled, mode]);

  // On unmount, if we created the session, leave the mutex in place briefly
  // so a remount within the same exercise reuses it; the TTL will clean it up.
  useEffect(() => {
    return () => {
      const current = readMutex();
      // Only clear if mutex belongs to us AND no sessionId resolved (acquisition aborted)
      if (current && current.exerciseSlug === exerciseSlug && !current.sessionId) {
        clearStandaloneSessionMutex();
      }
    };
  }, [exerciseSlug]);

  return {
    activeSessionId,
    isCreatingSession,
    isStandaloneMode: !providedSessionId && !disabled,
    profileId: activeProfile?.id,
  };
};
