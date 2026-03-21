/**
 * Session flow instrumentation — tracks completion, drop-off,
 * pause behavior, and transition timing for the guided continuous flow.
 */

interface FlowEvent {
  type: string;
  exerciseIndex: number;
  totalExercises: number;
  sessionId: string | null;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

const flowEvents: FlowEvent[] = [];

/** Record when "Start Today's Session" is tapped */
export const trackSessionStartTap = (sessionId: string | null, totalExercises: number) => {
  logFlowEvent({
    type: 'session_start_tap',
    exerciseIndex: 0,
    totalExercises,
    sessionId,
    timestamp: Date.now(),
  });
};

/** Record when the first exercise actually renders */
export const trackFirstExerciseLaunch = (sessionId: string | null, totalExercises: number) => {
  const startTap = flowEvents.find(e => e.type === 'session_start_tap' && e.sessionId === sessionId);
  const launchLatencyMs = startTap ? Date.now() - startTap.timestamp : null;
  
  logFlowEvent({
    type: 'first_exercise_launch',
    exerciseIndex: 0,
    totalExercises,
    sessionId,
    timestamp: Date.now(),
    metadata: { launchLatencyMs },
  });
};

/** Record exercise completion */
export const trackExerciseComplete = (
  sessionId: string | null,
  exerciseIndex: number,
  totalExercises: number,
  exerciseSlug: string,
) => {
  logFlowEvent({
    type: 'exercise_complete',
    exerciseIndex,
    totalExercises,
    sessionId,
    timestamp: Date.now(),
    metadata: { exerciseSlug },
  });
};

/** Record transition/pause behavior */
export const trackTransitionAction = (
  sessionId: string | null,
  exerciseIndex: number,
  totalExercises: number,
  transitionType: 'encouragement' | 'micro-pause',
  action: 'auto_advance' | 'skip' | 'end_session' | 'need_more_time',
  timeSpentMs: number,
) => {
  logFlowEvent({
    type: 'transition_action',
    exerciseIndex,
    totalExercises,
    sessionId,
    timestamp: Date.now(),
    metadata: { transitionType, action, timeSpentMs },
  });
};

/** Record session drop-off */
export const trackSessionDropOff = (
  sessionId: string | null,
  exerciseIndex: number,
  totalExercises: number,
  reason: 'end_button' | 'micro_pause_end' | 'navigate_away',
) => {
  logFlowEvent({
    type: 'session_drop_off',
    exerciseIndex,
    totalExercises,
    sessionId,
    timestamp: Date.now(),
    metadata: { reason, completionRate: totalExercises > 0 ? exerciseIndex / totalExercises : 0 },
  });
};

/** Record full session completion */
export const trackSessionComplete = (
  sessionId: string | null,
  totalExercises: number,
  totalDurationMs: number,
) => {
  logFlowEvent({
    type: 'session_complete',
    exerciseIndex: totalExercises,
    totalExercises,
    sessionId,
    timestamp: Date.now(),
    metadata: { totalDurationMs },
  });
};

function logFlowEvent(event: FlowEvent) {
  flowEvents.push(event);
  console.log(`[FlowAnalytics] ${event.type}`, {
    exercise: `${event.exerciseIndex + 1}/${event.totalExercises}`,
    ...event.metadata,
  });
}

/** Get all flow events for the current session (useful for debugging) */
export const getFlowEvents = (sessionId: string | null) =>
  flowEvents.filter(e => e.sessionId === sessionId);
