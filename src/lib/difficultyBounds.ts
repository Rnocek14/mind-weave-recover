import type { CapabilityScores } from './capabilityAssessor';

export interface DifficultyBounds {
  /** Lowest difficulty we'll allow the controller to go to */
  floor: number;
  /** Highest difficulty we'll allow the controller to ever reach */
  ceiling: number;
  /** Recommended starting difficulty for this session */
  suggestedStart: number;
}

/**
 * Map capability scores to safe difficulty bounds for an exercise
 * Ensures the adaptive difficulty controller never pushes beyond
 * what the patient can realistically handle
 */
export function getCapabilityDifficultyBounds(
  exerciseId: string,
  scores: CapabilityScores | null
): DifficultyBounds {
  // Default if no capability data yet
  if (!scores) {
    return {
      floor: 1,
      ceiling: 10,
      suggestedStart: 1,
    };
  }

  const { vision, motor, attention } = scores;

  // Calculate average and minimum (weakest link matters most)
  const avg = (vision + motor + attention) / 3;
  const minScore = Math.min(vision, motor, attention);

  let floor = 1;
  let ceiling = 10;
  let suggestedStart = 1;

  // Lower capability → lower ceiling
  // The weakest score determines the ceiling to prevent overload
  if (minScore <= 3) {
    ceiling = 4;
    suggestedStart = 1;
  } else if (minScore <= 5) {
    ceiling = 6;
    suggestedStart = avg >= 5 ? 2 : 1;
  } else if (minScore <= 7) {
    ceiling = 8;
    suggestedStart = avg >= 7 ? 3 : 2;
  } else {
    ceiling = 10;
    suggestedStart = avg >= 8 ? 4 : 3;
  }

  // Exercise-specific adjustments
  // Language-heavy exercises need higher attention capacity
  const isLanguageHeavy =
    exerciseId.includes('naming') ||
    exerciseId.includes('semantic') ||
    exerciseId.includes('sentence') ||
    exerciseId.includes('phrase') ||
    exerciseId.includes('describe') ||
    exerciseId.includes('fix_sentence');

  if (isLanguageHeavy && attention < 5) {
    ceiling = Math.min(ceiling, 5);
    suggestedStart = Math.min(suggestedStart, 2);
  }

  // Motor-heavy exercises need sufficient motor control
  const isMotorHeavy =
    exerciseId.includes('reach') ||
    exerciseId.includes('tap');

  if (isMotorHeavy && motor < 5) {
    ceiling = Math.min(ceiling, 5);
    suggestedStart = Math.min(suggestedStart, 2);
  }

  return { floor, ceiling, suggestedStart };
}

/**
 * Clamp a difficulty level to stay within bounds
 */
export function clampToBounds(level: number, bounds: DifficultyBounds): number {
  return Math.max(bounds.floor, Math.min(bounds.ceiling, level));
}
