/**
 * Session Feedback Copy — Short, aphasia-friendly messages for transitions
 * 
 * All copy is: short, concrete, non-judgmental, adult-level.
 * Four tiers matching performanceAwareFeedback: celebrate, encourage, support, protect.
 * 
 * Phase 7.1: expanded pools (6-8 per tier), repetition prevention, frequency gating.
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
  { line: "You handled that well.", emoji: "👏" },
  { line: "Nice — that was clean.", emoji: "✨" },
  { line: "That came out faster.", emoji: "⚡" },
  { line: "Really solid.", emoji: "⭐" },
];

const ENCOURAGE_TRANSITIONS: TransitionMessage[] = [
  { line: "Solid work.", emoji: "👍" },
  { line: "Good practice.", emoji: "💪" },
  { line: "Moving well.", emoji: "➡️" },
  { line: "Nice effort.", emoji: "✨" },
  { line: "That was steady.", emoji: "👍" },
  { line: "Good focus.", emoji: "🎯" },
  { line: "Keep it rolling.", emoji: "➡️" },
];

const SUPPORT_TRANSITIONS: TransitionMessage[] = [
  { line: "That was a tough one.", emoji: "👊" },
  { line: "Hard work builds strength.", emoji: "🧠" },
  { line: "Every attempt counts.", emoji: "💪" },
  { line: "Let's try something different.", emoji: "🔄" },
  { line: "Tough round — no problem.", emoji: "👍" },
  { line: "That takes practice.", emoji: "🧠" },
  { line: "Stay with it.", emoji: "💪" },
];

const PROTECT_TRANSITIONS: TransitionMessage[] = [
  { line: "No problem — let's keep going.", emoji: "💛" },
  { line: "That was hard. Next one will be different.", emoji: "💛" },
  { line: "You're still here — that matters.", emoji: "💛" },
  { line: "Let's move on.", emoji: "➡️" },
  { line: "We'll try a different angle.", emoji: "💛" },
  { line: "Take your time.", emoji: "💛" },
  { line: "No rush — keep going.", emoji: "💛" },
  { line: "That's okay — next one.", emoji: "➡️" },
];

// ═══════ Repetition prevention ═══════

let _recentLines: string[] = [];
const MAX_RECENT = 4;

function pickRandom<T extends { line: string }>(arr: T[]): T {
  // Avoid repeating any of the last N lines
  const available = arr.filter(m => !_recentLines.includes(m.line));
  const pool = available.length > 0 ? available : arr;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  _recentLines.push(pick.line);
  if (_recentLines.length > MAX_RECENT) _recentLines.shift();
  return pick;
}

/** Reset repetition tracking (call at session start) */
export function resetFeedbackHistory(): void {
  _recentLines = [];
  _transitionCount = 0;
}

// ═══════ Frequency gating (~60-70% show feedback) ═══════

let _transitionCount = 0;

/**
 * Whether this transition should show feedback text or be silent ("Next: X" only).
 * Roughly 60-70% show feedback. Pattern: show, show, skip, show, skip, show…
 */
export function shouldShowFeedback(): boolean {
  _transitionCount++;
  // First transition always shows feedback
  if (_transitionCount === 1) return true;
  // Pattern: ~65% show. Skip on positions 3, 5, 8, 10…
  const mod = _transitionCount % 5;
  return mod !== 3 && mod !== 0; // skip at 3 and 5 → 3/5 = 60% show
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

// ═══════ Adaptation visibility messages (gated) ═══════

/**
 * Returns adaptation message only on significant score changes.
 * Returns null most of the time to avoid noise.
 */
export function getAdaptationMessage(lastScore: number | null, nextExerciseName: string): string | null {
  if (lastScore === null) return null;
  // Only surface on clearly significant thresholds
  if (lastScore < 30) return "We'll make this one a bit easier.";
  if (lastScore >= 90) return "Let's challenge this a little more.";
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
  if (avgScore === null) return DELIGHT_LINES[Math.floor(Math.random() * DELIGHT_LINES.length)];
  const tone = getFeedbackTone(avgScore);
  if (tone === 'celebrate') return "That was a strong session — real progress.";
  if (tone === 'encourage') return "Solid session. You're building momentum.";
  if (tone === 'support') return "Hard work today. Every bit helps your brain recover.";
  return "You showed up — that takes courage. 💛";
}
