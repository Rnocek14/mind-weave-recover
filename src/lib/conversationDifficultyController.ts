/**
 * Conversation Difficulty Controller
 * 
 * Manages the adaptive difficulty for conversation coach sessions.
 * Targets 70-85% success rate (optimal challenge point) by adjusting:
 * - Support level (open → guided → choice)
 * - Cue availability
 * - Sentence frame complexity
 * 
 * Based on evidence-based errorless learning principles.
 */

export type SupportLevel = 'open' | 'guided' | 'choice';

export interface DifficultyState {
  supportLevel: SupportLevel;
  successWindow: boolean[];  // Last N turn outcomes
  currentStreak: number;     // Consecutive successes or failures
  totalSuccess: number;
  totalTurns: number;
  cueFrequency: 'rare' | 'occasional' | 'frequent';
  lastAdjustmentTurn: number;
}

// Target success rate range (70-85%)
const TARGET_SUCCESS_MIN = 0.70;
const TARGET_SUCCESS_MAX = 0.85;
const WINDOW_SIZE = 5;
const MIN_TURNS_BEFORE_ADJUST = 3;

/**
 * Create initial difficulty state
 */
export function createInitialDifficultyState(): DifficultyState {
  return {
    supportLevel: 'guided',  // Start with moderate support
    successWindow: [],
    currentStreak: 0,
    totalSuccess: 0,
    totalTurns: 0,
    cueFrequency: 'occasional',
    lastAdjustmentTurn: 0,
  };
}

export interface AdjustmentResult {
  newState: DifficultyState;
  action: 'increase_support' | 'decrease_support' | 'maintain';
  reasoning: string;
}

/**
 * Record a turn outcome and adjust difficulty if needed
 */
export function recordTurnAndAdjust(
  state: DifficultyState,
  success: boolean
): AdjustmentResult {
  // Update tracking
  const newWindow = [...state.successWindow.slice(-(WINDOW_SIZE - 1)), success];
  const newTotalTurns = state.totalTurns + 1;
  const newTotalSuccess = state.totalSuccess + (success ? 1 : 0);
  
  // Update streak
  let newStreak: number;
  if (success) {
    newStreak = state.currentStreak >= 0 ? state.currentStreak + 1 : 1;
  } else {
    newStreak = state.currentStreak <= 0 ? state.currentStreak - 1 : -1;
  }

  // Calculate current success rate
  const windowSuccessRate = newWindow.length > 0
    ? newWindow.filter(Boolean).length / newWindow.length
    : 0.75; // Default to middle of target

  // Determine if we should adjust
  const turnsSinceAdjust = newTotalTurns - state.lastAdjustmentTurn;
  const shouldConsiderAdjust = turnsSinceAdjust >= MIN_TURNS_BEFORE_ADJUST && 
                                newWindow.length >= MIN_TURNS_BEFORE_ADJUST;

  let newSupportLevel = state.supportLevel;
  let newCueFrequency = state.cueFrequency;
  let action: 'increase_support' | 'decrease_support' | 'maintain' = 'maintain';
  let reasoning = 'Within target range, maintaining current support';

  if (shouldConsiderAdjust) {
    // Too hard (success < 70%) - increase support
    if (windowSuccessRate < TARGET_SUCCESS_MIN) {
      const result = increaseSupport(state.supportLevel, state.cueFrequency);
      newSupportLevel = result.supportLevel;
      newCueFrequency = result.cueFrequency;
      action = 'increase_support';
      reasoning = `Success rate ${Math.round(windowSuccessRate * 100)}% below target (70%), increasing support`;
    }
    // Too easy (success > 85%) - decrease support (fade cues)
    else if (windowSuccessRate > TARGET_SUCCESS_MAX) {
      const result = decreaseSupport(state.supportLevel, state.cueFrequency);
      newSupportLevel = result.supportLevel;
      newCueFrequency = result.cueFrequency;
      action = 'decrease_support';
      reasoning = `Success rate ${Math.round(windowSuccessRate * 100)}% above target (85%), fading support`;
    }
  }

  // Quick adjustment for extreme streaks
  if (newStreak <= -3) {
    // 3 failures in a row - immediately increase support
    const result = increaseSupport(newSupportLevel, newCueFrequency);
    newSupportLevel = result.supportLevel;
    newCueFrequency = result.cueFrequency;
    action = 'increase_support';
    reasoning = '3 consecutive struggles - adding more support';
  } else if (newStreak >= 4) {
    // 4 successes in a row - can fade support
    const result = decreaseSupport(newSupportLevel, newCueFrequency);
    newSupportLevel = result.supportLevel;
    newCueFrequency = result.cueFrequency;
    action = 'decrease_support';
    reasoning = '4 consecutive successes - fading support';
  }

  const newState: DifficultyState = {
    supportLevel: newSupportLevel,
    successWindow: newWindow,
    currentStreak: newStreak,
    totalSuccess: newTotalSuccess,
    totalTurns: newTotalTurns,
    cueFrequency: newCueFrequency,
    lastAdjustmentTurn: action !== 'maintain' ? newTotalTurns : state.lastAdjustmentTurn,
  };

  return { newState, action, reasoning };
}

/**
 * Increase support (make it easier)
 */
function increaseSupport(
  currentLevel: SupportLevel,
  currentCueFreq: 'rare' | 'occasional' | 'frequent'
): { supportLevel: SupportLevel; cueFrequency: 'rare' | 'occasional' | 'frequent' } {
  // First increase cue frequency
  if (currentCueFreq === 'rare') {
    return { supportLevel: currentLevel, cueFrequency: 'occasional' };
  }
  if (currentCueFreq === 'occasional') {
    return { supportLevel: currentLevel, cueFrequency: 'frequent' };
  }
  
  // Then increase support level
  if (currentLevel === 'open') {
    return { supportLevel: 'guided', cueFrequency: 'frequent' };
  }
  if (currentLevel === 'guided') {
    return { supportLevel: 'choice', cueFrequency: 'frequent' };
  }
  
  // Already at max support
  return { supportLevel: 'choice', cueFrequency: 'frequent' };
}

/**
 * Decrease support (make it harder / fade cues)
 */
function decreaseSupport(
  currentLevel: SupportLevel,
  currentCueFreq: 'rare' | 'occasional' | 'frequent'
): { supportLevel: SupportLevel; cueFrequency: 'rare' | 'occasional' | 'frequent' } {
  // First decrease cue frequency
  if (currentCueFreq === 'frequent') {
    return { supportLevel: currentLevel, cueFrequency: 'occasional' };
  }
  if (currentCueFreq === 'occasional') {
    return { supportLevel: currentLevel, cueFrequency: 'rare' };
  }
  
  // Then decrease support level
  if (currentLevel === 'choice') {
    return { supportLevel: 'guided', cueFrequency: 'rare' };
  }
  if (currentLevel === 'guided') {
    return { supportLevel: 'open', cueFrequency: 'rare' };
  }
  
  // Already at minimum support
  return { supportLevel: 'open', cueFrequency: 'rare' };
}

/**
 * Get current success rate
 */
export function getCurrentSuccessRate(state: DifficultyState): number {
  if (state.successWindow.length === 0) return 0.75;
  return state.successWindow.filter(Boolean).length / state.successWindow.length;
}

/**
 * Check if user is in optimal challenge zone
 */
export function isInOptimalZone(state: DifficultyState): boolean {
  const rate = getCurrentSuccessRate(state);
  return rate >= TARGET_SUCCESS_MIN && rate <= TARGET_SUCCESS_MAX;
}

/**
 * Get human-readable description of current support level
 */
export function getSupportLevelDescription(level: SupportLevel): string {
  switch (level) {
    case 'open':
      return 'Open-ended questions, minimal scaffolding';
    case 'guided':
      return 'Some word choices and sentence frames available';
    case 'choice':
      return 'Full scaffolding with word tiles and sentence starters';
  }
}
