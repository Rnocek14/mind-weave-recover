/**
 * In-session micro-encouragement system.
 * 
 * Provides subtle, non-intrusive positive feedback during exercises
 * when the patient hits correct streaks, improves speed, or answers independently.
 * 
 * Usage: call `trackTrial(correct, reactionTimeMs, cueLevel)` after each trial.
 * The hook will trigger toast encouragements at the right moments.
 */

import { useCallback, useRef } from "react";
import { toast } from "sonner";

interface EncouragementState {
  correctStreak: number;
  totalCorrect: number;
  totalTrials: number;
  lastReactionTime: number | null;
  avgReactionTime: number;
  reactionTimes: number[];
  lastEncouragementAt: number;
  independentAnswers: number;
}

const MESSAGES = {
  streak3: [
    "Nice streak! 🔥",
    "Three in a row — keep going!",
    "You're on a roll! 👏",
  ],
  streak5: [
    "Five in a row — amazing! 🌟",
    "Incredible focus! ⭐",
    "You're really in the zone! 💪",
  ],
  faster: [
    "That was quicker! ⚡",
    "Getting faster 👍",
    "Nice — quick response!",
  ],
  independent: [
    "You got that on your own! 💪",
    "No hints needed — great job!",
    "All by yourself — well done! ✨",
  ],
  halfwayStrong: [
    "Halfway there — strong work!",
    "You're doing great — keep it up!",
  ],
};

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

const MIN_GAP_MS = 8_000; // Don't encourage more than once per 8 seconds

export function useMicroEncouragement() {
  const state = useRef<EncouragementState>({
    correctStreak: 0,
    totalCorrect: 0,
    totalTrials: 0,
    lastReactionTime: null,
    avgReactionTime: 0,
    reactionTimes: [],
    lastEncouragementAt: 0,
    independentAnswers: 0,
  });

  const showEncouragement = useCallback((message: string) => {
    const now = Date.now();
    if (now - state.current.lastEncouragementAt < MIN_GAP_MS) return;

    state.current.lastEncouragementAt = now;
    toast(message, {
      duration: 2000,
      position: "top-center",
      className: "!bg-primary/10 !text-primary !border-primary/20 !shadow-sm text-sm font-medium",
      style: { maxWidth: "280px" },
    });
  }, []);

  const trackTrial = useCallback((
    correct: boolean,
    reactionTimeMs?: number | null,
    cueLevel?: number | null,
  ) => {
    const s = state.current;
    s.totalTrials++;

    if (correct) {
      s.correctStreak++;
      s.totalCorrect++;

      // Independent answer (no cue)
      if (cueLevel !== undefined && cueLevel !== null && cueLevel <= 0) {
        s.independentAnswers++;
        if (s.independentAnswers === 2) {
          showEncouragement(pick(MESSAGES.independent));
        }
      }

      // Streak milestones
      if (s.correctStreak === 3) {
        showEncouragement(pick(MESSAGES.streak3));
      } else if (s.correctStreak === 5) {
        showEncouragement(pick(MESSAGES.streak5));
      }

      // Speed improvement
      if (reactionTimeMs && reactionTimeMs > 0) {
        s.reactionTimes.push(reactionTimeMs);
        if (s.reactionTimes.length >= 4) {
          const recent = s.reactionTimes.slice(-3);
          const earlier = s.reactionTimes.slice(0, Math.max(1, s.reactionTimes.length - 3));
          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
          const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
          if (recentAvg < earlierAvg * 0.8) {
            showEncouragement(pick(MESSAGES.faster));
          }
        }
      }
    } else {
      s.correctStreak = 0;
    }

    // Halfway checkpoint
    // (Exercises typically have 5-10 trials — trigger at trial 5 if doing well)
    if (s.totalTrials === 5 && s.totalCorrect >= 3) {
      showEncouragement(pick(MESSAGES.halfwayStrong));
    }
  }, [showEncouragement]);

  const reset = useCallback(() => {
    state.current = {
      correctStreak: 0,
      totalCorrect: 0,
      totalTrials: 0,
      lastReactionTime: null,
      avgReactionTime: 0,
      reactionTimes: [],
      lastEncouragementAt: 0,
      independentAnswers: 0,
    };
  }, []);

  return { trackTrial, reset };
}
