/**
 * Micro-Feedback System — Surfaces progress moments during conversation
 * 
 * Uses repair tracker and TRL data to generate short, encouraging
 * feedback that shows the user they're improving within a session.
 * 
 * Rules:
 * - Never interrupt flow with long feedback
 * - Max 1 feedback per 4 turns
 * - Always anchored to something specific
 * - Never generic praise ("Good job!")
 */

export type FeedbackType =
  | 'faster_response'     // User answered quicker than before
  | 'fewer_cues'          // User needed fewer hints
  | 'longer_speech'       // User produced more words
  | 'successful_repair'   // User recovered a word they were stuck on
  | 'game_boost'          // User fluency improved after game
  | 'streak'              // Several good turns in a row
  | null;                 // No feedback this turn

export interface MicroFeedbackResult {
  type: FeedbackType;
  text: string | null;
  /** Whether to prepend to Maya's response or speak separately */
  delivery: 'prepend' | 'standalone' | 'none';
}

export interface FeedbackTracker {
  lastFeedbackTurn: number;
  recentLatencies: number[];
  recentWordCounts: number[];
  recentCueLevels: number[];
  postGameTurnCount: number;
  postGameFluencySum: number;
  preGameFluency: number | null;
}

export function createFeedbackTracker(): FeedbackTracker {
  return {
    lastFeedbackTurn: -10,
    recentLatencies: [],
    recentWordCounts: [],
    recentCueLevels: [],
    postGameTurnCount: 0,
    postGameFluencySum: 0,
    preGameFluency: null,
  };
}

const MIN_TURNS_BETWEEN_FEEDBACK = 4;

/**
 * Record turn data for feedback evaluation
 */
export function recordTurnForFeedback(
  tracker: FeedbackTracker,
  turnData: {
    turnNumber: number;
    latencyMs: number | null;
    wordCount: number;
    cueLevel: number;
    fluencyScore: number;
    wasRepairSuccessful: boolean;
    gameJustCompleted: boolean;
  }
): { tracker: FeedbackTracker; feedback: MicroFeedbackResult } {
  const updated: FeedbackTracker = {
    ...tracker,
    recentLatencies: [...tracker.recentLatencies, turnData.latencyMs ?? 3000].slice(-6),
    recentWordCounts: [...tracker.recentWordCounts, turnData.wordCount].slice(-6),
    recentCueLevels: [...tracker.recentCueLevels, turnData.cueLevel].slice(-6),
  };

  // Track post-game fluency
  if (turnData.gameJustCompleted) {
    updated.preGameFluency = tracker.recentWordCounts.length > 0
      ? tracker.recentWordCounts.reduce((s, w) => s + w, 0) / tracker.recentWordCounts.length
      : null;
    updated.postGameTurnCount = 0;
    updated.postGameFluencySum = 0;
  }
  if (updated.preGameFluency != null) {
    updated.postGameTurnCount++;
    updated.postGameFluencySum += turnData.fluencyScore;
  }

  // Cooldown check
  if (turnData.turnNumber - tracker.lastFeedbackTurn < MIN_TURNS_BETWEEN_FEEDBACK) {
    return { tracker: updated, feedback: { type: null, text: null, delivery: 'none' } };
  }

  // Need at least 3 turns of data
  if (updated.recentLatencies.length < 3) {
    return { tracker: updated, feedback: { type: null, text: null, delivery: 'none' } };
  }

  // === Check feedback conditions (priority order) ===

  // 1. Successful repair
  if (turnData.wasRepairSuccessful && turnData.wordCount >= 4) {
    updated.lastFeedbackTurn = turnData.turnNumber;
    return {
      tracker: updated,
      feedback: {
        type: 'successful_repair',
        text: pickRandom(REPAIR_FEEDBACK),
        delivery: 'prepend',
      },
    };
  }

  // 2. Faster response (last 2 turns faster than first 2)
  const latencies = updated.recentLatencies.filter(l => l > 0);
  if (latencies.length >= 4) {
    const earlyAvg = avg(latencies.slice(0, 2));
    const recentAvg = avg(latencies.slice(-2));
    if (recentAvg < earlyAvg * 0.7 && earlyAvg > 1500) {
      updated.lastFeedbackTurn = turnData.turnNumber;
      return {
        tracker: updated,
        feedback: {
          type: 'faster_response',
          text: pickRandom(FASTER_FEEDBACK),
          delivery: 'prepend',
        },
      };
    }
  }

  // 3. Fewer cues needed
  const cues = updated.recentCueLevels;
  if (cues.length >= 4) {
    const earlyCues = avg(cues.slice(0, 2));
    const recentCues = avg(cues.slice(-2));
    if (earlyCues >= 2 && recentCues < 1) {
      updated.lastFeedbackTurn = turnData.turnNumber;
      return {
        tracker: updated,
        feedback: {
          type: 'fewer_cues',
          text: pickRandom(FEWER_CUES_FEEDBACK),
          delivery: 'prepend',
        },
      };
    }
  }

  // 4. Longer speech
  const wc = updated.recentWordCounts;
  if (wc.length >= 4) {
    const earlyWC = avg(wc.slice(0, 2));
    const recentWC = avg(wc.slice(-2));
    if (recentWC > earlyWC * 1.5 && earlyWC < 5 && recentWC >= 5) {
      updated.lastFeedbackTurn = turnData.turnNumber;
      return {
        tracker: updated,
        feedback: {
          type: 'longer_speech',
          text: pickRandom(LONGER_FEEDBACK),
          delivery: 'prepend',
        },
      };
    }
  }

  // 5. Post-game boost
  if (updated.preGameFluency != null && updated.postGameTurnCount >= 2) {
    const postAvg = updated.postGameFluencySum / updated.postGameTurnCount;
    if (postAvg > updated.preGameFluency * 1.15) {
      updated.lastFeedbackTurn = turnData.turnNumber;
      updated.preGameFluency = null; // Only once
      return {
        tracker: updated,
        feedback: {
          type: 'game_boost',
          text: pickRandom(GAME_BOOST_FEEDBACK),
          delivery: 'prepend',
        },
      };
    }
  }

  return { tracker: updated, feedback: { type: null, text: null, delivery: 'none' } };
}

// === Feedback text pools ===

const REPAIR_FEEDBACK = [
  "You got it — nice recovery. That's exactly how it works in real conversations.",
  "There it is! You found the word. That's the skill that helps when you're talking to someone.",
  "See? It came to you. That's your brain getting faster at finding words.",
];

const FASTER_FEEDBACK = [
  "You're answering faster now — that's what makes real conversations easier.",
  "Quicker this time — that speed is what helps when you're talking to someone.",
  "That came out fast — that's the kind of flow that matters in real life.",
];

const FEWER_CUES_FEEDBACK = [
  "You needed fewer hints — that means you're finding words more on your own.",
  "Getting more independent — that's exactly what helps in real conversations.",
  "Less help needed — that's real progress for everyday talking.",
];

const LONGER_FEEDBACK = [
  "You're saying more now — that's what makes conversations feel natural.",
  "Longer answers — that's how it gets easier to explain things to people.",
  "More words coming out — that's the kind of momentum that helps in real life.",
];

const GAME_BOOST_FEEDBACK = [
  "That practice helped — you're finding words faster now.",
  "See the difference? That exercise made it easier to talk. That's how it works.",
  "That warm-up paid off — this is how your brain gets better at finding words.",
];

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function avg(nums: number[]): number {
  return nums.length > 0 ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
}
