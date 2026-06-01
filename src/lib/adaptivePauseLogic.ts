/**
 * Adaptive pause logic — determines when and how long to pause
 * between exercises based on performance signals rather than fixed intervals.
 */

export interface PerformanceSignals {
  /** Number of exercises completed so far */
  completedCount: number;
  /** Recent accuracy scores (last 3-5 exercises) */
  recentScores: number[];
  /** Recent average reaction times in ms */
  recentReactionTimes: number[];
  /** Time elapsed in session (minutes) */
  elapsedMinutes: number;
  /** Whether fatigue flag is active from readiness */
  fatigueFlag?: boolean;
  /** Number of timeouts/no-responses in recent exercises */
  recentTimeouts?: number;
}

export interface PauseDecision {
  type: 'encouragement' | 'micro-pause';
  /** Duration in seconds */
  duration: number;
  /** Why this decision was made */
  reason: string;
}

/** Base intervals — used as defaults, overridden by performance */
const BASE_ENCOURAGEMENT_SEC = 3; // standard 3s auto-advance between rounds
const BASE_MICRO_PAUSE_SEC = 5;
const BASE_PAUSE_INTERVAL = 3; // every N exercises

/**
 * Decide whether to show an encouragement or micro-pause,
 * and for how long, based on performance signals.
 */
export function decidePause(signals: PerformanceSignals): PauseDecision {
  const { completedCount, recentScores, recentReactionTimes, elapsedMinutes, fatigueFlag, recentTimeouts = 0 } = signals;

  // Calculate performance indicators
  const avgScore = recentScores.length > 0
    ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length
    : 0.5;
  
  const avgRT = recentReactionTimes.length > 0
    ? recentReactionTimes.reduce((a, b) => a + b, 0) / recentReactionTimes.length
    : 3000;

  const isStruggling = avgScore < 0.5 || recentTimeouts >= 2;
  const isFatigued = fatigueFlag || elapsedMinutes > 12 || avgRT > 8000;
  const isPerformingWell = avgScore > 0.8 && avgRT < 4000 && !fatigueFlag;

  // Rule 1: If struggling or fatigued, insert micro-pause more frequently + longer
  if (isStruggling || isFatigued) {
    if (completedCount > 0 && completedCount % 2 === 0) {
      return {
        type: 'micro-pause',
        duration: isFatigued ? 8 : 6,
        reason: isFatigued ? 'fatigue_detected' : 'struggling_performance',
      };
    }
    return {
      type: 'encouragement',
      duration: 2,
      reason: 'supportive_pacing',
    };
  }

  // Rule 2: If performing well, shorter pauses and less frequent micro-pauses
  if (isPerformingWell) {
    if (completedCount > 0 && completedCount % 4 === 0) {
      return {
        type: 'micro-pause',
        duration: 4,
        reason: 'scheduled_reset_strong_performance',
      };
    }
    return {
      type: 'encouragement',
      duration: 1.2,
      reason: 'momentum_preservation',
    };
  }

  // Rule 3: Standard pacing (moderate performance)
  if (completedCount > 0 && completedCount % BASE_PAUSE_INTERVAL === 0) {
    return {
      type: 'micro-pause',
      duration: BASE_MICRO_PAUSE_SEC,
      reason: 'scheduled_cognitive_reset',
    };
  }

  return {
    type: 'encouragement',
    duration: BASE_ENCOURAGEMENT_SEC,
    reason: 'standard_transition',
  };
}
