/**
 * Mid-Session Pivot Engine
 * 
 * Lightweight rule evaluator that runs every N trials within a session.
 * Determines if the current exercise domain should be changed based on
 * real-time performance signals.
 * 
 * Conservative design:
 * - Max 1 pivot per session
 * - Prefers step-down (easier within domain) before switch-away
 * - Requires clear failure signal (not marginal dips)
 * - Feature-flagged via `enabled` parameter
 */

export interface RecentTrialData {
  wasCorrect: boolean;
  reactionTimeMs: number | null;
  wasTimeout: boolean;
  cueLevel: number;
  exerciseSlug: string;
  domainSlug: string;
}

export type PivotAction = 
  | 'none'                    // No pivot needed
  | 'step_down'               // Same domain, easier difficulty/more cues
  | 'switch_to_strength'      // Switch to a domain where user performs well
  | 'rest_prompt';            // Suggest a break

export interface PivotRecommendation {
  action: PivotAction;
  reason: string;
  suggestedDomain?: string;
  suggestedDifficultyDelta?: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface MidSessionPivotState {
  pivotCount: number;
  trialsSincePivot: number;
  totalTrials: number;
  lastPivotTrial: number | null;
}

/** Minimum trials before first pivot check */
const MIN_TRIALS_BEFORE_CHECK = 5;

/** Minimum trials between pivots (cooldown) */
const COOLDOWN_TRIALS = 8;

/** Maximum pivots per session */
const MAX_PIVOTS = 1;

/**
 * Evaluate whether a mid-session pivot is warranted.
 * 
 * @param recentTrials - Last 5 trials (most recent last)
 * @param pivotState - Current pivot state for this session
 * @param strengthDomains - Domains where user has high scores (for switch targets)
 * @param enabled - Feature flag (default: true)
 */
export function evaluateMidSessionPivot(
  recentTrials: RecentTrialData[],
  pivotState: MidSessionPivotState,
  strengthDomains: string[] = [],
  enabled: boolean = true
): PivotRecommendation {
  const NO_PIVOT: PivotRecommendation = { action: 'none', reason: 'No pivot needed', confidence: 'low' };
  
  if (!enabled) return NO_PIVOT;
  
  // Guard: not enough trials yet
  if (pivotState.totalTrials < MIN_TRIALS_BEFORE_CHECK) {
    return { ...NO_PIVOT, reason: `Only ${pivotState.totalTrials} trials (need ${MIN_TRIALS_BEFORE_CHECK})` };
  }
  
  // Guard: already pivoted max times
  if (pivotState.pivotCount >= MAX_PIVOTS) {
    return { ...NO_PIVOT, reason: `Already pivoted ${pivotState.pivotCount} time(s) this session` };
  }
  
  // Guard: cooldown period after last pivot
  if (pivotState.lastPivotTrial !== null && pivotState.trialsSincePivot < COOLDOWN_TRIALS) {
    return { ...NO_PIVOT, reason: `Cooldown: ${pivotState.trialsSincePivot}/${COOLDOWN_TRIALS} trials since last pivot` };
  }
  
  // Need at least 5 recent trials to evaluate
  if (recentTrials.length < 5) {
    return { ...NO_PIVOT, reason: 'Need 5 recent trials to evaluate' };
  }
  
  const last5 = recentTrials.slice(-5);
  
  // --- Rule 1: Frustration signal (rapid incorrect taps < 500ms) ---
  const rapidErrors = last5.filter(t => 
    !t.wasCorrect && 
    t.reactionTimeMs !== null && 
    t.reactionTimeMs < 500 && 
    !t.wasTimeout
  );
  if (rapidErrors.length >= 3) {
    // Prefer step-down first, then strength switch
    return {
      action: 'step_down',
      reason: `Frustration detected: ${rapidErrors.length}/5 rapid incorrect responses (<500ms)`,
      suggestedDifficultyDelta: -2,
      confidence: 'high',
    };
  }
  
  // --- Rule 2: Consecutive timeouts ---
  const timeoutCount = last5.filter(t => t.wasTimeout).length;
  if (timeoutCount >= 2) {
    // 2+ timeouts in last 5 → rest prompt or step down
    if (timeoutCount >= 3) {
      return {
        action: 'rest_prompt',
        reason: `${timeoutCount}/5 trials timed out — suggesting a break`,
        confidence: 'high',
      };
    }
    return {
      action: 'step_down',
      reason: `${timeoutCount}/5 trials timed out — reducing difficulty`,
      suggestedDifficultyDelta: -1,
      confidence: 'medium',
    };
  }
  
  // --- Rule 3: Accuracy collapse (<40% in last 5, with 3+ consecutive failures) ---
  const correctCount = last5.filter(t => t.wasCorrect).length;
  const accuracy = correctCount / last5.length;
  
  if (accuracy < 0.4) {
    // Check for 3+ consecutive failures
    let maxConsecutiveFails = 0;
    let currentStreak = 0;
    for (const t of last5) {
      if (!t.wasCorrect) {
        currentStreak++;
        maxConsecutiveFails = Math.max(maxConsecutiveFails, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    
    if (maxConsecutiveFails >= 3) {
      // Step down first, then switch if we already tried step-down
      if (strengthDomains.length > 0) {
        const currentDomain = last5[last5.length - 1]?.domainSlug;
        const altDomain = strengthDomains.find(d => d !== currentDomain);
        if (altDomain) {
          return {
            action: 'switch_to_strength',
            reason: `Accuracy ${Math.round(accuracy * 100)}% with ${maxConsecutiveFails} consecutive failures — switching to strength domain`,
            suggestedDomain: altDomain,
            confidence: 'medium',
          };
        }
      }
      
      return {
        action: 'step_down',
        reason: `Accuracy ${Math.round(accuracy * 100)}% with ${maxConsecutiveFails} consecutive failures`,
        suggestedDifficultyDelta: -2,
        confidence: 'medium',
      };
    }
  }
  
  return NO_PIVOT;
}

/**
 * Create initial pivot state for a new session
 */
export function createPivotState(): MidSessionPivotState {
  return {
    pivotCount: 0,
    trialsSincePivot: 0,
    totalTrials: 0,
    lastPivotTrial: null,
  };
}

/**
 * Update pivot state after a trial
 */
export function updatePivotState(
  state: MidSessionPivotState,
  pivotApplied: boolean = false
): MidSessionPivotState {
  return {
    pivotCount: pivotApplied ? state.pivotCount + 1 : state.pivotCount,
    trialsSincePivot: pivotApplied ? 0 : state.trialsSincePivot + 1,
    totalTrials: state.totalTrials + 1,
    lastPivotTrial: pivotApplied ? state.totalTrials + 1 : state.lastPivotTrial,
  };
}
