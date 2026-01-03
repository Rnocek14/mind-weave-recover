/**
 * Conversation Partner Follow-up System
 * 
 * Uses a label→canned response pattern to prevent LLM drift.
 * GPT returns only a FOLLOWUP_TYPE label, and we map it to pre-approved lines.
 */

import { StuckType } from './stuckTypeClassifier';

// Follow-up types the AI can select
export type FollowupType = 
  | 'what_next'       // Ask what happened next
  | 'what_did'        // Ask what they did about it
  | 'how_felt'        // Ask about feeling/reaction
  | 'tell_more'       // Simple continuation
  | 'clarify_small'   // Narrow down to smaller detail
  | 'acknowledge'     // Just acknowledge, no question
  | 'wrap_up';        // End the conversation warmly

// Pre-approved follow-up lines for each type
const FOLLOWUP_LINES: Record<FollowupType, string[]> = {
  what_next: [
    "What happened next?",
    "And then?",
    "What came after that?",
  ],
  what_did: [
    "What did you do about it?",
    "How did you handle that?",
    "What did you do then?",
  ],
  how_felt: [
    "How did that feel?",
    "What was that like?",
  ],
  tell_more: [
    "Tell me more.",
    "Go on...",
    "Keep going.",
  ],
  clarify_small: [
    "Just one small part of that.",
    "Pick one thing from that.",
    "What's one detail you remember?",
  ],
  acknowledge: [
    "Got it.",
    "Makes sense.",
    "Okay.",
    "I see.",
  ],
  wrap_up: [
    "That's enough for today. Nice talking.",
    "Good conversation. Let's stop there.",
    "That was great. We're done for now.",
  ],
};

// Nudges for silence (not follow-ups, just encouragement)
export const SILENCE_NUDGES = [
  "Take your time.",
  "No rush.",
  "Whenever you're ready.",
];

// Narrow prompts for extended silence
export const NARROWING_PROMPTS = [
  "How about just one word that comes to mind?",
  "Even a short answer is fine.",
  "Just tell me any small thing.",
];

/**
 * Get a random line for a follow-up type
 */
export function getFollowupLine(type: FollowupType): string {
  const lines = FOLLOWUP_LINES[type];
  return lines[Math.floor(Math.random() * lines.length)];
}

/**
 * Get a random silence nudge
 */
export function getSilenceNudge(): string {
  return SILENCE_NUDGES[Math.floor(Math.random() * SILENCE_NUDGES.length)];
}

/**
 * Get a narrowing prompt for extended silence
 */
export function getNarrowingPrompt(): string {
  return NARROWING_PROMPTS[Math.floor(Math.random() * NARROWING_PROMPTS.length)];
}

/**
 * Conversation opener prompts - narrow, time-anchored
 */
export const CONVERSATION_OPENERS = [
  "Tell me one small thing from this morning.",
  "What was something you ate today?",
  "Tell me about one thing you saw recently.",
  "What's something slightly annoying that happened lately?",
  "What did you do after waking up today?",
  "Tell me about something you're looking forward to.",
  "What's one thing you noticed today?",
  "Tell me about something simple you did yesterday.",
];

/**
 * Get a random conversation opener
 */
export function getRandomOpener(): string {
  return CONVERSATION_OPENERS[Math.floor(Math.random() * CONVERSATION_OPENERS.length)];
}

/**
 * Rule-based follow-up selection based on stuck type and turn count
 * This is a fallback if GPT doesn't respond or for offline mode
 */
export function selectFollowupByRule(
  stuckType: StuckType,
  turnNumber: number,
  maxTurns: number
): FollowupType {
  // Last turn always wraps up
  if (turnNumber >= maxTurns) {
    return 'wrap_up';
  }

  // Select based on stuck type
  switch (stuckType) {
    case 'no_speech':
      // They didn't speak - try to narrow
      return 'clarify_small';
    
    case 'prompt_overload':
      // Prompt was too broad - narrow down
      return 'clarify_small';
    
    case 'word_search_stall':
      // They're trying but stuck - just acknowledge and continue
      return turnNumber === 1 ? 'tell_more' : 'acknowledge';
    
    case 'thought_abandonment':
      // They started but trailed off - ask follow-up
      return turnNumber === 1 ? 'what_next' : 'what_did';
    
    case 'strong_flow':
      // They did well - ask a natural follow-up
      return turnNumber === 1 ? 'what_next' : 'how_felt';
    
    default:
      return 'tell_more';
  }
}

/**
 * Valid follow-up types for GPT prompt
 */
export const VALID_FOLLOWUP_TYPES = Object.keys(FOLLOWUP_LINES) as FollowupType[];

/**
 * Parse GPT's response to extract a follow-up type
 */
export function parseFollowupType(gptResponse: string): FollowupType {
  const normalized = gptResponse.toLowerCase().trim();
  
  for (const type of VALID_FOLLOWUP_TYPES) {
    if (normalized.includes(type)) {
      return type;
    }
  }
  
  // Default fallback
  return 'tell_more';
}
