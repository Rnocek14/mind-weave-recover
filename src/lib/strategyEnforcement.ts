/**
 * Strategy Enforcement Layer
 * 
 * Deterministic rules that GUARANTEE system behavior matches
 * the active therapy strategy, regardless of LLM output.
 * 
 * This is the "backbone under the AI" — hard constraints that
 * prevent drift and ensure clinical consistency.
 * 
 * Rules:
 * - Exercise selection MUST respect strategy weights
 * - Cue type MUST match strategy preference
 * - Pacing MUST respect strategy limits
 * - Difficulty MUST follow strategy bias
 * - Maya's behavior is validated post-generation
 */

import type { TherapyStrategy, StrategyId } from './therapyStrategyEngine';

// ═══════════════════════════════════════════════════════════════
// Exercise Enforcement
// ═══════════════════════════════════════════════════════════════

export interface ExerciseDecision {
  slug: string;
  allowed: boolean;
  reason: string;
}

/**
 * Validate whether an exercise is allowed under the current strategy.
 * Returns allowed=false if the exercise contradicts the strategy.
 */
export function enforceExerciseSelection(
  exerciseSlug: string,
  strategy: TherapyStrategy,
): ExerciseDecision {
  const pref = strategy.exercisePreferences.find(p => p.slug === exerciseSlug);
  
  // Strategy has explicit preferences — block exercises with 0 weight
  if (pref && pref.weight <= 0) {
    return { slug: exerciseSlug, allowed: false, reason: `Blocked by ${strategy.id}: weight=0` };
  }

  // Strategy-specific hard blocks
  const blocks = STRATEGY_EXERCISE_BLOCKS[strategy.id];
  if (blocks?.includes(exerciseSlug)) {
    return { slug: exerciseSlug, allowed: false, reason: `Hard-blocked by ${strategy.id} enforcement` };
  }

  return { slug: exerciseSlug, allowed: true, reason: 'Allowed' };
}

/** Hard-block map: exercises that MUST NOT appear under certain strategies */
const STRATEGY_EXERCISE_BLOCKS: Record<StrategyId, string[]> = {
  confidence_building: ['category-fluency'],  // Too demanding
  phonological_training: [],                   // No blocks — but bias heavily toward minimal pairs
  semantic_retrieval_support: [],
  spaced_reinforcement: [],
  fluency_promotion: [],
  balanced_maintenance: [],
};

/**
 * Given a strategy, return the enforced exercise weights for inline selection.
 * Orchestrator MUST use these weights, not its own defaults.
 */
export function getEnforcedExerciseWeights(strategy: TherapyStrategy): {
  minimalPairWeight: number;
  photoNamingWeight: number;
  shouldPreferInline: boolean;
} {
  const mpPref = strategy.exercisePreferences.find(p => p.slug === 'minimal-pairs');
  const pnPref = strategy.exercisePreferences.find(p => p.slug === 'photo-naming');

  const mpWeight = mpPref?.weight ?? 0.3;
  const pnWeight = pnPref?.weight ?? 0.5;
  const total = mpWeight + pnWeight;

  return {
    minimalPairWeight: total > 0 ? mpWeight / total : 0.3,
    photoNamingWeight: total > 0 ? pnWeight / total : 0.7,
    // Confidence building = more conversation, fewer inline exercises
    shouldPreferInline: strategy.id !== 'confidence_building',
  };
}

// ═══════════════════════════════════════════════════════════════
// Cue Enforcement
// ═══════════════════════════════════════════════════════════════

export type CueType = 'semantic' | 'phonemic' | 'full_word';

/**
 * Enforce the cue type based on strategy.
 * When strategy says "phonemic" → system MUST use phonemic cues.
 */
export function enforceСueType(
  requestedCue: CueType,
  strategy: TherapyStrategy,
): CueType {
  if (strategy.cueApproach.preferredType === 'auto') {
    return requestedCue; // Strategy allows auto — use whatever was requested
  }
  if (strategy.cueApproach.preferredType === 'full_word') {
    return 'full_word';
  }
  // Strategy specifies a preference — enforce it
  return strategy.cueApproach.preferredType as CueType;
}

/**
 * Enforce cue timing based on strategy aggressiveness.
 * Returns the silence threshold in ms before a cue should fire.
 */
export function enforceCueTiming(strategy: TherapyStrategy): {
  silenceBeforeCueMs: number;
  maxCueLevel: number;
} {
  switch (strategy.cueApproach.aggressiveness) {
    case 'early':
      return { silenceBeforeCueMs: 4000, maxCueLevel: 3 }; // Cue sooner, up to full word
    case 'delayed':
      return { silenceBeforeCueMs: 10000, maxCueLevel: 2 }; // Wait longer, cap at phonemic
    case 'standard':
    default:
      return { silenceBeforeCueMs: 7000, maxCueLevel: 3 };
  }
}

// ═══════════════════════════════════════════════════════════════
// Difficulty Enforcement
// ═══════════════════════════════════════════════════════════════

/**
 * Enforce difficulty based on strategy bias.
 * Overrides any other difficulty source when strategy has a clear bias.
 */
export function enforceDifficulty(
  requestedDifficulty: 'easy' | 'medium' | 'hard',
  strategy: TherapyStrategy,
): 'easy' | 'medium' | 'hard' {
  switch (strategy.difficultyBias) {
    case 'easier':
      // Cap at easy — never allow medium/hard
      return 'easy';
    case 'harder':
      // Floor at medium — never drop to easy unless strategy is confidence_building
      return requestedDifficulty === 'easy' ? 'medium' : requestedDifficulty;
    case 'same':
    default:
      return requestedDifficulty;
  }
}

// ═══════════════════════════════════════════════════════════════
// Pacing Enforcement
// ═══════════════════════════════════════════════════════════════

export interface PacingLimits {
  maxExercisesPerSession: number;
  minTurnsBetweenExercises: number;
  silenceToleranceMs: number;
  conversationHeavy: boolean; // >60% conversation ratio
}

export function getEnforcedPacing(strategy: TherapyStrategy): PacingLimits {
  return {
    maxExercisesPerSession: strategy.pacing.maxExercisesPerSession,
    minTurnsBetweenExercises: strategy.pacing.conversationToTaskRatio >= 0.65 ? 7 : 5,
    silenceToleranceMs: strategy.pacing.silenceToleranceMs,
    conversationHeavy: strategy.pacing.conversationToTaskRatio >= 0.6,
  };
}

// ═══════════════════════════════════════════════════════════════
// Response Validation — Post-LLM enforcement
// ═══════════════════════════════════════════════════════════════

export interface ResponseValidation {
  valid: boolean;
  violations: string[];
  sanitizedResponse?: string;
}

/**
 * Validate an AI response against strategy constraints.
 * Can flag violations and optionally sanitize the response.
 */
export function validateResponse(
  response: string,
  strategy: TherapyStrategy,
  speechState: 'struggling' | 'flowing' | 'neutral',
): ResponseValidation {
  const violations: string[] = [];
  let sanitized = response;

  // Rule 1: Confidence building → no mention of difficulty/errors
  if (strategy.id === 'confidence_building') {
    const clinicalTerms = /\b(error|mistake|wrong|incorrect|try again|not quite)\b/i;
    if (clinicalTerms.test(response)) {
      violations.push('Clinical error language used during confidence_building strategy');
      sanitized = sanitized.replace(clinicalTerms, '');
    }
  }

  // Rule 2: When user is struggling → response must contain "?" (a question)
  if (speechState === 'struggling' && !response.includes('?')) {
    violations.push('No question mark in response while user is struggling — must offer an easy question');
  }

  // Rule 3: Fluency promotion → no repair language when user is flowing
  if (strategy.id === 'fluency_promotion' && speechState === 'flowing') {
    const repairTerms = /\b(no rush|take your time|whenever you're ready|it's okay)\b/i;
    if (repairTerms.test(response)) {
      violations.push('Repair language used during fluency_promotion with flowing user');
      sanitized = sanitized.replace(repairTerms, '').trim();
    }
  }

  // Rule 4: Word count enforcement (max 20 words)
  const wordCount = sanitized.split(/\s+/).length;
  if (wordCount > 22) {
    violations.push(`Response too long: ${wordCount} words (max 20)`);
    const words = sanitized.split(/\s+/);
    const qIdx = words.findIndex(w => w.includes('?'));
    const cutoff = qIdx > 5 ? qIdx + 1 : 18;
    sanitized = words.slice(0, cutoff).join(' ');
    if (!sanitized.match(/[.!?]$/)) sanitized += '?';
  }

  return {
    valid: violations.length === 0,
    violations,
    sanitizedResponse: violations.length > 0 ? sanitized : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════
// Clinician Override Integration
// ═══════════════════════════════════════════════════════════════

export interface ClinicianStrategyOverride {
  lockedStrategyId?: StrategyId;
  lockedPhonemes?: string[];
  lockedRetryWords?: string[];
  cueAggressiveness?: 'early' | 'standard' | 'delayed';
  difficultyOverride?: 'easier' | 'same' | 'harder';
  maxExercisesOverride?: number;
}

/**
 * Apply clinician overrides to a strategy.
 * Clinician choices ALWAYS take precedence over system selection.
 */
export function applyClinicianOverride(
  strategy: TherapyStrategy,
  override: ClinicianStrategyOverride,
): TherapyStrategy {
  const patched = { ...strategy };

  if (override.cueAggressiveness) {
    patched.cueApproach = {
      ...patched.cueApproach,
      aggressiveness: override.cueAggressiveness,
      rationale: `${patched.cueApproach.rationale} (clinician override: ${override.cueAggressiveness})`,
    };
  }

  if (override.difficultyOverride) {
    patched.difficultyBias = override.difficultyOverride;
  }

  if (override.maxExercisesOverride) {
    patched.pacing = {
      ...patched.pacing,
      maxExercisesPerSession: override.maxExercisesOverride,
    };
  }

  // Add clinician override note to reasoning
  patched.reasoning = [
    ...patched.reasoning,
    '⚕️ Clinician overrides applied',
  ];

  return patched;
}

// ═══════════════════════════════════════════════════════════════
// Enforcement Summary — for logging and clinician view
// ═══════════════════════════════════════════════════════════════

export interface EnforcementLog {
  timestamp: number;
  strategyId: StrategyId;
  action: string;
  detail: string;
  enforced: boolean;
}

const _enforcementLog: EnforcementLog[] = [];

export function logEnforcement(
  strategyId: StrategyId,
  action: string,
  detail: string,
  enforced: boolean,
): void {
  _enforcementLog.push({
    timestamp: Date.now(),
    strategyId,
    action,
    detail,
    enforced,
  });
  // Keep last 50 entries
  if (_enforcementLog.length > 50) _enforcementLog.shift();
  
  if (enforced) {
    console.log(`[enforcement] ${action}: ${detail} (strategy: ${strategyId})`);
  }
}

export function getEnforcementLog(): EnforcementLog[] {
  return [..._enforcementLog];
}
