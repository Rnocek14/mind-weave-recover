/**
 * Smart Coach — Progress Detector
 * 
 * Detects meaningful within-session improvement moments.
 * Surfaces at most 1-2 per session to avoid noise.
 * 
 * Every signal must be tied to something measurable or clearly observed.
 */

import type { NormalizedExerciseResult } from '@/lib/normalizedExerciseResult';

// ─── Types ──────────────────────────────────────────────────

export interface ProgressMoment {
  type: 'score_jump' | 'fewer_cues' | 'faster' | 'independent' | 'transfer_success' | 'cross_game_growth';
  /** Human-readable, grounded description */
  text: string;
  /** Confidence 0-1 */
  confidence: number;
}

// ─── Detector ───────────────────────────────────────────────

/**
 * Detect progress moments between game 1 and game 2 results.
 * Returns the most meaningful moment (max 1).
 */
export function detectProgressMoment(
  game1: NormalizedExerciseResult | null,
  game2: NormalizedExerciseResult | null,
  transferScore: number,
): ProgressMoment | null {
  const moments: ProgressMoment[] = [];

  if (game1 && game2) {
    const s1 = Math.round(game1.score * 100);
    const s2 = Math.round(game2.score * 100);
    const delta = s2 - s1;

    // Score jump across games
    if (delta >= 15) {
      moments.push({
        type: 'cross_game_growth',
        text: `${delta} points higher on the second round — your brain warmed up and found the words faster.`,
        confidence: 0.9,
      });
    } else if (delta >= 5) {
      moments.push({
        type: 'score_jump',
        text: `${s1}% → ${s2}% — steady improvement across both practices.`,
        confidence: 0.7,
      });
    }

    // Both games strong
    if (s1 >= 80 && s2 >= 80) {
      moments.push({
        type: 'independent',
        text: `${s1}% and ${s2}% — reliable retrieval across two different exercises. Those words are becoming automatic.`,
        confidence: 0.85,
      });
    }

    // Game 2 strong after weak game 1
    if (s1 < 50 && s2 >= 70) {
      moments.push({
        type: 'cross_game_growth',
        text: `Tough first round at ${s1}%, but ${s2}% on the second — the practice activated what you needed.`,
        confidence: 0.8,
      });
    }

    // Fewer cues: if game 2 difficulty tier is higher, user needed less support
    if (game2.difficultyTier > game1.difficultyTier) {
      moments.push({
        type: 'fewer_cues',
        text: `Handled higher difficulty on the second round — less support needed.`,
        confidence: 0.65,
      });
    }
  }

  // Strong transfer
  if (transferScore >= 4) {
    moments.push({
      type: 'transfer_success',
      text: `Used the words in context — that's the bridge from practice to real conversation.`,
      confidence: 0.85,
    });
  }

  // Single game progress signals
  if (game1 && !game2) {
    const s = Math.round(game1.score * 100);
    if (s >= 85) {
      moments.push({
        type: 'independent',
        text: `${s}% — words came out with speed and confidence. That retrieval quality transfers to real life.`,
        confidence: 0.75,
      });
    }
  }

  // Return the highest confidence moment
  if (moments.length === 0) return null;
  moments.sort((a, b) => b.confidence - a.confidence);
  return moments[0];
}

/**
 * Format a progress moment for the closing screen.
 * Prefixed with a small marker for visual weight.
 */
export function formatProgressForClosing(moment: ProgressMoment): string {
  return moment.text;
}
