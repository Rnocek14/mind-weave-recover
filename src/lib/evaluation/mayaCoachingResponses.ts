/**
 * Maya Coaching Responses for Validation Rejections + Positive Reinforcement
 * 
 * Features:
 * - Rotation buffer to avoid repetition
 * - Exercise-specific scaffolding lines
 * - Attempt-aware tone shifting (softer after repeated failures)
 * - Timing control: 300ms delay + debounce to prevent overlapping/rushed speech
 * - Coaching frequency cap: max 2 spoken coaching per trial, then silent
 * - Positive reinforcement: varied micro-praise after valid responses
 * - TTS integration with graceful fallback
 */

import type { RejectionReason } from './responseValidation';

// ─── Exercise type ──────────────────────────────────────────────────────────

export type ExerciseKey = 'describe_guess' | 'photo_naming' | 'two_clues' | 'fix_sentence' 
  | 'narrative_retell' | 'abstract_compare' | 'multi_step_planning' 
  | 'thought_continuation' | 'generic';

// ─── Exercise-specific coaching lines ────────────────────────────────────────

const CONTEXTUAL_LINES: Partial<Record<ExerciseKey, Partial<Record<RejectionReason, string[]>>>> = {
  describe_guess: {
    too_short: [
      "Try describing what it looks like or what it does.",
      "Think about its shape, color, or where you'd find it.",
      "What category does it belong to?",
    ],
    instruction_echo: [
      "Instead of the instructions, describe what you see in the picture.",
      "Tell me about the object — what does it look like?",
    ],
  },
  photo_naming: {
    too_short: [
      "Try saying the name of what you see.",
      "What is this object called?",
    ],
    filler: [
      "Take a moment, then say the word when it comes to you.",
      "No rush — picture it in your mind, then name it.",
    ],
  },
  two_clues: {
    too_short: [
      "What word connects those two clues?",
      "Think about what they both describe.",
    ],
    instruction_echo: [
      "Tell me your guess — what word fits both clues?",
    ],
  },
  fix_sentence: {
    too_short: [
      "Say the corrected word — what should it be?",
      "Which word needs to change?",
    ],
    instruction_echo: [
      "Instead of the instructions, say the word that fixes the sentence.",
    ],
  },
  narrative_retell: {
    too_short: [
      "Try telling me what happened first in the story.",
      "Start with who was in the story and what they did.",
      "Can you add what happened next?",
    ],
    filler: [
      "Take your time — start with the beginning of the story.",
      "Think about the main character. What did they do?",
    ],
  },
  abstract_compare: {
    too_short: [
      "How are they similar? Think about what they share.",
      "What do they have in common?",
    ],
    filler: [
      "Take a moment. What makes these two things alike?",
    ],
  },
  multi_step_planning: {
    too_short: [
      "What would you do first? Then what comes next?",
      "Try describing the steps you'd take.",
    ],
  },
  thought_continuation: {
    // No too_short coaching — finish-the-thought accepts any real content
    // word, so a too_short rejection should never reach this map. Suppress
    // "Keep going" entirely after the user has spoken.
    filler: [
      "I didn't catch an answer — try again when you're ready.",
    ],
  },
};

// ─── Generic fallback lines ─────────────────────────────────────────────────

const GENERIC_LINES: Record<RejectionReason, string[]> = {
  empty: [
    "I didn't hear anything — take your time and try again.",
    "No rush. When you're ready, give it a go.",
    "I'm listening — go ahead when you're ready.",
  ],
  filler: [
    "I heard you thinking — now try saying your answer.",
    "Take a moment, then tell me what comes to mind.",
    "That's okay — try putting your answer into words.",
  ],
  instruction_echo: [
    "I think you repeated the instructions — try telling me your answer instead.",
    "That sounded like the instructions. What's your actual answer?",
    "Instead of the instructions, tell me what you think.",
  ],
  prompt_repeat: [
    "Try answering in your own words.",
    "Good start — now tell me what you think, not the question.",
    "I heard the prompt back. What's your answer?",
  ],
  too_short: [
    "Can you tell me a little more about that?",
    "Good start — try adding a bit more detail.",
    "I got a little — can you expand on that?",
  ],
  non_answer: [
    "That's okay — take your time and give it a try.",
    "No pressure. Try telling me what comes to mind.",
    "Let's try again — what do you think?",
  ],
};

// ─── Attempt-aware softening (after 2+ consecutive rejections) ──────────────

const SOFTENED_LINES: Partial<Record<RejectionReason, string[]>> = {
  empty: [
    "Still here with you. Try whenever you're ready.",
    "No pressure at all. Take as long as you need.",
  ],
  filler: [
    "You're doing fine. Try to say what's on your mind.",
  ],
  too_short: [
    "Even one more word would help. You're doing great.",
    "That's a start — anything else you can add?",
  ],
  non_answer: [
    "That's completely okay. Let's try a different angle.",
    "No worries. Just say whatever comes to mind.",
  ],
  instruction_echo: [
    "Let me help — just tell me what you notice or think.",
  ],
  prompt_repeat: [
    "That's alright. Try saying it a different way.",
  ],
};

// ─── Positive reinforcement lines ───────────────────────────────────────────

const GENERIC_REINFORCEMENT = [
  "Nice, that's it.",
  "Good — that was clear.",
  "Yes, that works.",
  "That's right.",
  "Well done.",
];

/** Exercise-specific reinforcement for richer feedback */
const CONTEXTUAL_REINFORCEMENT: Partial<Record<ExerciseKey, string[]>> = {
  describe_guess: [
    "Great description.",
    "Nice — you gave good detail.",
    "That helped me picture it.",
  ],
  photo_naming: [
    "That's the one.",
    "Right — good recall.",
    "Yes, exactly.",
  ],
  narrative_retell: [
    "Good retelling.",
    "Nice — you got the key parts.",
    "That was a clear summary.",
  ],
  abstract_compare: [
    "Good connection.",
    "That's a strong comparison.",
    "Yes — that links them well.",
  ],
  fix_sentence: [
    "That fixes it.",
    "Right — that sounds correct now.",
    "Good catch.",
  ],
  two_clues: [
    "That's the word.",
    "Nice — you figured it out.",
    "Exactly right.",
  ],
};

/** After a struggle (2+ prior rejections), reinforcement is warmer */
const RECOVERY_REINFORCEMENT = [
  "You got there — that's what matters.",
  "See? You had it in you.",
  "That took effort, and it paid off.",
  "Nicely done — worth the try.",
];

// ─── Rotation + selection logic ─────────────────────────────────────────────

const lastUsedIndex: Record<string, number> = {};

function pickRotated(lines: string[], key: string): string {
  const lastIdx = lastUsedIndex[key] ?? -1;
  const nextIdx = (lastIdx + 1) % lines.length;
  lastUsedIndex[key] = nextIdx;
  return lines[nextIdx];
}

// ─── State tracking ─────────────────────────────────────────────────────────

/** Track consecutive rejections per exercise for tone softening */
const consecutiveRejections: Record<string, number> = {};

/** Track coaching count per trial to enforce frequency cap */
const coachingCountPerTrial: Record<string, number> = {};

/** Max spoken coaching interventions per trial before going silent */
const MAX_COACHING_PER_TRIAL = 2;

export interface CoachingContext {
  exerciseKey?: ExerciseKey;
  /** Number of consecutive rejections in this trial/session */
  consecutiveFailures?: number;
}

/**
 * Get a context-aware, varied Maya coaching line.
 * Priority: exercise-specific → softened (if repeated) → generic
 */
export function getMayaCoachingLine(
  reason: RejectionReason, 
  context?: CoachingContext,
): string {
  const exercise = context?.exerciseKey || 'generic';
  const failures = context?.consecutiveFailures ?? 0;
  const rotKey = `${exercise}_${reason}`;

  // After 2+ consecutive rejections, use softened tone
  if (failures >= 2) {
    const softened = SOFTENED_LINES[reason];
    if (softened?.length) {
      return pickRotated(softened, `${rotKey}_soft`);
    }
  }

  // Try exercise-specific lines first
  const contextual = CONTEXTUAL_LINES[exercise]?.[reason];
  if (contextual?.length) {
    return pickRotated(contextual, rotKey);
  }

  // Fall back to generic
  return pickRotated(GENERIC_LINES[reason], `generic_${reason}`);
}

/**
 * Get a positive reinforcement line after a valid response.
 * Context-aware: exercise-specific, and warmer after recovery from struggle.
 */
export function getReinforcementLine(exerciseKey?: ExerciseKey): string {
  const ex = exerciseKey || 'generic';
  const priorFailures = consecutiveRejections[ex] || 0;

  // If user struggled (2+ rejections) then succeeded, use recovery praise
  if (priorFailures >= 2) {
    return pickRotated(RECOVERY_REINFORCEMENT, `recovery_${ex}`);
  }

  // Try exercise-specific reinforcement
  const contextual = CONTEXTUAL_REINFORCEMENT[ex];
  if (contextual?.length) {
    return pickRotated(contextual, `reinforce_${ex}`);
  }

  return pickRotated(GENERIC_REINFORCEMENT, 'reinforce_generic');
}

// ─── Timing control ─────────────────────────────────────────────────────────

const COACHING_DELAY_MS = 300;
let pendingCoachingTimer: ReturnType<typeof setTimeout> | null = null;
let lastCoachingTimestamp = 0;
const MIN_COACHING_INTERVAL_MS = 2000;

/**
 * Speak a Maya coaching line with timing + frequency control.
 * - 300ms delay before speaking
 * - Debounced: cancels pending coaching if called again quickly
 * - Minimum 2s interval between coaching utterances
 * - Max 2 spoken coaching per trial; after that, text-only (silent)
 * 
 * Returns the coaching text for UI display (always).
 */
export function speakMayaCoaching(
  reason: RejectionReason,
  speakFn?: (text: string) => Promise<void>,
  context?: CoachingContext,
): Promise<string> {
  const exKey = context?.exerciseKey || 'generic';
  
  // Track consecutive rejections
  consecutiveRejections[exKey] = (consecutiveRejections[exKey] || 0) + 1;
  const enrichedContext: CoachingContext = {
    ...context,
    consecutiveFailures: consecutiveRejections[exKey],
  };

  const line = getMayaCoachingLine(reason, enrichedContext);

  // Track coaching count for frequency cap
  coachingCountPerTrial[exKey] = (coachingCountPerTrial[exKey] || 0) + 1;
  const coachingCount = coachingCountPerTrial[exKey];

  // Cancel any pending coaching
  if (pendingCoachingTimer) {
    clearTimeout(pendingCoachingTimer);
    pendingCoachingTimer = null;
  }

  // If over cap or no speak function, return text-only (silent coaching)
  if (!speakFn || coachingCount > MAX_COACHING_PER_TRIAL) {
    if (coachingCount > MAX_COACHING_PER_TRIAL) {
      console.log(`[MayaCoaching] Silent mode — ${coachingCount} coaching this trial (cap: ${MAX_COACHING_PER_TRIAL})`);
    }
    return Promise.resolve(line);
  }

  // Check minimum interval
  const now = Date.now();
  const timeSinceLast = now - lastCoachingTimestamp;
  const effectiveDelay = Math.max(COACHING_DELAY_MS, MIN_COACHING_INTERVAL_MS - timeSinceLast);

  return new Promise<string>((resolve) => {
    pendingCoachingTimer = setTimeout(() => {
      pendingCoachingTimer = null;
      lastCoachingTimestamp = Date.now();
      speakFn(line).catch(err => {
        console.warn('[MayaCoaching] TTS failed, text-only fallback:', err);
      });
      resolve(line);
    }, effectiveDelay);
  });
}

/**
 * Speak positive reinforcement after a valid response.
 * Uses same timing control as coaching. Short and quick.
 */
export function speakMayaReinforcement(
  speakFn?: (text: string) => Promise<void>,
  exerciseKey?: ExerciseKey,
): Promise<string> {
  const line = getReinforcementLine(exerciseKey);

  if (!speakFn) {
    return Promise.resolve(line);
  }

  // Cancel any pending coaching (reinforcement takes priority)
  if (pendingCoachingTimer) {
    clearTimeout(pendingCoachingTimer);
    pendingCoachingTimer = null;
  }

  // Brief delay for natural pacing
  return new Promise<string>((resolve) => {
    setTimeout(() => {
      lastCoachingTimestamp = Date.now();
      speakFn(line).catch(err => {
        console.warn('[MayaCoaching] Reinforcement TTS failed:', err);
      });
      resolve(line);
    }, 200);
  });
}

/**
 * Cancel any coaching line that is scheduled but not yet spoken. Call on
 * trial advance / exercise completion / unmount so a delayed line (300ms–2s
 * debounce + TTS fetch latency) can't play over the next trial or the
 * completion screen.
 */
export function cancelPendingMayaCoaching() {
  if (pendingCoachingTimer) {
    clearTimeout(pendingCoachingTimer);
    pendingCoachingTimer = null;
  }
}

/**
 * Reset coaching state for an exercise + optionally speak reinforcement.
 * Reinforcement only speaks when there were prior coaching interventions
 * (completing the coaching loop), not on first-try successes.
 */
export function resetCoachingState(
  exerciseKey?: ExerciseKey,
  speakFn?: (text: string) => Promise<void>,
) {
  if (!exerciseKey) return;
  
  const priorFailures = consecutiveRejections[exerciseKey] || 0;
  
  // Speak reinforcement only if user recovered from prior coaching
  if (priorFailures > 0 && speakFn) {
    const line = getReinforcementLine(exerciseKey);
    // Cancel any pending coaching first
    if (pendingCoachingTimer) {
      clearTimeout(pendingCoachingTimer);
      pendingCoachingTimer = null;
    }
    setTimeout(() => {
      speakFn(line).catch(err => {
        console.warn('[MayaCoaching] Reinforcement TTS failed:', err);
      });
    }, 200);
  }
  
  consecutiveRejections[exerciseKey] = 0;
  coachingCountPerTrial[exerciseKey] = 0;
}
