import { useState, useEffect } from 'react';
import { startSession } from '@/lib/sessionTracking';
import { useProfile } from '@/hooks/useProfile';

/**
 * Hook to auto-create a session for standalone game usage.
 * When games are launched from the game picker (not lesson flow),
 * they don't have a sessionId. This hook creates one so audio
 * recording and analytics can work.
 */
export const useStandaloneSession = (
  userId: string | undefined,
  providedSessionId: string | null | undefined,
  exerciseSlug: string
) => {
  const [localSessionId, setLocalSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const { activeProfile } = useProfile();

  // The effective sessionId to use throughout the game
  const activeSessionId = providedSessionId || localSessionId;

  useEffect(() => {
    // Debug: log every mount to see what's blocking
    console.log('[useStandaloneSession] mount', {
      userId,
      providedSessionId,
      localSessionId,
      isCreatingSession,
      exerciseSlug,
      activeProfileId: activeProfile?.id ?? null,
    });

    // Only create a session if:
    // 1. No sessionId was provided (standalone mode)
    // 2. We have a user
    // 3. We have a profile (required for RLS)
    // 4. We haven't already created one
    // 5. We're not currently creating one
    if (!providedSessionId && userId && activeProfile?.id && !localSessionId && !isCreatingSession) {
      console.log('[useStandaloneSession] creating session NOW', {
        userId,
        exerciseSlug,
        activeProfileId: activeProfile?.id,
      });
      setIsCreatingSession(true);
      
      console.log('📝 Creating standalone session for', exerciseSlug, 'profile:', activeProfile.id);
      
      startSession(userId, {
        blocks: [{ exercise: exerciseSlug, duration: 10 }]
      }, activeProfile.id)
        .then((session) => {
          if (session?.id) {
            console.log('✅ [useStandaloneSession] Session created successfully:', {
              sessionId: session.id,
              profileId: activeProfile?.id,
              userId,
              exerciseSlug
            });
            setLocalSessionId(session.id);
          } else {
            console.warn('⚠️ [useStandaloneSession] startSession returned no session:', session);
          }
        })
        .catch((error) => {
          console.error('❌ [useStandaloneSession] Failed to create session:', {
            error,
            userId,
            profileId: activeProfile?.id,
            exerciseSlug
          });
        })
        .finally(() => {
          setIsCreatingSession(false);
        });
    }
  }, [providedSessionId, userId, activeProfile?.id, localSessionId, isCreatingSession, exerciseSlug]);

  return {
    activeSessionId,
    isCreatingSession,
    isStandaloneMode: !providedSessionId,
    profileId: activeProfile?.id
  };
};
