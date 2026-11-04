/**
 * Exact clinical content selection for Finish the Thought.
 * Uses existing, adult-authored prompts: no L1→L8 generic engine
 * repooling and no fallback into unrelated intent or difficulty tiers.
 */
import { THOUGHT_PROMPTS } from '@/data/thoughtPromptBank';
import type { ThoughtPrompt } from '@/types/thoughtContinuation';
import { getGradedTaskSpec } from './gradedTaskLevels';

export function getClinicalThoughtPromptPool(level: number): ThoughtPrompt[] {
  const spec = getGradedTaskSpec('thought-continuation', level);
  const intents = new Set(spec.thoughtIntent ?? []);
  return THOUGHT_PROMPTS.filter(p =>
    p.isActive && p.difficultyTier === spec.tier &&
    (intents.size === 0 || intents.has(p.intentType)),
  );
}

/** Exhausted current-session options may repeat within SAME clinical band
 * only. No patient silently receives another level's task. */
export function selectClinicalThoughtPrompt(level: number, usedIds: readonly string[]): ThoughtPrompt | null {
  const pool = getClinicalThoughtPromptPool(level);
  const fresh = pool.filter(p => !usedIds.includes(p.id));
  const eligible = fresh.length > 0 ? fresh : pool;
  return eligible.length ? eligible[Math.floor(Math.random() * eligible.length)] : null;
}
