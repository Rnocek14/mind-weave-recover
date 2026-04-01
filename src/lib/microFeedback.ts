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
  "You got it — nice recovery. That's what helps when you're explaining something.",
  "There it is! You found the word yourself. That's what counts.",
  "See? It came to you. That's getting quicker each time.",
  "That's the moment — when it clicks. That's what we're building.",
  "You found it on your own. That's what makes everyday talking easier.",
];

const FASTER_FEEDBACK = [
  "That came out quicker than before — that's what makes talking to someone smoother.",
  "Faster this time. That kind of speed helps when you're explaining something.",
  "Quicker response — did that one feel easier? That's what we want.",
  "That was noticeably faster. That's the kind of thing that helps in everyday situations.",
];

const FEWER_CUES_FEEDBACK = [
  "You needed less help that time — that's what builds confidence when you talk.",
  "Getting more independent — that's what makes everyday conversations easier.",
  "Less support needed. That matters when you're talking on your own.",
  "You're finding words with less help. That's a real shift.",
];

const LONGER_FEEDBACK = [
  "You're saying more now — that's what makes conversations feel like yours.",
  "Longer answers — that's how it gets easier to explain things to people.",
  "More words coming out. That kind of momentum helps when you're telling someone something.",
  "That was a full thought — that's what it looks like when things are clicking.",
];

const GAME_BOOST_FEEDBACK = [
  "That practice helped — words are coming easier now. Did you notice?",
  "See the difference? That exercise loosened things up for talking.",
  "That warm-up paid off — everything flows a bit better after that.",
  "After that practice, things should come a little quicker. That's how it works.",
];

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function avg(nums: number[]): number {
  return nums.length > 0 ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
}
