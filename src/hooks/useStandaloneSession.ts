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
    // Only create a session if:
    // 1. No sessionId was provided (standalone mode)
    // 2. We have a user
    // 3. We haven't already created one
    // 4. We're not currently creating one
    if (!providedSessionId && userId && !localSessionId && !isCreatingSession) {
      setIsCreatingSession(true);
      
      console.log('📝 Creating standalone session for', exerciseSlug);
      
      startSession(userId, {
        blocks: [{ exercise: exerciseSlug, duration: 10 }]
      })
        .then((session) => {
          if (session?.id) {
            console.log('✅ Standalone session created:', session.id);
            setLocalSessionId(session.id);
          }
        })
        .catch((error) => {
          console.error('❌ Failed to create standalone session:', error);
        })
        .finally(() => {
          setIsCreatingSession(false);
        });
    }
  }, [providedSessionId, userId, localSessionId, isCreatingSession, exerciseSlug]);

  return {
    activeSessionId,
    isCreatingSession,
    isStandaloneMode: !providedSessionId,
    profileId: activeProfile?.id
  };
};
