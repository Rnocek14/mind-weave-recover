import { useEffect, useState } from 'react';
import { startSession } from '@/lib/sessionTracking';
import { useProfile } from '@/hooks/useProfile';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';

const STANDALONE_MUTEX_KEY = 'standaloneSessionMutex';
const pendingSessions = new Map<string, Promise<string>>();

interface SessionSlot {
  scope: string;
  sessionId: string | null;
}

function readSlot(): SessionSlot | null {
  try {
    const raw = sessionStorage.getItem(STANDALONE_MUTEX_KEY);
    if (!raw) return null;
    const slot = JSON.parse(raw);
    return typeof slot?.scope === 'string' &&
      (typeof slot.sessionId === 'string' || slot.sessionId === null) ? slot : null;
  } catch { return null; }
}

function writeSlot(slot: SessionSlot) {
  try { sessionStorage.setItem(STANDALONE_MUTEX_KEY, JSON.stringify(slot)); } catch { /* storage unavailable */ }
}

export function clearStandaloneSessionMutex(sessionId?: string) {
  if (sessionId && readSlot()?.sessionId !== sessionId) return;
  try { sessionStorage.removeItem(STANDALONE_MUTEX_KEY); } catch { /* storage unavailable */ }
}

interface UseStandaloneSessionOptions {
  /** Lesson and coach flows own session creation, even while their ID is loading. */
  disabled?: boolean;
  mode?: 'standalone' | 'lesson' | 'smart_coach';
}

function hasOwnedSessionContext(exerciseSlug: string): boolean {
  try {
    const lessonRaw = sessionStorage.getItem('lessonFlowState');
    if (lessonRaw) {
      const lesson = JSON.parse(lessonRaw);
      const block = lesson.lesson?.blocks?.[lesson.currentBlockIndex];
      if (lesson.sessionId && block?.exerciseId && normalizeExerciseSlug(block.exerciseId) === exerciseSlug) return true;
    }
    const coachRaw = sessionStorage.getItem('smartCoachState');
    if (coachRaw) {
      const coach = JSON.parse(coachRaw);
      const game = coach.returningFromGame === 1 ? coach.plan?.game1 :
        coach.returningFromGame === 2 ? coach.plan?.game2 : null;
      if (coach.sessionId && game?.exerciseSlug && normalizeExerciseSlug(game.exerciseSlug) === exerciseSlug) return true;
    }
  } catch { /* no usable parent session */ }
  return false;
}

async function stampSessionMode(sessionId: string, mode: NonNullable<UseStandaloneSessionOptions['mode']>) {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { error } = await supabase.from('sessions').update({ summary: { mode } })
      .eq('id', sessionId).is('ended_at', null);
    if (error) console.warn('[useStandaloneSession] Failed to save session mode:', error);
  } catch (error) {
    console.warn('[useStandaloneSession] Failed to save session mode:', error);
  }
}

function acquireSession(scope: string, userId: string, profileId: string, exerciseSlug: string,
  mode: NonNullable<UseStandaloneSessionOptions['mode']>) {
  const cached = readSlot();
  if (cached?.scope === scope && cached.sessionId) return Promise.resolve(cached.sessionId);

  writeSlot({ scope, sessionId: null });
  const inFlight = pendingSessions.get(scope);
  if (inFlight) return inFlight;

  const request = startSession(userId, { blocks: [{ exercise: exerciseSlug, duration: 10 }] }, { profileId })
    .then(session => {
      if (!session?.id) throw new Error('Session creation returned no ID');
      // A slower request for the previous patient must not replace the current slot.
      if (readSlot()?.scope === scope) writeSlot({ scope, sessionId: session.id });
      void stampSessionMode(session.id, mode);
      return session.id as string;
    })
    .finally(() => { pendingSessions.delete(scope); });

  pendingSessions.set(scope, request);
  return request;
}

export const useStandaloneSession = (
  userId: string | undefined,
  providedSessionId: string | null | undefined,
  rawExerciseSlug: string,
  { disabled = false, mode = 'standalone' }: UseStandaloneSessionOptions = {},
) => {
  const exerciseSlug = normalizeExerciseSlug(rawExerciseSlug);
  const { activeProfile } = useProfile();
  // The previous account's profile may still be mounted while auth switches.
  const profileId = userId && activeProfile?.user_id === userId ? activeProfile.id : undefined;
  const scope = userId && profileId ? JSON.stringify([userId, profileId, exerciseSlug]) : null;
  const [local, setLocal] = useState<(SessionSlot & { creating: boolean }) | null>(null);

  useEffect(() => {
    if (providedSessionId || disabled || !scope || !userId || !profileId || hasOwnedSessionContext(exerciseSlug)) return;
    let current = true;
    setLocal({ scope, sessionId: null, creating: true });
    acquireSession(scope, userId, profileId, exerciseSlug, mode).then(
      sessionId => {
        if (current) setLocal({ scope, sessionId, creating: false });
      },
      error => {
        console.error('[useStandaloneSession] Could not open practice:', error);
        if (current) setLocal({ scope, sessionId: null, creating: false });
      },
    );
    return () => { current = false; };
  }, [providedSessionId, disabled, scope, userId, profileId, exerciseSlug, mode]);

  const ownSession = !disabled && local?.scope === scope ? local : null;
  return {
    activeSessionId: providedSessionId || ownSession?.sessionId || null,
    isCreatingSession: !providedSessionId && !!ownSession?.creating,
    isStandaloneMode: !providedSessionId && !disabled,
    profileId,
  };
};
