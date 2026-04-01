/**
 * Smart Coach — Deterministic Fallback Library
 * 
 * Safe lines used when the LLM output is rejected by the validator.
 * Organized by mode and cue type to stay contextually appropriate.
 */

import type { CoachMode, CueType } from './types';

const WARMUP_LINES = [
  "Let's start simple.",
  "Tell me one thing you like.",
  "What's one thing you did today?",
  "What's your favorite food?",
];

const EXPAND_LINES = [
  "Can you say a little more?",
  "What kind do you mean?",
  "Tell me one more detail.",
  "And what happened next?",
];

const SCAFFOLD_LINES = [
  'You can start with: "I like…"',
  'Try this: "I want…"',
  'You could say: "It was…"',
  "Try putting it in a sentence.",
];

const SUPPORT_LINES = [
  "Take your time.",
  "That's okay — let's make it easier.",
  "No rush. One word is enough.",
  "You can choose: yes or no?",
];

const WRAPUP_LINES = [
  "Nice work today.",
  "That was a good effort.",
  "You got your idea across — well done.",
  "Good session. You should feel proud.",
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
  ],
  forced_choice: [
    "Is it this one or that one?",
    "You can pick: yes or no?",
  ],
  sentence_starter: [
    'Start with: "I…"',
    'Try: "It is…"',
    'You can say: "I like…"',
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
