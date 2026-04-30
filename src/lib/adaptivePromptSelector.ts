/**
 * Adaptive Prompt Selector for Thought Continuation Game
 * 
 * Rules-based selection using stuck_type + session history.
 * This is the core of "closed-loop" intelligence:
 * - After prompt_overload → pick more constrained prompts
 * - After thought_abandonment → pick resolution-shaped prompts  
 * - After word_search_stall → same theme, lower difficulty
 * - After strong_flow → can increase difficulty
 */

import type { ThoughtPrompt, IntentType, PromptTheme, TimeAnchor } from '@/types/thoughtContinuation';
import type { StuckType } from './stuckTypeClassifier';
import { THOUGHT_PROMPTS, mapDiscourseLevelToPromptTier } from '@/data/thoughtPromptBank';

export interface SessionHistory {
  stuckTypes: StuckType[];
  completionCount: number;
  attemptCount: number;
  avgLatencyMs: number | null;
  narrowingLevelsUsed: number[];
  recentThemes: PromptTheme[];
  recentIntentTypes: IntentType[];
}

export interface PromptSelection {
  prompt: ThoughtPrompt;
  reason: string;
  strategy: SelectionStrategy;
  constraints: SelectionConstraints;
}

export type SelectionStrategy = 
  | 'constrain_after_overload'
  | 'resolution_after_abandonment'  
  | 'same_theme_easier'
  | 'increase_difficulty'
  | 'random_appropriate'
  | 'fallback';

interface SelectionConstraints {
  maxDifficultyTier: number;
  preferredIntentTypes: IntentType[];
  preferredTimeAnchors: TimeAnchor[];
  avoidThemes: PromptTheme[];
}

// Selection rules based on stuck types
const SELECTION_RULES: Record<StuckType, Partial<SelectionConstraints>> = {
  'no_speech': {
    maxDifficultyTier: 1,
    preferredTimeAnchors: ['recent', 'today'],
    preferredIntentTypes: ['describe_feeling', 'express_opinion'],
  },
  'prompt_overload': {
    maxDifficultyTier: 1,
    preferredTimeAnchors: ['recent'],
    preferredIntentTypes: ['describe_feeling', 'recall_recent'],
  },
  'word_search_stall': {
    maxDifficultyTier: 2,
    preferredIntentTypes: ['express_opinion', 'describe_feeling'],
  },
  'thought_abandonment': {
    maxDifficultyTier: 2,
    // Resolution-shaped prompts help complete thoughts
    preferredIntentTypes: ['explain_reason', 'recall_recent'],
  },
  'strong_flow': {
    maxDifficultyTier: 3,
    // No strong preferences - can try anything
  },
};

/**
 * Select the next prompt based on previous stuck type and session history.
 *
 * `discourseLevel` (1..5) is the AUTHORITATIVE engine signal. The selector
 * collapses it to an exact content tier (1..3) and selects ONLY from that
 * tier — never blends across tiers, never silently relaxes the band. Stuck-
 * type rules can still pull cue/intent preferences but cannot escape the
 * tier the engine has chosen. If `discourseLevel` is omitted, the selector
 * falls back to the legacy stuck-type-only `maxDifficultyTier` heuristic
 * (kept for back-compat with callers that don't yet thread the engine).
 */
export function selectNextPrompt(
  previousStuckType: StuckType | null,
  sessionHistory: SessionHistory,
  usedPromptIds: string[] = [],
  discourseLevel?: number,
): PromptSelection {
  const availablePrompts = THOUGHT_PROMPTS.filter(p => !usedPromptIds.includes(p.id));

  if (availablePrompts.length === 0) {
    // Fallback: reuse prompts if we've exhausted the bank
    return selectFromPool(THOUGHT_PROMPTS, null, sessionHistory, 'fallback');
  }

  // Determine selection strategy based on previous attempt
  const strategy = determineStrategy(previousStuckType, sessionHistory);
  const constraints = buildConstraints(previousStuckType, sessionHistory);

  // Engine-tier hard band: when the discourse engine emits a level, that
  // tier is authoritative. Stuck-type rules are NOT allowed to leak content
  // from other tiers (which was the silent blending bug).
  const engineTier = discourseLevel !== undefined
    ? mapDiscourseLevelToPromptTier(discourseLevel)
    : null;

  // Filter prompts by constraints (and enforce the engine tier first)
  let candidatePrompts = availablePrompts;
  if (engineTier !== null) {
    candidatePrompts = candidatePrompts.filter(p => p.difficultyTier === engineTier);
  }
  candidatePrompts = filterByConstraints(candidatePrompts, constraints, /*ignoreDifficulty=*/ engineTier !== null);

  // If preferences were too restrictive within the tier, drop intent/anchor
  // preferences but DO NOT widen the difficulty band.
  if (candidatePrompts.length === 0 && engineTier !== null) {
    candidatePrompts = availablePrompts.filter(p => p.difficultyTier === engineTier);
  }

  // Legacy path (no engine signal): retain old behaviour but guard against
  // the cumulative-blend bug — only relax difficulty by one tier max.
  if (candidatePrompts.length === 0 && engineTier === null) {
    candidatePrompts = availablePrompts.filter(p =>
      p.difficultyTier <= (constraints.maxDifficultyTier + 1)
    );
  }

  // Final safety fallback — never leave the user empty-handed.
  if (candidatePrompts.length === 0) {
    candidatePrompts = availablePrompts;
  }

  return selectFromPool(candidatePrompts, constraints, sessionHistory, strategy);
}

function determineStrategy(
  previousStuckType: StuckType | null,
  sessionHistory: SessionHistory
): SelectionStrategy {
  if (!previousStuckType) {
    return 'random_appropriate';
  }

  // Count recent stuck types
  const recentStuckTypes = sessionHistory.stuckTypes.slice(-3);
  const overloadCount = recentStuckTypes.filter(t => t === 'prompt_overload' || t === 'no_speech').length;
  const abandonmentCount = recentStuckTypes.filter(t => t === 'thought_abandonment').length;

  // Multiple overloads in a row → really constrain
  if (overloadCount >= 2) {
    return 'constrain_after_overload';
  }

  // Based on most recent attempt
  switch (previousStuckType) {
    case 'no_speech':
    case 'prompt_overload':
      return 'constrain_after_overload';
    case 'thought_abandonment':
      return 'resolution_after_abandonment';
    case 'word_search_stall':
      return 'same_theme_easier';
    case 'strong_flow':
      // Check if we've had multiple successes
      const successRate = sessionHistory.completionCount / Math.max(sessionHistory.attemptCount, 1);
      return successRate > 0.7 ? 'increase_difficulty' : 'random_appropriate';
    default:
      return 'random_appropriate';
  }
}

function buildConstraints(
  previousStuckType: StuckType | null,
  sessionHistory: SessionHistory
): SelectionConstraints {
  const baseConstraints: SelectionConstraints = {
    maxDifficultyTier: 2,
    preferredIntentTypes: [],
    preferredTimeAnchors: [],
    avoidThemes: [],
  };

  // Apply stuck-type specific rules
  if (previousStuckType && SELECTION_RULES[previousStuckType]) {
    Object.assign(baseConstraints, SELECTION_RULES[previousStuckType]);
  }

  // Avoid recently used themes for variety
  if (sessionHistory.recentThemes.length > 0) {
    baseConstraints.avoidThemes = sessionHistory.recentThemes.slice(-2);
  }

  // If lots of narrowing was needed, stay easy
  const avgNarrowing = sessionHistory.narrowingLevelsUsed.length > 0
    ? sessionHistory.narrowingLevelsUsed.reduce((a, b) => a + b, 0) / sessionHistory.narrowingLevelsUsed.length
    : 0;
  
  if (avgNarrowing > 1) {
    baseConstraints.maxDifficultyTier = Math.min(baseConstraints.maxDifficultyTier, 1);
  }

  return baseConstraints;
}

function filterByConstraints(
  prompts: ThoughtPrompt[],
  constraints: SelectionConstraints
): ThoughtPrompt[] {
  return prompts.filter(prompt => {
    // Check difficulty
    if (prompt.difficultyTier > constraints.maxDifficultyTier) {
      return false;
    }

    // Check avoided themes
    if (constraints.avoidThemes.includes(prompt.theme)) {
      return false;
    }

    // Check preferred intent types (if specified)
    if (
      constraints.preferredIntentTypes.length > 0 &&
      !constraints.preferredIntentTypes.includes(prompt.intentType)
    ) {
      return false;
    }

    // Check preferred time anchors (if specified)
    if (
      constraints.preferredTimeAnchors.length > 0 &&
      prompt.timeAnchor &&
      !constraints.preferredTimeAnchors.includes(prompt.timeAnchor)
    ) {
      return false;
    }

    return true;
  });
}

function selectFromPool(
  candidates: ThoughtPrompt[],
  constraints: SelectionConstraints | null,
  sessionHistory: SessionHistory,
  strategy: SelectionStrategy
): PromptSelection {
  // Score candidates
  const scored = candidates.map(prompt => ({
    prompt,
    score: scorePrompt(prompt, constraints, sessionHistory, strategy)
  }));

  // Sort by score and pick from top candidates (with some randomness)
  scored.sort((a, b) => b.score - a.score);
  
  // Pick from top 3 to add variety
  const topCandidates = scored.slice(0, Math.min(3, scored.length));
  const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)];

  return {
    prompt: selected.prompt,
    reason: buildReason(strategy, selected.prompt, constraints),
    strategy,
    constraints: constraints || {
      maxDifficultyTier: 3,
      preferredIntentTypes: [],
      preferredTimeAnchors: [],
      avoidThemes: [],
    }
  };
}

function scorePrompt(
  prompt: ThoughtPrompt,
  constraints: SelectionConstraints | null,
  sessionHistory: SessionHistory,
  strategy: SelectionStrategy
): number {
  let score = 50; // Base score

  // Prefer lower difficulty when constrained
  if (strategy === 'constrain_after_overload') {
    score += (3 - prompt.difficultyTier) * 10;
  }

  // Prefer resolution-shaped prompts after abandonment
  if (strategy === 'resolution_after_abandonment' && prompt.intentType === 'explain_reason') {
    score += 20;
  }

  // Prefer prompts with good narrowing steps
  if (prompt.narrowingSteps && prompt.narrowingSteps.length >= 2) {
    score += 10;
  }

  // Slight preference for prompts with time anchors (more concrete)
  if (prompt.timeAnchor === 'recent') {
    score += 5;
  }

  // Avoid themes used in last 2 attempts
  if (sessionHistory.recentThemes.includes(prompt.theme)) {
    score -= 15;
  }

  // Variety bonus for different intent types
  if (!sessionHistory.recentIntentTypes.includes(prompt.intentType)) {
    score += 5;
  }

  return score;
}

function buildReason(
  strategy: SelectionStrategy,
  prompt: ThoughtPrompt,
  constraints: SelectionConstraints | null
): string {
  const reasons: Record<SelectionStrategy, string> = {
    'constrain_after_overload': `Selected easier prompt (tier ${prompt.difficultyTier}) after difficulty with previous prompt`,
    'resolution_after_abandonment': `Selected resolution-shaped prompt to help complete thoughts`,
    'same_theme_easier': `Selected lower difficulty in similar domain`,
    'increase_difficulty': `Increased difficulty after successful completions`,
    'random_appropriate': `Selected appropriate prompt for current session state`,
    'fallback': `Fallback selection from available prompts`,
  };

  return reasons[strategy] || 'Selected prompt';
}

/**
 * Build initial session history for first prompt
 */
export function createEmptySessionHistory(): SessionHistory {
  return {
    stuckTypes: [],
    completionCount: 0,
    attemptCount: 0,
    avgLatencyMs: null,
    narrowingLevelsUsed: [],
    recentThemes: [],
    recentIntentTypes: [],
  };
}

/**
 * Update session history after an attempt
 */
export function updateSessionHistory(
  history: SessionHistory,
  stuckType: StuckType,
  latencyMs: number | null,
  narrowingLevel: number,
  theme: PromptTheme,
  intentType: IntentType,
  utteranceComplete: boolean
): SessionHistory {
  const newHistory = { ...history };
  
  newHistory.stuckTypes = [...history.stuckTypes, stuckType];
  newHistory.attemptCount += 1;
  
  if (utteranceComplete && stuckType === 'strong_flow') {
    newHistory.completionCount += 1;
  }
  
  if (latencyMs !== null) {
    const prevTotal = (history.avgLatencyMs || 0) * (history.attemptCount - 1);
    newHistory.avgLatencyMs = (prevTotal + latencyMs) / history.attemptCount;
  }
  
  newHistory.narrowingLevelsUsed = [...history.narrowingLevelsUsed, narrowingLevel];
  newHistory.recentThemes = [...history.recentThemes.slice(-4), theme];
  newHistory.recentIntentTypes = [...history.recentIntentTypes.slice(-4), intentType];
  
  return newHistory;
}
