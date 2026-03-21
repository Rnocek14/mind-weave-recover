/**
 * Profile Freshness Utilities
 * 
 * Determines whether the user's speech profile is fresh enough 
 * for reliable daily lesson personalization.
 */

export interface ProfileFreshnessResult {
  isFresh: boolean;
  isStale: boolean;
  /** true if profile has never been computed */
  isMissing: boolean;
  /** Hours since last computation */
  hoursSinceCompute: number | null;
  /** Human-readable status */
  status: 'fresh' | 'aging' | 'stale' | 'missing';
  /** Warning message if stale */
  warning?: string;
}

const FRESH_THRESHOLD_HOURS = 24;
const STALE_THRESHOLD_HOURS = 72;

/**
 * Evaluate how fresh a speech profile is based on last_computed_at.
 */
export function evaluateProfileFreshness(
  lastComputedAt: string | null | undefined,
  nowMs: number = Date.now()
): ProfileFreshnessResult {
  if (!lastComputedAt) {
    return {
      isFresh: false,
      isStale: true,
      isMissing: true,
      hoursSinceCompute: null,
      status: 'missing',
      warning: 'Speech profile has never been computed. Personalization is using defaults.',
    };
  }

  const hoursSince = (nowMs - new Date(lastComputedAt).getTime()) / (1000 * 60 * 60);

  if (hoursSince <= FRESH_THRESHOLD_HOURS) {
    return {
      isFresh: true,
      isStale: false,
      isMissing: false,
      hoursSinceCompute: Math.round(hoursSince),
      status: 'fresh',
    };
  }

  if (hoursSince <= STALE_THRESHOLD_HOURS) {
    return {
      isFresh: false,
      isStale: false,
      isMissing: false,
      hoursSinceCompute: Math.round(hoursSince),
      status: 'aging',
      warning: `Speech profile is ${Math.round(hoursSince)}h old. It will refresh after the next session.`,
    };
  }

  return {
    isFresh: false,
    isStale: true,
    isMissing: false,
    hoursSinceCompute: Math.round(hoursSince),
    status: 'stale',
    warning: `Speech profile is ${Math.round(hoursSince)}h old. Personalization may not reflect recent performance.`,
  };
}
