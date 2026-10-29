import { useCallback, useEffect, useState } from 'react';
import { startSession } from '@/lib/sessionTracking';
import { useProfile } from '@/hooks/useProfile';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';
import { supabase } from '@/integrations/supabase/client';

/**
 * One short-lived remount cache per browser tab; all cached IDs are scoped to
 * the authenticated user, patient profile, exercise, and session mode.
 * In-progress requests are shared by a promise, NEVER a one-off 250ms timer.
 */
const MUTEX_KEY = 'standaloneSessionMutex';
const CACHE_TTL_MS = 30_000;
interface Entry {
  scope: string;
  token: string;
  createdAt: number;
  sessionId?: string;
}
const pending = new Map<string, Promise<string>>();
let nextToken = 0;

function readEntry(): Entry | null {
  try {
    const raw = sessionStorage.getItem(MUTEX_KEY);
    if (!raw) return null;
    const value: Partial<Entry> = JSON.parse(raw);
    if (
      typeof value.scope !== 'string' || typeof value.token !== 'string' ||
      typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt) ||
      (value.sessionId !== undefined && typeof value.sessionId !== 'string') ||
      Date.now() - value.createdAt > CACHE_TTL_MS ||
      value.createdAt > Date.now() + 5_000
    ) {
      sessionStorage.removeItem(MUTEX_KEY);
      return null;
    }
    return value as Entry;
  } catch { return null; }
}
function writeEntry(value: Entry) {
  try { sessionStorage.setItem(MUTEX_KEY, JSON.stringify(value)); } catch { /* storage blocked */ }
}
function clearEntry(scope: string, token: string) {
  const value = readEntry();
  if (value?.scope === scope && value.token === token) {
    try { sessionStorage.removeItem(MUTEX_KEY); } catch { /* storage blocked */ }
  }
}

/** An old session ending must never clear a newer patient's pending session. */
export function clearStandaloneSessionMutex(sessionId?: string) {
  try {
    if (sessionId && readEntry()?.sessionId !== sessionId) return;
    sessionStorage.removeItem(MUTEX_KEY);
  } catch { /* storage blocked */ }
}

interface Scope {
  userId: string;
  profileId: string;
  exerciseSlug: string;
  mode: 'standalone' | 'lesson' | 'smart_coach';
}
function keyOf(scope: Scope): string {
  return JSON.stringify([scope.userId, scope.profileId, scope.exerciseSlug, scope.mode]);
}

function acquireSession(scope: Scope): Promise<string> {
  const key = keyOf(scope);
  const alreadyPending = pending.get(key);
  if (alreadyPending) return alreadyPending;

  // Register this promise synchronously before any network-await.
  const work = (async () => {
    const cached = readEntry();
    if (cached?.scope === key && cached.sessionId) {
      // Cached IDs are untrusted until the real authenticated RLS query proves
      // same patient, ownership and an unfinished session.
      const { data, error } = await supabase.from('sessions')
        .select('id, user_id, profile_id, ended_at')
        .eq('id', cached.sessionId).maybeSingle();
      if (error) throw new Error('Unable to verify cached session');
      if (
        data?.id === cached.sessionId && data.user_id === scope.userId &&
        data.profile_id === scope.profileId && data.ended_at == null
      ) return cached.sessionId;
      clearEntry(key, cached.token);
    }

    const token = String(Date.now()) + '-' + String(++nextToken);
    writeEntry({ scope: key, token, createdAt: Date.now() });
    try {
      const created = await startSession(
        scope.userId,
        { blocks: [{ exercise: scope.exerciseSlug, duration: 10 }] },
        { profileId: scope.profileId },
      );
      if (!created?.id) throw new Error('Missing session ID');
      if (
        (created.user_id && created.user_id !== scope.userId) ||
        (created.profile_id && created.profile_id !== scope.profileId)
      ) throw new Error('Created session belongs to another patient');

      // On account/profile switch another acquisition may now own the cache.
      // Never overwrite it with a late response from the prior patient.
      if (readEntry()?.token === token) {
        writeEntry({ scope: key, token, createdAt: Date.now(), sessionId: created.id });
      }
      try {
        const { error } = await supabase.from('sessions')
          .update({ summary: { mode: scope.mode } as any })
          .eq('id', created.id)
          .eq('user_id', scope.userId)
          .eq('profile_id', scope.profileId)
          .is('ended_at', null);
        if (error) console.warn('[useStandaloneSession] optional mode stamp failed');
      } catch {
        console.warn('[useStandaloneSession] optional mode stamp failed');
      }
      return created.id as string;
    } catch (error) {
      clearEntry(key, token);
      throw error;
    }
  })();

  pending.set(key, work);
  void work.then(
    () => { if (pending.get(key) === work) pending.delete(key); },
    () => { if (pending.get(key) === work) pending.delete(key); },
  );
  return work;
}

interface UseStandaloneSessionOptions {
  disabled?: boolean;
  mode?: 'standalone' | 'lesson' | 'smart_coach';
}
interface LocalSession {
  scope: string;
  id: string | null;
  creating: boolean;
  error: string | null;
}

/** Patient-scoped standalone session creation with same-scope deduplication. */
export const useStandaloneSession = (
  userId: string | undefined,
  providedSessionId: string | null | undefined,
  rawExerciseSlug: string,
  options: UseStandaloneSessionOptions = {},
) => {
  const exerciseSlug = normalizeExerciseSlug(rawExerciseSlug);
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id;
  const { disabled = false, mode = 'standalone' } = options;
  const scopeKey = userId && profileId
    ? keyOf({ userId, profileId, exerciseSlug, mode })
    : null;
  const [local, setLocal] = useState<LocalSession | null>(null);
  const [retryCounter, setRetryCounter] = useState(0);
  const retrySession = useCallback(() => setRetryCounter(n => n + 1), []);

  useEffect(() => {
    // Retain the preexisting prevention of duplicate lesson/smart-coach
    // sessions while route hydration has not finished.
    const hasOwnedSessionContext = (): boolean => {
      try {
        const lessonRaw = sessionStorage.getItem('lessonFlowState');
        if (lessonRaw) {
          const state = JSON.parse(lessonRaw);
          const index = typeof state?.currentBlockIndex === 'number' ? state.currentBlockIndex : -1;
          const selected = state?.lesson?.blocks?.[index]?.exerciseId;
          if (state?.sessionId && selected && normalizeExerciseSlug(selected) === exerciseSlug) return true;
        }
        const coachRaw = sessionStorage.getItem('smartCoachState');
        if (coachRaw) {
          const state = JSON.parse(coachRaw);
          const selected = state?.returningFromGame === 1
            ? state?.plan?.game1?.exerciseSlug
            : state?.returningFromGame === 2
              ? state?.plan?.game2?.exerciseSlug
              : null;
          if (state?.sessionId && selected && normalizeExerciseSlug(selected) === exerciseSlug) return true;
        }
      } catch { /* untrusted stale context */ }
      return false;
    };
    if (providedSessionId || disabled || !userId || !profileId || !scopeKey || hasOwnedSessionContext()) return;

    let cancelled = false;
    setLocal({ scope: scopeKey, id: null, creating: true, error: null });
    void acquireSession({ userId, profileId, exerciseSlug, mode })
      .then(id => {
        if (!cancelled) setLocal({ scope: scopeKey, id, creating: false, error: null });
      })
      .catch(() => {
        if (!cancelled) setLocal({
          scope: scopeKey,
          id: null,
          creating: false,
          error: 'Could not start this exercise. Check your connection and try again.',
        });
      });
    // StrictMode remount/identity switch: old request may finish for old user
    // but MUST NOT publish its session ID to the new patient's hook.
    return () => { cancelled = true; };
  }, [userId, profileId, exerciseSlug, mode, scopeKey, providedSessionId, disabled, retryCounter]);

  const state = local?.scope === scopeKey ? local : null;
  return {
    activeSessionId: providedSessionId || state?.id || null,
    isCreatingSession: !providedSessionId && !disabled && !!scopeKey && (state?.creating ?? true),
    isStandaloneMode: !providedSessionId && !disabled,
    profileId,
    sessionError: state?.error ?? null,
    retrySession,
  };
};
