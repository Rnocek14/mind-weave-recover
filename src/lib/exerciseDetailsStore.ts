/**
 * Exercise Details Store — sessionStorage-based bridge for exercise signals.
 * 
 * Each exercise saves its structured details (B/M/E, question types, etc.)
 * when it completes. The session summary reads all saved details to feed
 * the Reflection Engine.
 * 
 * Key: `exerciseDetails_<blockIndex>`
 * Format: { exerciseId, details }
 */

const STORAGE_PREFIX = 'exerciseDetails_';

export interface ExerciseDetails {
  exerciseId: string;
  details: Record<string, any>;
}

/** Save exercise-specific details for the current block */
export function saveExerciseDetails(blockIndex: number, exerciseId: string, details: Record<string, any>): void {
  try {
    const data: ExerciseDetails = { exerciseId, details };
    sessionStorage.setItem(`${STORAGE_PREFIX}${blockIndex}`, JSON.stringify(data));
  } catch { /* ignore quota errors */ }
}

/** Read all saved exercise details for the session */
export function readAllExerciseDetails(): Map<number, ExerciseDetails> {
  const result = new Map<number, ExerciseDetails>();
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        const index = parseInt(key.slice(STORAGE_PREFIX.length), 10);
        if (!isNaN(index)) {
          const parsed = JSON.parse(sessionStorage.getItem(key) || '');
          if (parsed?.exerciseId) {
            result.set(index, parsed);
          }
        }
      }
    }
  } catch { /* ignore */ }
  return result;
}

/** Clear all exercise details (call on session start) */
export function clearExerciseDetails(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) keysToRemove.push(key);
  }
  keysToRemove.forEach(k => sessionStorage.removeItem(k));
}
