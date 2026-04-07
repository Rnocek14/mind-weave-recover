/**
 * Exercise Result Bridge
 * 
 * Stores exercise results in sessionStorage before navigating back to SmartCoach.
 * This avoids the race condition where exercise-complete events fire before 
 * SmartCoach remounts and registers its listener.
 */

export interface ExerciseResultPayload {
  exerciseSlug: string;
  score: number;
  accuracy?: number;
  targetWords?: string[];
  difficultyReached?: number;
}

/**
 * Store exercise results for SmartCoach to read on restore.
 * Call this BEFORE dispatching exercise-complete or navigating.
 */
export function storeExerciseResultForCoach(payload: ExerciseResultPayload): void {
  try {
    sessionStorage.setItem('smartCoachExerciseResult', JSON.stringify(payload));
  } catch (e) {
    console.warn('[ExerciseResultBridge] Failed to store result:', e);
  }
}

/**
 * Check if this exercise was launched from SmartCoach.
 * Returns true if smartCoachState exists in sessionStorage.
 */
export function isFromSmartCoach(): boolean {
  return sessionStorage.getItem('smartCoachState') !== null;
}
