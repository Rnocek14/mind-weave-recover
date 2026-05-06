/**
 * Cue mapping for Describe & Guess.
 *
 * Pure helpers — used by DescribeGuessExercise to derive cue telemetry from
 * the number of feature-prompt chips surfaced to the patient. Extracted so
 * the mapping rule is unit-testable and cannot silently drift.
 *
 * Rule:
 *   0 prompts        → cueLevel 0, cueTypeGiven 'none'
 *   1 prompt         → cueLevel 1, cueTypeGiven 'semantic'
 *   2 prompts        → cueLevel 2, cueTypeGiven 'semantic'
 *   3+ prompts       → cueLevel 3, cueTypeGiven 'semantic'
 *
 * cueWasEffective:
 *   - null when no cue was given (cueLevel === 0)
 *   - true when cued AND the trial was correct
 *   - false when cued AND the trial was incorrect
 */

export type CueTypeGiven = 'none' | 'semantic';

export interface CueTelemetry {
  cueLevel: 0 | 1 | 2 | 3;
  cueTypeGiven: CueTypeGiven;
  cueWasEffective: boolean | null;
}

export function deriveCueTelemetry(
  promptCount: number,
  isCorrect: boolean,
): CueTelemetry {
  const safe = Math.max(0, Math.floor(promptCount || 0));
  const cueLevel: 0 | 1 | 2 | 3 =
    safe === 0 ? 0 : safe === 1 ? 1 : safe === 2 ? 2 : 3;
  const cueTypeGiven: CueTypeGiven = cueLevel === 0 ? 'none' : 'semantic';
  const cueWasEffective: boolean | null = cueLevel === 0 ? null : isCorrect;
  return { cueLevel, cueTypeGiven, cueWasEffective };
}
