import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startSession } from '@/lib/sessionTracking';
import { useProfile } from '@/hooks/useProfile';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';

/** sessionStorage mutex preventing duplicate standalone session creation
 *  during React 18 double-invoked effects or mobile re-hydration races. */
const STANDALONE_MUTEX_KEY = 'standaloneSessionMutex';
const pending = new Map<string, Promise<string | null>>();

interface MutexEntry {
  exerciseSlug: string;
  sessionId: string;
  userId?: string;
  profileId?: string;
  mode?: string;
}
function readMutex(): MutexEntry | null {
  try { return JSON.parse(sessionStorage.getItem(STANDALONE_MUTEX_KEY) ?? 'null'); }
  catch { return null; }
}
export function clearStandaloneSessionMutex(sessionId: string) {
  try {
    if (readMutex()?.sessionId === sessionId) sessionStorage.removeItem(STANDALONE_MUTEX_KEY);
  } catch { /* Storage can be disabled. */ }
}

async function acquireSession(userId: string, profileId: string, exerciseSlug: string, mode: string) {
  const cached = readMutex();
  if (cached?.sessionId && cached.exerciseSlug === exerciseSlug &&
      (!cached.userId || cached.userId === userId) && (!cached.profileId || cached.profileId === profileId) &&
      (!cached.mode || cached.mode === mode)) {
    // Older clients cached only an ID and slug. An open, owned database row is
    // the authority even when an earlier build or interrupted finish left the ID behind.
    const { data, error } = await supabase.from('sessions').select('id')
      .eq('id', cached.sessionId).eq('user_id', userId).eq('profile_id', profileId)
      .is('ended_at', null).maybeSingle();
    if (error) throw error;
    if (data) return data.id;
    clearStandaloneSessionMutex(cached.sessionId);
  }
  const session = await startSession(userId, { blocks: [{ exercise: exerciseSlug, duration: 10 }] }, { profileId });
  if (!session?.id) return null;
  try {
    sessionStorage.setItem(STANDALONE_MUTEX_KEY, JSON.stringify({ userId, profileId, exerciseSlug, mode, sessionId: session.id }));
  } catch { /* The current mount still owns the session. */ }
  try {
    const { error } = await supabase.from('sessions').update({ summary: { mode } })
      .eq('id', session.id).is('ended_at', null);
    if (error) console.warn('[useStandaloneSession] could not stamp session mode', error.message);
  } catch (error) {
    console.warn('[useStandaloneSession] could not stamp session mode', error);
  }
  return session.id as string;
}

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
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id;
  const { disabled = false, mode = 'standalone' } = options;
  const key = JSON.stringify([userId, profileId, exerciseSlug, mode]);
  const [resolved, setResolved] = useState<{ key: string; id: string | null } | null>(null);

  // Defensive: detect an in-flight lesson/coach session for THIS exercise only.
  // Stale state from a different exercise must not block standalone launch.
  const hasOwnedSessionContext = (): boolean => {
    try {
      const lessonRaw = sessionStorage.getItem('lessonFlowState');
      if (lessonRaw) {
        const parsed = JSON.parse(lessonRaw);
        const savedIndex = typeof parsed?.currentBlockIndex === 'number' ? parsed.currentBlockIndex : -1;
        const savedExercise = parsed?.lesson?.blocks?.[savedIndex]?.exerciseId;
        if (parsed?.sessionId && savedExercise && normalizeExerciseSlug(savedExercise) === exerciseSlug) return true;
      }
      const coachRaw = sessionStorage.getItem('smartCoachState');
      if (coachRaw) {
        const parsed = JSON.parse(coachRaw);
        const slot = parsed?.returningFromGame;
        const savedExercise = slot === 1
          ? parsed?.plan?.game1?.exerciseSlug
          : slot === 2
            ? parsed?.plan?.game2?.exerciseSlug
            : null;
        if (parsed?.sessionId && savedExercise && normalizeExerciseSlug(savedExercise) === exerciseSlug) return true;
      }
    } catch { /* ignore */ }
    return false;
  };

  const ownedByParent = hasOwnedSessionContext();
  const shouldAcquire = Boolean(userId && profileId && !providedSessionId && !disabled && !ownedByParent);
  const activeSessionId = providedSessionId || (shouldAcquire && resolved?.key === key ? resolved.id : null);
  const isCreatingSession = shouldAcquire && resolved?.key !== key;

  useEffect(() => {
    if (!shouldAcquire || !userId || !profileId) return;
    let current = true;
    let acquisition = pending.get(key);
    if (!acquisition) {
      acquisition = acquireSession(userId, profileId, exerciseSlug, mode)
        .catch(error => { console.warn('[useStandaloneSession] acquisition failed', error); return null; })
        .finally(() => { pending.delete(key); });
      pending.set(key, acquisition);
    }
    void acquisition.then(id => { if (current) setResolved({ key, id }); });
    return () => { current = false; };
  }, [shouldAcquire, userId, profileId, exerciseSlug, mode, key]);

  return {
    activeSessionId,
    isCreatingSession,
    isStandaloneMode: !providedSessionId && !disabled,
    profileId: activeProfile?.id,
  };
};
