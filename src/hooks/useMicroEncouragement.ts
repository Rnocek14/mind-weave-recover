/**
 * Context-Aware Micro-Encouragement System
 * 
 * Provides specific, behavior-grounded feedback during and after exercises.
 * Messages reference actual words, speed changes, and observable behaviors —
 * NOT generic praise.
 * 
 * Usage: 
 *   trackTrial(correct, reactionTimeMs, cueLevel, targetWord)
 *   trackGameComplete(result) — post-game contextual toast
 */

import { useCallback, useRef } from "react";
import { toast } from "sonner";

interface EncouragementState {
  correctStreak: number;
  totalCorrect: number;
  totalTrials: number;
  reactionTimes: number[];
  lastEncouragementAt: number;
  independentAnswers: number;
  /** Words that were answered correctly without cues */
  independentWords: string[];
  /** Words answered faster than previous average */
  fasterWords: string[];
  /** Previous trial RT for comparison */
  prevReactionTime: number | null;
  /** Track the first game score for cross-game comparison */
  game1Score: number | null;
}

// ─── Message Pools (specific, behavior-grounded) ──────────

const SPECIFIC_FASTER = [
  (word: string) => `"${word}" came out faster that time ⚡`,
  (word: string) => `Quicker on "${word}" — did that feel easier?`,
  (word: string) => `"${word}" — no hesitation there 👍`,
];

const SPECIFIC_INDEPENDENT = [
  (word: string) => `"${word}" — you got that without any help 💪`,
  (word: string) => `No hints needed for "${word}" — that's real progress`,
  (word: string) => `"${word}" came to you on your own ✨`,
];

const STREAK_MESSAGES = [
  (n: number) => `${n} in a row — the words are flowing`,
  (n: number) => `${n} straight — you're in a rhythm now`,
  (n: number) => `${n} correct — that's momentum building`,
];

const SPEED_TREND = [
  "You're answering faster now — the retrieval is getting smoother ⚡",
  "Quicker responses — the words are coming easier",
  "Notice how much faster that felt? That's real progress",
];

const HALFWAY_SPECIFIC = [
  (correct: number, total: number) => `${correct} out of ${total} so far — strong start`,
  (correct: number, total: number) => `Halfway through — ${correct}/${total} and going well`,
];

const GAME_COMPLETE_HIGH = [
  (score: number, words: string[]) => words.length > 0 
    ? `${score}% — words like "${words[0]}" came out smoothly` 
    : `${score}% — that was a strong round`,
  (score: number, words: string[]) => words.length > 0
    ? `Nice — "${words.slice(0, 2).join('" and "')}" came quickly`
    : `${score}% — the retrieval felt natural there`,
];

const GAME_COMPLETE_IMPROVED = [
  (scoreDelta: number) => `${scoreDelta} points higher than last round — you're getting stronger 📈`,
  (scoreDelta: number) => `Improved by ${scoreDelta}% — that practice is paying off`,
];

const GAME_COMPLETE_EFFORT = [
  "That was tough, but you stayed with it — that's what builds the pathway",
  "Some rounds are harder. Showing up is what matters 💛",
];

function pickFn<T extends (...args: any[]) => string>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

const MIN_GAP_MS = 8_000;

export function useMicroEncouragement() {
  const state = useRef<EncouragementState>({
    correctStreak: 0,
    totalCorrect: 0,
    totalTrials: 0,
    reactionTimes: [],
    lastEncouragementAt: 0,
    independentAnswers: 0,
    independentWords: [],
    fasterWords: [],
    prevReactionTime: null,
    game1Score: null,
  });

  const showEncouragement = useCallback((message: string) => {
    const now = Date.now();
    if (now - state.current.lastEncouragementAt < MIN_GAP_MS) return;

    state.current.lastEncouragementAt = now;
    toast(message, {
      duration: 2500,
      position: "top-center",
      className: "!bg-primary/10 !text-primary !border-primary/20 !shadow-sm text-sm font-medium",
      style: { maxWidth: "320px" },
    });
  }, []);

  /**
   * Track individual trial with optional word context
   */
  const trackTrial = useCallback((
    correct: boolean,
    reactionTimeMs?: number | null,
    cueLevel?: number | null,
    targetWord?: string | null,
  ) => {
    const s = state.current;
    s.totalTrials++;

    if (correct) {
      s.correctStreak++;
      s.totalCorrect++;

      // ── Specific: faster on THIS word ──
      if (reactionTimeMs && reactionTimeMs > 0 && s.prevReactionTime && s.prevReactionTime > 0) {
        if (reactionTimeMs < s.prevReactionTime * 0.75 && targetWord) {
          s.fasterWords.push(targetWord);
          showEncouragement(pickFn(SPECIFIC_FASTER)(targetWord));
        }
      }
      if (reactionTimeMs && reactionTimeMs > 0) {
        s.prevReactionTime = reactionTimeMs;
        s.reactionTimes.push(reactionTimeMs);
      }

      // ── Specific: independent on THIS word ──
      if (cueLevel != null && cueLevel <= 0 && targetWord) {
        s.independentAnswers++;
        s.independentWords.push(targetWord);
        if (s.independentAnswers === 2) {
          showEncouragement(pickFn(SPECIFIC_INDEPENDENT)(targetWord));
        }
      }

      // ── Streak (uses count, not generic) ──
      if (s.correctStreak === 3 || s.correctStreak === 5) {
        showEncouragement(pickFn(STREAK_MESSAGES)(s.correctStreak));
      }

      // ── Speed trend (overall, not per-word) ──
      if (s.reactionTimes.length >= 5) {
        const early = s.reactionTimes.slice(0, 3);
        const recent = s.reactionTimes.slice(-3);
        const earlyAvg = early.reduce((a, b) => a + b, 0) / early.length;
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        if (recentAvg < earlyAvg * 0.7 && earlyAvg > 1200) {
          showEncouragement(pick(SPEED_TREND));
        }
      }
    } else {
      s.correctStreak = 0;
      if (reactionTimeMs && reactionTimeMs > 0) {
        s.prevReactionTime = reactionTimeMs;
      }
    }

    // ── Halfway checkpoint (specific count) ──
    if (s.totalTrials === 5 && s.totalCorrect >= 3) {
      showEncouragement(pickFn(HALFWAY_SPECIFIC)(s.totalCorrect, s.totalTrials));
    }
  }, [showEncouragement]);

  /**
   * Track game completion — fires a contextual post-game toast
   */
  const trackGameComplete = useCallback((result: {
    score: number;
    targetWords?: string[];
    gameSlot: 1 | 2;
  }) => {
    const s = state.current;
    const scorePercent = Math.round(result.score * 100);
    const words = result.targetWords || [];

    if (result.gameSlot === 1) {
      s.game1Score = result.score;
    }

    // Cross-game improvement
    if (result.gameSlot === 2 && s.game1Score != null) {
      const delta = scorePercent - Math.round(s.game1Score * 100);
      if (delta >= 8) {
        showEncouragement(pickFn(GAME_COMPLETE_IMPROVED)(delta));
        return;
      }
    }

    // High score — celebrate with specific words
    if (result.score >= 0.75) {
      showEncouragement(pickFn(GAME_COMPLETE_HIGH)(scorePercent, words));
    }
    // Low score — acknowledge effort
    else if (result.score < 0.4) {
      showEncouragement(pick(GAME_COMPLETE_EFFORT));
    }
  }, [showEncouragement]);

  const reset = useCallback(() => {
    state.current = {
      correctStreak: 0,
      totalCorrect: 0,
      totalTrials: 0,
      reactionTimes: [],
      lastEncouragementAt: 0,
      independentAnswers: 0,
      independentWords: [],
      fasterWords: [],
      prevReactionTime: null,
      game1Score: null,
    };
  }, []);

  return { trackTrial, trackGameComplete, reset };
}
