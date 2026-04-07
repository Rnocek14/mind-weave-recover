/**
 * useRestoredLessonContext
 * 
 * Restores lesson flow context from sessionStorage when route state is lost
 * (e.g. page refresh, deep link). Ensures exercises maintain their connection
 * to the lesson orchestrator for auto-advance.
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

/**
 * @param exerciseSlug - The exercise slug to match (supports both dash and underscore variants)
 */
export function useRestoredLessonContext(exerciseSlug: string): RestoredLessonContext {
  const location = useLocation();

  return useMemo(() => {
    // If route state exists, prefer it
    const hasRouteState = Boolean(location.state?.fromLesson || location.state?.sessionId);
    if (hasRouteState) {
      return {
        fromLesson: Boolean(location.state?.fromLesson || location.state?.sessionId),
        sessionId: location.state?.sessionId ?? null,
        adaptations: location.state?.adaptations,
      };
    }

    // Fallback: restore from sessionStorage
    try {
      const saved = sessionStorage.getItem('lessonFlowState');
      if (!saved) return { fromLesson: false, sessionId: null, adaptations: undefined };

      const parsed = JSON.parse(saved);
      const savedIndex = typeof parsed?.currentBlockIndex === 'number' ? parsed.currentBlockIndex : -1;
      const savedBlock = parsed?.lesson?.blocks?.[savedIndex];
      const savedExerciseId = savedBlock?.exerciseId;

      // Normalize both to dash-case for comparison
      const normalize = (s: string) => s.replace(/_/g, '-');
      const normalizedSaved = typeof savedExerciseId === 'string' ? normalize(savedExerciseId) : null;
      const normalizedTarget = normalize(exerciseSlug);

      if (!savedBlock || normalizedSaved !== normalizedTarget) {
        return { fromLesson: false, sessionId: null, adaptations: undefined };
      }

      return {
        fromLesson: Boolean(parsed?.sessionId),
        sessionId: parsed?.sessionId ?? null,
        adaptations: savedBlock?.adaptations,
      };
    } catch {
      return { fromLesson: false, sessionId: null, adaptations: undefined };
    }
  }, [location.state, location.key, exerciseSlug]);
}
