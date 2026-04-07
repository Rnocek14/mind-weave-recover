/**
 * Smart Coach — Deterministic Fallback Library
 * 
 * Task-focused, purpose-aware fallbacks.
 * No identity-focused praise ("Good job!").
 * Every line is specific, actionable, and clinically grounded.
 */

import type { CoachMode, CueType } from './types';

const WARMUP_LINES = [
  "Let's start with something familiar — tell me one thing you like.",
  "We're warming up your word-finding. What's one food you enjoy?",
  "Easy one to start — what did you have for your last meal?",
  "Let's get the words flowing. What's something that made you smile recently?",
  "Starting simple — tell me one thing about your morning.",
];

const EXPAND_LINES = [
  "You got that word out clearly. Can you add one more detail?",
  "That was specific — what kind exactly?",
  "You described that well. What happened next?",
  "Clear answer. What was the best part about it?",
  "You found that word quickly. Who were you with?",
  "That came out smoothly. Where did this happen?",
];

const SCAFFOLD_LINES = [
  'Here\'s a way to start: "I like…"',
  'Try this frame: "I want…"',
  'You could say: "It was…"',
  "Let me narrow it down. Try putting it in a short sentence.",
  'How about starting with: "My favorite is…"',
  'This might help — start with: "I went to…"',
];

const SUPPORT_LINES = [
  "No rush — let me make this easier. Just pick: yes or no?",
  "That's a tough one. Let me give you two choices.",
  "Take your time. One word is plenty right now.",
  "Let me simplify. Which sounds closer — this or that?",
  "We can slow down. That's completely fine.",
  "Pausing is normal. I'll give you a starting point.",
];

const WRAPUP_LINES = [
  "You stayed with the conversation and found your words — that retrieval practice matters.",
  "You described things clearly today. That's the same skill you use in real conversations.",
  "You got through several exchanges independently. That builds real confidence.",
  "You practiced finding words under no pressure — that's how retrieval gets faster.",
  "You kept going even when it was hard. That persistence strengthens the pathways.",
];

const MODE_FALLBACKS: Record<CoachMode, string[]> = {
  warmup: WARMUP_LINES,
  expand: EXPAND_LINES,
  scaffold: SCAFFOLD_LINES,
  support: SUPPORT_LINES,
  wrapup: WRAPUP_LINES,
};

// Cue-specific overrides — task-focused, not identity-focused
const CUE_SPECIFIC: Partial<Record<CueType, string[]>> = {
  reassurance: [
    "Take your time — the word is in there. No rush finding it.",
    "Pausing is normal. Your brain is searching — that's the practice.",
    "It's okay to pause. Let me help narrow it down.",
    "No pressure. Sometimes the word needs an extra second.",
  ],
  forced_choice: [
    "Let me make it simpler — is it this one or that one?",
    "Two choices to narrow it down. Which sounds closer?",
    "Pick whichever feels right — either works.",
  ],
  sentence_starter: [
    'Here\'s a frame to try: "I…"',
    'Start with this: "It is…"',
    'Try: "I like…" and add one word.',
    'How about: "My favorite…" and then the thing.',
  ],
  expansion_prompt: [
    "You got that out clearly. Tell me one more detail about it.",
    "That was specific. What was that like?",
    "Good retrieval. What happened after?",
    "You found those words. How did that go?",
  ],
  semantic_hint: [
    "Think about what category it belongs to — that often helps.",
    "What's it used for? Sometimes describing it brings the word.",
    "Where would you usually find it? The context can help.",
  ],
  phonemic_hint: [
    "Think about the first sound — it might unlock the word.",
    "The beginning of the word might help. What letter does it start with?",
    "Sound it out slowly. The first syllable often comes first.",
  ],
};

// Confusion repair lines — when user says "what do you mean?"
const CONFUSION_REPAIR_LINES = [
  "Sorry, let me try that differently. Tell me about what you like to eat.",
  "My mistake — let me start fresh. What's something you had recently?",
  "Sorry about that. Let me ask a simpler one.",
  "Let me rephrase. Just tell me one thing that comes to mind.",
  "That wasn't clear — my fault. Let's go back to something simple.",
];

// Correction acknowledgment lines — when user says "no I wasn't"
const CORRECTION_REPAIR_LINES = [
  "You're right, sorry about that. Go ahead — what were you thinking?",
  "My mistake. What would you like to talk about?",
  "Sorry — I got that wrong. Tell me what's on your mind.",
  "Fair enough. What were you going to say?",
  "Got it, my bad. Go ahead.",
];

let lastIndices: Record<string, number> = {};

function pickRandom(pool: string[], key: string): string {
  const last = lastIndices[key] ?? -1;
  let idx: number;
  do {
    idx = Math.floor(Math.random() * pool.length);
  } while (pool.length > 1 && idx === last);
  lastIndices[key] = idx;
  return pool[idx];
}

/** Get a safe deterministic fallback line */
export function getFallbackLine(mode: CoachMode, cueType?: CueType): string {
  // Try cue-specific first
  if (cueType && CUE_SPECIFIC[cueType]) {
    return pickRandom(CUE_SPECIFIC[cueType]!, `cue_${cueType}`);
  }
  return pickRandom(MODE_FALLBACKS[mode], `mode_${mode}`);
}

/** Get a confusion repair line — user didn't understand Maya */
export function getConfusionRepairLine(): string {
  return pickRandom(CONFUSION_REPAIR_LINES, 'confusion_repair');
}

/** Get a correction repair line — user is correcting Maya */
export function getCorrectionRepairLine(): string {
  return pickRandom(CORRECTION_REPAIR_LINES, 'correction_repair');
}
