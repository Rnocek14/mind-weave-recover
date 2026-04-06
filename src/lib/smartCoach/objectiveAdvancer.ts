/**
 * Smart Coach — Objective Advancer
 * 
 * Evaluates whether the current clinical objective has been met
 * and manages progression through the playbook.
 * 
 * Design principle: LOOSE evaluation. Don't require exact language.
 * Mark objective complete if the user substantially demonstrates the target.
 */

import type { CoachState } from './types';
import type { ClinicalPlaybook, TurnObjective, ObjectiveDefinition } from './clinicalPlaybooks';

// ─── Types ───────────────────────────────────────────────────

export interface ObjectiveProgress {
  currentIndex: number;
  objectiveId: TurnObjective;
  turnsOnObjective: number;
  /** Whether this objective has been sufficiently met */
  satisfied: boolean;
  /** Whether we should advance to next objective */
  shouldAdvance: boolean;
  /** If tangent redirect is needed */
  needsRedirect: boolean;
  /** The prompt instruction to inject for this objective */
  objectivePrompt: string;
}

// ─── Constants ───────────────────────────────────────────────

/** Max turns on any single objective before forced advancement */
const MAX_TURNS_PER_OBJECTIVE = 3;

/** Minimum word count that counts as a "meaningful" response */
const MEANINGFUL_WORD_COUNT = 2;

// ─── Core Functions ──────────────────────────────────────────

/**
 * Get the current objective definition from the playbook
 */
export function getCurrentObjective(
  objectiveIndex: number,
  playbook: ClinicalPlaybook
): ObjectiveDefinition {
  const clamped = Math.min(objectiveIndex, playbook.objectives.length - 1);
  return playbook.objectives[clamped];
}

/**
 * Evaluate whether the user's response satisfies the current objective.
 * Uses LOOSE matching — we don't require exact phrases.
 */
export function evaluateObjectiveProgress(
  userUtterance: string,
  state: CoachState,
  playbook: ClinicalPlaybook
): ObjectiveProgress {
  const idx = state.currentObjectiveIndex ?? 0;
  const objective = getCurrentObjective(idx, playbook);
  const turnsOnObj = state.objectiveProgress?.turnsOnObjective ?? 0;
  const wordCount = userUtterance.trim().split(/\s+/).filter(Boolean).length;

  // Check satisfaction loosely
  const satisfied = checkSatisfaction(userUtterance, wordCount, objective, state);

  // Should advance if satisfied OR we've spent too long
  const shouldAdvance = satisfied || turnsOnObj >= MAX_TURNS_PER_OBJECTIVE;

  // Check tangent
  const needsRedirect = shouldRedirectSubtopic(state, playbook);

  // Build prompt instruction
  const objectivePrompt = buildObjectivePrompt(objective, state, playbook, needsRedirect);

  return {
    currentIndex: idx,
    objectiveId: objective.id,
    turnsOnObjective: turnsOnObj,
    satisfied,
    shouldAdvance,
    needsRedirect,
    objectivePrompt,
  };
}

/**
 * Advance to the next objective index (capped at playbook length)
 */
export function advanceObjective(state: CoachState, playbook: ClinicalPlaybook): Partial<CoachState> {
  const currentIdx = state.currentObjectiveIndex ?? 0;
  const nextIdx = Math.min(currentIdx + 1, playbook.objectives.length - 1);
  return {
    currentObjectiveIndex: nextIdx,
    objectiveProgress: {
      turnsOnObjective: 0,
      lastObjectiveId: playbook.objectives[nextIdx].id,
    },
    subtopicDepth: 0, // Reset tangent tracking on new objective
  };
}

/**
 * Increment turns on current objective (call each turn)
 */
export function tickObjective(state: CoachState): Partial<CoachState> {
  return {
    objectiveProgress: {
      ...state.objectiveProgress,
      turnsOnObjective: (state.objectiveProgress?.turnsOnObjective ?? 0) + 1,
    },
  };
}

/**
 * Check if we need to redirect from a tangent
 */
export function shouldRedirectSubtopic(state: CoachState, playbook: ClinicalPlaybook): boolean {
  const depth = state.subtopicDepth ?? 0;
  return depth >= playbook.maxSubtopicDepth;
}

/**
 * Track subtopic depth — call when the same sub-detail continues
 */
export function trackSubtopic(state: CoachState, currentSubtopic: string): Partial<CoachState> {
  if (state.currentSubtopic === currentSubtopic) {
    return {
      subtopicDepth: (state.subtopicDepth ?? 0) + 1,
    };
  }
  // New subtopic — reset depth
  return {
    currentSubtopic: currentSubtopic,
    subtopicDepth: 1,
  };
}

/**
 * Check if we should force a transfer check before wrapup.
 * Transfer must always happen, even if imperfect.
 */
export function shouldForceTransfer(state: CoachState, playbook: ClinicalPlaybook, maxTurns: number): boolean {
  const currentIdx = state.currentObjectiveIndex ?? 0;
  const transferIdx = playbook.objectives.findIndex(o => o.id === 'transfer_check');
  const turnsLeft = maxTurns - state.turnCount;

  // Force transfer if we haven't reached it and only 2 turns left
  return transferIdx >= 0 && currentIdx < transferIdx && turnsLeft <= 2;
}

// ─── Internal Helpers ────────────────────────────────────────

function checkSatisfaction(
  utterance: string,
  wordCount: number,
  objective: ObjectiveDefinition,
  state: CoachState
): boolean {
  const lower = utterance.toLowerCase();

  // Global gate: disengagement fillers never satisfy any objective
  const DISENGAGE = /^(okay|ok|yep|yup|ya|yeah|sure|thank you|thanks|alright|right|cool|fine|got it|mhm|uh huh|sounds good|i guess|whatever)\.{0,3}$/i;
  if (DISENGAGE.test(lower)) return false;

  switch (objective.id) {
    case 'warmup_anchor':
      // Any content word = satisfied
      return wordCount >= 1 && lower !== '(silence)';

    case 'elicit_core_content':
      // Need 2+ content words AND some semantic relevance
      return wordCount >= 2 && !DISENGAGE.test(lower);

    case 'organize_or_expand': {
      const hasSequenceWords = /\b(first|then|after|before|next|later|and then)\b/i.test(lower);
      const hasPhrase = wordCount >= 3;
      return hasSequenceWords || hasPhrase;
    }

    case 'sentence_level_production':
      return wordCount >= 4;

    case 'transfer_check':
      return wordCount >= 2;

    case 'wrapup_reflection':
      return true;

    default:
      return wordCount >= MEANINGFUL_WORD_COUNT;
  }
}

function buildObjectivePrompt(
  objective: ObjectiveDefinition,
  state: CoachState,
  playbook: ClinicalPlaybook,
  needsRedirect: boolean
): string {
  const parts: string[] = [];

  // Objective instruction
  switch (objective.id) {
    case 'warmup_anchor':
      parts.push(`CURRENT OBJECTIVE: Get the user to name one item/person/activity related to ${playbook.topicId}. Keep it easy and low-pressure.`);
      break;
    case 'elicit_core_content':
      parts.push(`CURRENT OBJECTIVE: Expand from the initial item into details (type, ingredients, people, places). Get at least 2 content words. Do NOT drill into one sub-detail for more than 1 turn.`);
      break;
    case 'organize_or_expand':
      parts.push(`CURRENT OBJECTIVE: Move from single words into short functional phrases. ${
        playbook.topicId === 'daily_routine'
          ? 'Get the user to use ordering words like "first", "then", "after that".'
          : 'Get the user to combine item + detail in one phrase.'
      }`);
      break;
    case 'sentence_level_production':
      parts.push(`CURRENT OBJECTIVE: Get a full sentence from the user. Frame it as a real-world scenario: ordering, introducing, describing. Do NOT ask for rote repetition.`);
      break;
    case 'transfer_check':
      parts.push(`CURRENT OBJECTIVE: Test real-world transfer. Ask how they would say this in a real situation (to a server, to a friend, to family). This is the most important objective.`);
      break;
    case 'wrapup_reflection':
      parts.push(`CURRENT OBJECTIVE: Wrap up. Name 1-2 specific words/phrases the user produced well (use their EXACT words). Connect to real-world use. No new questions.`);
      break;
  }

  // Skill-specific elicitation hints
  if (objective.elicitationPrompts.length > 0) {
    const sample = objective.elicitationPrompts[Math.floor(Math.random() * objective.elicitationPrompts.length)];
    parts.push(`Example question style: "${sample}"`);
  }

  // Tangent redirect instruction
  if (needsRedirect && objective.redirectPrompts.length > 0) {
    const redirect = objective.redirectPrompts[Math.floor(Math.random() * objective.redirectPrompts.length)];
    parts.push(`TANGENT REDIRECT NEEDED: The user has been on a sub-detail too long. Acknowledge briefly, then redirect. Example: "${redirect}"`);
  } else if (needsRedirect) {
    const template = playbook.tangentRedirectTemplates[Math.floor(Math.random() * playbook.tangentRedirectTemplates.length)];
    parts.push(`TANGENT REDIRECT NEEDED: Acknowledge the detail briefly, then redirect back to the main objective. Example: "${template}"`);
  }

  return parts.join('\n');
}
