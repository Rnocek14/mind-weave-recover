/**
 * Intervention Adapter — Thin layer between ExerciseModalHost results
 * and the Smart Coach session.
 * 
 * Normalizes any exercise result into what the coach needs:
 * - score (0-1)
 * - summary text
 * - skill domain
 * - return bridge text
 */

import type { NormalizedExerciseResult } from '@/lib/normalizedExerciseResult';
import type { GameDefinition } from './gameTrigger';
import { buildGameReturnText } from './gameTrigger';

export interface InterventionResult {
  /** 0-1 */
  score: number;
  /** Human-readable for Maya */
  summary: string;
  /** Exercise slug */
  slug: string;
  /** Domain */
  targetDomain: string;
  /** Text to show when returning to conversation */
  returnText: string;
  /** Whether this was a success */
  success: boolean;
}

/**
 * Convert a NormalizedExerciseResult into what the coach session needs.
 */
export function adaptExerciseResult(
  normalized: NormalizedExerciseResult,
  game: GameDefinition,
  topicId: string,
): InterventionResult {
  const returnText = buildGameReturnText(
    game,
    { score: normalized.score, summary: normalized.summary },
    topicId,
  );

  return {
    score: normalized.score,
    summary: normalized.summary,
    slug: normalized.slug,
    targetDomain: normalized.targetDomain || game.skillTarget,
    returnText,
    success: normalized.score >= 0.5,
  };
}
