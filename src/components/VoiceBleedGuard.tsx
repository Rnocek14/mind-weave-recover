import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { flushVoiceSessionQueue } from '@/lib/voiceController';

/**
 * Step 1 of the voice-bleed fix. Watches react-router and flushes any
 * leftover Maya audio whenever the user navigates between exercises (or to
 * /today, etc.). No game logic is touched — this is a pure cleanup hook.
 */
export const VoiceBleedGuard = () => {
  const location = useLocation();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevPathRef.current;
    const next = location.pathname;
    if (prev !== null && prev !== next) {
      flushVoiceSessionQueue(`route-change ${prev} → ${next}`);
    }
    prevPathRef.current = next;
  }, [location.pathname]);

  return null;
};
