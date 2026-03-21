/**
 * Session flow instrumentation — tracks completion, drop-off,
 * pause behavior, and transition timing for the guided continuous flow.
 *
 * Uses a client-side `flowId` (generated at tap time) to correlate
 * early events (before sessionId exists) with later ones.
 */

let flowIdCounter = 0;

interface FlowEvent {
  type: string;
  flowId: string;
  exerciseIndex: number;
  totalExercises: number;
  sessionId: string | null;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

const flowEvents: FlowEvent[] = [];
let activeFlowId: string | null = null;

/** Generate a short client-side flow ID to correlate pre-session events */
function generateFlowId(): string {
  flowIdCounter++;
  return `flow_${Date.now()}_${flowIdCounter}`;
}

/** Record when "Start Today's Session" is tapped — returns flowId for correlation */
export const trackSessionStartTap = (sessionId: string | null, totalExercises: number): string => {
  const flowId = generateFlowId();
  activeFlowId = flowId;
  logFlowEvent({
    type: 'session_start_tap',
    flowId,
    exerciseIndex: 0,
    totalExercises,
    sessionId,
    timestamp: Date.now(),
  });
  return flowId;
};

/** Associate a real sessionId with the current flow (called after session creation) */
export const associateSessionWithFlow = (sessionId: string) => {
  if (!activeFlowId) return;
  // Backfill sessionId on all events in this flow that had null
  flowEvents.forEach(e => {
    if (e.flowId === activeFlowId && !e.sessionId) {
      e.sessionId = sessionId;
    }
  });
  console.log(`[FlowAnalytics] Associated session ${sessionId} with ${activeFlowId}`);
};

/** Record when the first exercise actually renders */
export const trackFirstExerciseLaunch = (sessionId: string | null, totalExercises: number) => {
  // Find start tap by flowId (not sessionId, which may have been null at tap time)
  const startTap = flowEvents.find(e => e.type === 'session_start_tap' && e.flowId === activeFlowId);
  const launchLatencyMs = startTap ? Date.now() - startTap.timestamp : null;
  
  logFlowEvent({
    type: 'first_exercise_launch',
    flowId: activeFlowId || 'unknown',
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
    flowId: activeFlowId || 'unknown',
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
    flowId: activeFlowId || 'unknown',
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
    flowId: activeFlowId || 'unknown',
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
    flowId: activeFlowId || 'unknown',
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
    flowId: event.flowId,
    exercise: `${event.exerciseIndex + 1}/${event.totalExercises}`,
    sessionId: event.sessionId,
    ...event.metadata,
  });
}

/** Get all flow events for the current flow (useful for debugging) */
export const getFlowEvents = (sessionId?: string | null) =>
  sessionId
    ? flowEvents.filter(e => e.sessionId === sessionId)
    : flowEvents.filter(e => e.flowId === activeFlowId);
