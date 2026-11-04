/**
 * Cue mapping for Describe & Guess.
 *
 * Pure helpers — used by DescribeGuessExercise to derive cue telemetry from
 * the number of spoken feature prompts the patient explicitly REQUESTED.
 * Merely displaying the persistent strategy guide is not a cue.
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

/**
 * The Describe & Guess help questions are ALL semantic prompts.
 * More than one semantic question is not a phonemic cue or a full model,
 * even if cueLevel 2/3 expresses greater support dependence.
 */
export function semanticPromptSupport(cueLevel: number): 'independent' | 'semantic_cue' {
  return cueLevel > 0 ? 'semantic_cue' : 'independent';
}
