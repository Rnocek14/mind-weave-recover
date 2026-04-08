/**
 * Session Feedback Copy — Short, aphasia-friendly messages for transitions
 * 
 * All copy is: short, concrete, non-judgmental, adult-level.
 * Four tiers matching performanceAwareFeedback: celebrate, encourage, support, protect.
 */

import { getFeedbackTone, type FeedbackTone } from './performanceAwareFeedback';

// ═══════ Transition messages (between exercises) ═══════

interface TransitionMessage {
  line: string;
  emoji: string;
}

const CELEBRATE_TRANSITIONS: TransitionMessage[] = [
  { line: "That was sharp.", emoji: "⭐" },
  { line: "Strong round — keep it up.", emoji: "💪" },
  { line: "That came out smoothly.", emoji: "✨" },
  { line: "Quick and clear.", emoji: "🎯" },
];

const ENCOURAGE_TRANSITIONS: TransitionMessage[] = [
  { line: "Solid work.", emoji: "👍" },
  { line: "Good practice.", emoji: "💪" },
  { line: "Moving well.", emoji: "➡️" },
  { line: "Nice effort.", emoji: "✨" },
];

const SUPPORT_TRANSITIONS: TransitionMessage[] = [
  { line: "That was a tough one.", emoji: "👊" },
  { line: "Hard work builds strength.", emoji: "🧠" },
  { line: "Every attempt counts.", emoji: "💪" },
  { line: "Let's try something different.", emoji: "🔄" },
];

const PROTECT_TRANSITIONS: TransitionMessage[] = [
  { line: "No problem — let's keep going.", emoji: "💛" },
  { line: "That was hard. Next one will be different.", emoji: "💛" },
  { line: "You're still here — that matters.", emoji: "💛" },
  { line: "Let's move on.", emoji: "➡️" },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getPerformanceTransition(lastScore: number | null): TransitionMessage {
  if (lastScore === null) return pickRandom(ENCOURAGE_TRANSITIONS);
  const tone = getFeedbackTone(lastScore);
  switch (tone) {
    case 'celebrate': return pickRandom(CELEBRATE_TRANSITIONS);
    case 'encourage': return pickRandom(ENCOURAGE_TRANSITIONS);
    case 'support': return pickRandom(SUPPORT_TRANSITIONS);
    case 'protect': return pickRandom(PROTECT_TRANSITIONS);
  }
}

// ═══════ Adaptation visibility messages ═══════

export function getAdaptationMessage(lastScore: number | null, nextExerciseName: string): string | null {
  if (lastScore === null) return null;
  if (lastScore < 40) return "We'll make this one a bit easier.";
  if (lastScore >= 85) return "Let's challenge this a little more.";
  return null;
}

// ═══════ Session delight (end-of-session) ═══════

const DELIGHT_LINES: string[] = [
  "That was real practice — your brain just got stronger.",
  "You kept going — that's what builds recovery.",
  "Good session. Every round made a difference.",
  "Real effort, real progress. Well done.",
  "You showed up and worked hard. That counts.",
];

export function getSessionDelightLine(avgScore: number | null): string {
  if (avgScore === null) return pickRandom(DELIGHT_LINES);
  const tone = getFeedbackTone(avgScore);
  if (tone === 'celebrate') return "That was a strong session — real progress.";
  if (tone === 'encourage') return "Solid session. You're building momentum.";
  if (tone === 'support') return "Hard work today. Every bit helps your brain recover.";
  return "You showed up — that takes courage. 💛";
}
