/**
 * Conversation Partner Follow-up System
 * 
 * Uses a label→canned response pattern to prevent LLM drift.
 * GPT returns only a FOLLOWUP_TYPE label, and we map it to pre-approved lines.
 * 
 * KEY PRINCIPLE: Every response invites continuation - NO dead-ends.
 */

import { StuckType } from './stuckTypeClassifier';

// Follow-up types the AI can select
export type FollowupType = 
  | 'what_next'       // Ask what happened next
  | 'what_did'        // Ask what they did about it
  | 'how_felt'        // Ask about feeling/reaction
  | 'tell_more'       // Simple continuation
  | 'clarify_small'   // Narrow down to smaller detail
  | 'acknowledge'     // Acknowledge WITH continuation (never dead-end)
  | 'wrap_up';        // End the conversation warmly

// Pre-approved follow-up lines - ALL invite continuation (no dead-ends!)
const FOLLOWUP_LINES: Record<FollowupType, string[]> = {
  what_next: [
    "What happened next?",
    "And then?",
    "What came after that?",
    "Oh, then what?",
    "What happened after?",
  ],
  what_did: [
    "What did you do about it?",
    "How did you handle that?",
    "What did you do then?",
    "So what did you do?",
  ],
  how_felt: [
    "How did that feel?",
    "What was that like?",
    "How was that for you?",
    "Did you like it?",
  ],
  tell_more: [
    "Tell me more.",
    "Go on...",
    "Keep going, I'm listening.",
    "What else?",
    "And?",
    "Tell me more about that.",
    "I'm listening.",
    "Keep going.",
  ],
  clarify_small: [
    "Just one small part of that.",
    "Pick one thing from that.",
    "What's one detail you remember?",
    "Start with just one thing.",
    "Any one thing is fine.",
    "Even one word works.",
    "What's the first thing that comes to mind?",
    "Just say whatever pops up.",
    "One little thing — anything.",
    "Think of just one moment.",
    "What's one word for it?",
    "Start small — one thing.",
  ],
  // CRITICAL: acknowledge now uses peer-level, natural language (no "Nice!" spam)
  acknowledge: [
    "Mm-hmm. And?",
    "Right, right. Go on.",
    "Got it. What else?",
    "Okay. Then what?",
    "Makes sense. And then?",
    "Yeah? Tell me more.",
    "Ah, okay. Keep going.",
    "Oh really? What happened?",
    "I see. And?",
    "Got it, got it. Then?",
    "Okay, okay. What's next?",
    "Hmm. And then what?",
  ],
  wrap_up: [
    "Great chat! Talk again soon.",
    "Good conversation. Let's stop there.",
    "That was nice. We're done for now.",
    "Thanks for chatting! See you next time.",
  ],
};

// Nudges for silence (not follow-ups, just encouragement)
export const SILENCE_NUDGES = [
  "Take your time.",
  "No rush.",
  "Whenever you're ready.",
  "It's okay, think about it.",
];

// Narrow prompts for extended silence
export const NARROWING_PROMPTS = [
  "How about just one word that comes to mind?",
  "Even a short answer is fine.",
  "Just tell me any small thing.",
  "Any word at all is good.",
];

/**
 * Get a random line for a follow-up type
 */
export function getFollowupLine(type: FollowupType): string {
  const lines = FOLLOWUP_LINES[type];
  return lines[Math.floor(Math.random() * lines.length)];
}

/**
 * Get a smart acknowledge that references what the user said
 * This creates much more natural, connected conversation
 */
export function getSmartAcknowledge(userTranscript: string): string {
  if (!userTranscript || userTranscript.trim().length < 3) {
    return getFollowupLine('tell_more');
  }
  
  // Extract meaningful words (ignore common filler/short words)
  const fillerWords = new Set(['the', 'a', 'an', 'is', 'was', 'are', 'were', 'um', 'uh', 'and', 'but', 'or', 'so', 'to', 'it', 'i', 'my', 'me', 'you', 'we', 'they', 'he', 'she', 'that', 'this']);
  const words = userTranscript.toLowerCase().split(/\s+/).filter(w => 
    w.length > 2 && !fillerWords.has(w)
  );
  
  if (words.length === 0) {
    return getFollowupLine('tell_more');
  }
  
  // Pick last meaningful word or a random one
  const keyWord = words[words.length - 1] || words[0];
  
  // Templates that echo the topic and invite continuation
  const templates = [
    `${capitalize(keyWord)}! Nice. What else?`,
    `Ah, ${keyWord}. Tell me more about that.`,
    `${capitalize(keyWord)}, got it. And?`,
    `Oh, ${keyWord}? What happened?`,
    `${capitalize(keyWord)}! Go on.`,
    `Nice, ${keyWord}. Then what?`,
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
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
 * Warm-up greetings before the first question
 */
export const WARMUP_GREETINGS = [
  "Good to see you!",
  "Hey there!",
  "Nice to chat!",
  "Hi!",
];

/**
 * Conversation opener prompts - narrow, time-anchored, simple
 */
export const CONVERSATION_OPENERS = [
  "What did you have for breakfast?",
  "What did you do this morning?",
  "See anything interesting today?",
  "What's something you did yesterday?",
  "Got any plans for later?",
  "What's one thing on your mind?",
  "How's your day going so far?",
  "What did you do after waking up?",
];

/**
 * Get a random conversation opener with optional warmup
 */
export function getRandomOpener(includeWarmup: boolean = true): string {
  const opener = CONVERSATION_OPENERS[Math.floor(Math.random() * CONVERSATION_OPENERS.length)];
  
  if (includeWarmup) {
    const warmup = WARMUP_GREETINGS[Math.floor(Math.random() * WARMUP_GREETINGS.length)];
    return `${warmup} ${opener}`;
  }
  
  return opener;
}

/**
 * Rule-based follow-up selection based on stuck type and turn count
 * CRITICAL: Never return pure acknowledge - always add continuation
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

  // Select based on stuck type - ALWAYS with continuation
  switch (stuckType) {
    case 'no_speech':
      // They didn't speak - try to narrow
      return 'clarify_small';
    
    case 'prompt_overload':
      // Prompt was too broad - narrow down
      return 'clarify_small';
    
    case 'word_search_stall':
      // They're trying but stuck - acknowledge WITH continuation
      return turnNumber === 1 ? 'tell_more' : 'what_next';
    
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
  
  // Default fallback - always continue conversation
  return 'tell_more';
}

/**
 * Get a context-aware fallback when AI fails
 * Always references conversation and invites continuation
 */
export function getSmartFallback(
  lastAIMessage?: string, 
  lastUserMessage?: string
): string {
  // If user said something, echo it
  if (lastUserMessage && lastUserMessage.trim().length > 3) {
    return getSmartAcknowledge(lastUserMessage);
  }
  
  // If AI asked about something specific, follow up on it
  if (lastAIMessage) {
    if (lastAIMessage.toLowerCase().includes('breakfast') || 
        lastAIMessage.toLowerCase().includes('eat') ||
        lastAIMessage.toLowerCase().includes('food')) {
      return "Sounds good! What else do you like to eat?";
    }
    if (lastAIMessage.toLowerCase().includes('morning')) {
      return "Nice. What else happened this morning?";
    }
    if (lastAIMessage.toLowerCase().includes('yesterday')) {
      return "Good! What else from yesterday?";
    }
  }
  
  // Generic but still inviting continuation
  return "Tell me more about that.";
}
