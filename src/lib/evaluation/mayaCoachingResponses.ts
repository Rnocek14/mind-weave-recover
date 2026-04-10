/**
 * Maya Coaching Responses for Validation Rejections
 * 
 * Maps rejection reasons to varied, therapeutic Maya lines.
 * Uses a rotation buffer to avoid repetition.
 * Integrates with TTS so Maya speaks the coaching line.
 */

import type { RejectionReason } from './responseValidation';

/** Multiple phrasings per rejection reason, rotated to avoid repetition */
const COACHING_LINES: Record<RejectionReason, string[]> = {
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
    "I think you repeated the instructions — try telling me what you see instead.",
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

/** Track last used index per reason to rotate phrasings */
const lastUsedIndex: Record<string, number> = {};

/**
 * Get a varied Maya coaching line for a rejection reason.
 * Rotates through options to avoid repetition.
 */
export function getMayaCoachingLine(reason: RejectionReason): string {
  const lines = COACHING_LINES[reason];
  const key = reason;
  const lastIdx = lastUsedIndex[key] ?? -1;
  const nextIdx = (lastIdx + 1) % lines.length;
  lastUsedIndex[key] = nextIdx;
  return lines[nextIdx];
}

/**
 * Speak a Maya coaching line via TTS and return the text.
 * Falls back to returning text only if speak function is not provided.
 */
export async function speakMayaCoaching(
  reason: RejectionReason,
  speakFn?: (text: string) => Promise<void>,
): Promise<string> {
  const line = getMayaCoachingLine(reason);
  if (speakFn) {
    try {
      await speakFn(line);
    } catch (err) {
      console.warn('[MayaCoaching] TTS failed, text-only fallback:', err);
    }
  }
  return line;
}
