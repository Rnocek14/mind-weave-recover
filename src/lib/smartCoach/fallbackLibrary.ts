/**
 * Smart Coach — Deterministic Fallback Library
 * 
 * Safe lines used when the LLM output is rejected by the validator.
 * Organized by mode and cue type to stay contextually appropriate.
 * Expanded for variety — still bounded and clinically safe.
 */

import type { CoachMode, CueType } from './types';

const WARMUP_LINES = [
  "Let's start simple.",
  "Tell me one thing you like.",
  "What's one thing you did today?",
  "What's your favorite food?",
  "What's something that made you smile recently?",
  "Tell me one thing about your morning.",
  "What's the first thing that comes to mind?",
];

const EXPAND_LINES = [
  "Can you say a little more about that?",
  "What kind do you mean?",
  "Tell me one more detail.",
  "And what happened next?",
  "What did you like about it?",
  "What was the best part?",
  "Who were you with?",
  "How did that feel?",
];

const SCAFFOLD_LINES = [
  'You can start with: "I like…"',
  'Try this: "I want…"',
  'You could say: "It was…"',
  "Try putting it in a sentence.",
  'How about: "My favorite is…"',
  'Start with: "I went to…"',
  'You could say: "I remember…"',
];

const SUPPORT_LINES = [
  "Take your time — no rush at all.",
  "That's okay — let's make it easier.",
  "No rush. One word is enough.",
  "You can choose: yes or no?",
  "It's okay to pause. I'm right here.",
  "We can slow down. That's perfectly fine.",
  "Just one word is a great start.",
  "Take a breath. There's no hurry.",
];

const WRAPUP_LINES = [
  "Nice work today — you stuck with it.",
  "That was a good conversation.",
  "You got your idea across — well done.",
  "Good session. You should feel proud.",
  "That took real effort — nice job.",
  "You practiced well today. That matters.",
];

const MODE_FALLBACKS: Record<CoachMode, string[]> = {
  warmup: WARMUP_LINES,
  expand: EXPAND_LINES,
  scaffold: SCAFFOLD_LINES,
  support: SUPPORT_LINES,
  wrapup: WRAPUP_LINES,
};

// Cue-specific overrides when applicable
const CUE_SPECIFIC: Partial<Record<CueType, string[]>> = {
  reassurance: [
    "Take your time — no rush.",
    "That's perfectly okay.",
    "I'm right here with you.",
    "It's okay — we can try again.",
    "No pressure. You're doing fine.",
  ],
  forced_choice: [
    "Is it this one or that one?",
    "You can pick: yes or no?",
    "Which one sounds right?",
    "Just pick one — either is fine.",
  ],
  sentence_starter: [
    'Start with: "I…"',
    'Try: "It is…"',
    'You can say: "I like…"',
    'How about: "I went…"',
    'Try starting with: "My favorite…"',
  ],
  expansion_prompt: [
    "Tell me a little more about that.",
    "What was that like?",
    "And what happened after?",
    "What did you think about it?",
    "How did that go?",
  ],
  semantic_hint: [
    "Think about what it's used for.",
    "What category does it belong to?",
    "Where would you usually find it?",
  ],
  phonemic_hint: [
    "The word starts with...",
    "Think about the first sound.",
    "It rhymes with...",
  ],
};

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
