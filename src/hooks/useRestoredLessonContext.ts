/**
 * useRestoredLessonContext
 * 
 * Restores lesson flow context from sessionStorage when route state is lost.
 * Supports both LessonFlow (/lesson) and SmartCoach (/smart-coach) return paths.
 */

import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

interface RestoredLessonContext {
  fromLesson: boolean;
  sessionId: string | null;
  adaptations: Record<string, any> | undefined;
  /** Where to navigate back on completion (defaults to '/lesson') */
  returnTo: string;
}

export function useRestoredLessonContext(exerciseSlug: string): RestoredLessonContext {
  const location = useLocation();

  return useMemo(() => {
    const defaultReturn = '/lesson';

    // If route state exists, prefer it
    const hasRouteState = Boolean(location.state?.fromLesson || location.state?.sessionId);
    if (hasRouteState) {
      return {
        fromLesson: Boolean(location.state?.fromLesson || location.state?.sessionId),
        sessionId: location.state?.sessionId ?? null,
        adaptations: location.state?.adaptations,
        returnTo: location.state?.returnTo || defaultReturn,
      };
    }

    // Fallback: check smartCoachState first
    try {
      const smartCoachSaved = sessionStorage.getItem('smartCoachState');
      if (smartCoachSaved) {
        const parsed = JSON.parse(smartCoachSaved);
        if (parsed?.returningFromGame) {
          return {
            fromLesson: true,
            sessionId: parsed?.sessionId ?? null,
            adaptations: undefined,
            returnTo: '/smart-coach',
          };
        }
      }
    } catch { /* ignore */ }

    // Fallback: restore from lessonFlowState sessionStorage
    try {
      const saved = sessionStorage.getItem('lessonFlowState');
      if (!saved) return { fromLesson: false, sessionId: null, adaptations: undefined, returnTo: defaultReturn };

      const parsed = JSON.parse(saved);
      const savedIndex = typeof parsed?.currentBlockIndex === 'number' ? parsed.currentBlockIndex : -1;
      const savedBlock = parsed?.lesson?.blocks?.[savedIndex];
      const savedExerciseId = savedBlock?.exerciseId;

      const normalize = (s: string) => s.replace(/_/g, '-');
      const normalizedSaved = typeof savedExerciseId === 'string' ? normalize(savedExerciseId) : null;
      const normalizedTarget = normalize(exerciseSlug);

      if (!savedBlock || normalizedSaved !== normalizedTarget) {
        return { fromLesson: false, sessionId: null, adaptations: undefined, returnTo: defaultReturn };
      }

      return {
        fromLesson: Boolean(parsed?.sessionId),
        sessionId: parsed?.sessionId ?? null,
        adaptations: savedBlock?.adaptations,
        returnTo: defaultReturn,
      };
    } catch {
      return { fromLesson: false, sessionId: null, adaptations: undefined, returnTo: defaultReturn };
    }
  }, [location.state, location.key, exerciseSlug]);
}
