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
  // Peer-level, varied reactions — no repeated patterns
  acknowledge: [
    "Mm-hmm. And?",
    "Right, right. Go on.",
    "Got it. What else?",
    "Okay. Then what?",
    "Makes sense. Go on.",
    "Ah, okay. Keep going.",
    "Oh really? Go on.",
    "I see. And?",
    "Got it, got it. Then?",
    "Hmm. Then what?",
    "Oh wow. And then?",
    "Ha, interesting. Go on.",
    "Huh! What happened next?",
    "Oh I like that. Tell me more.",
    "Wait, really? Keep going.",
  ],
  wrap_up: [
    "This was really nice. Let's chat again soon!",
    "I enjoyed that — talk to you next time.",
    "Good stuff today. See you soon!",
    "That was fun! We'll pick up next time.",
    "Nice chatting with you. Until next time!",
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

// DEDUP GUARD: Track last used lines to prevent consecutive repetition
const _lastUsedLines: string[] = [];
const MAX_DEDUP_HISTORY = 4;

function pickWithoutRepeat(lines: string[]): string {
  const available = lines.filter(l => !_lastUsedLines.includes(l));
  const pool = available.length > 0 ? available : lines;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  _lastUsedLines.push(picked);
  if (_lastUsedLines.length > MAX_DEDUP_HISTORY) _lastUsedLines.shift();
  return picked;
}

/**
 * Get a random line for a follow-up type (with dedup guard)
 */
export function getFollowupLine(type: FollowupType): string {
  const lines = FOLLOWUP_LINES[type];
  return pickWithoutRepeat(lines);
}

/**
 * Get a smart acknowledge that references what the user said
 * This creates much more natural, connected conversation
 */
// DEDUP GUARD for smart acknowledges
const _recentAcknowledges: string[] = [];
const MAX_ACK_HISTORY = 6;

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
  
  // Pick from multiple meaningful words to vary the echo
  const keyWord = words.length > 1 
    ? words[Math.floor(Math.random() * words.length)]
    : words[0];
  
  // Expanded templates with more variety
  const templates = [
    `${capitalize(keyWord)}! Nice. What else?`,
    `Ah, ${keyWord}. Tell me more about that.`,
    `${capitalize(keyWord)}, got it. And?`,
    `Oh, ${keyWord}? What happened?`,
    `${capitalize(keyWord)}! Go on.`,
    `Nice, ${keyWord}. Then what?`,
    `Hmm, ${keyWord}. What was that like?`,
    `${capitalize(keyWord)} — interesting. Keep going.`,
    `Oh, ${keyWord}! And then?`,
    `Wait, ${keyWord}? Tell me more.`,
    `${capitalize(keyWord)}, huh. What else happened?`,
    `So, ${keyWord}. How did that go?`,
  ];
  
  // Filter out recently used templates (by structure, ignoring the keyword)
  const available = templates.filter(t => !_recentAcknowledges.includes(t));
  const pool = available.length > 0 ? available : templates;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  
  // Track history
  _recentAcknowledges.push(picked);
  if (_recentAcknowledges.length > MAX_ACK_HISTORY) _recentAcknowledges.shift();
  
  return picked;
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
  "Hey! Good to have you.",
  "Oh hey! Ready to chat?",
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
