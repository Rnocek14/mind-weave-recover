/**
 * Momentum Scorer
 * 
 * Calculates momentum score from micro-fluency metrics.
 * High momentum = kept talking, recovered from pauses.
 * Low momentum = many pauses, trailing off, abandonment.
 * 
 * This replaces "accuracy" for flow-shaped games.
 */

import type { MicroFluencyAnalysis } from './microFluencyAnalyzer';
import type { MomentumComponents } from '@/types/thoughtContinuation';

// =============================================================================
// Configuration
// =============================================================================

const MOMENTUM_WEIGHTS = {
  pauseRatio: 0.25,           // Lower is better
  longestPause: 0.20,         // Shorter is better
  filledPauseRate: 0.15,      // Lower is better (but not penalized heavily)
  burstCount: 0.15,           // More bursts can be good (recovery)
  prewordPause: 0.15,         // Shorter is better
  trailingOff: 0.10,          // Heavily penalized
};

// Thresholds for normalization
const THRESHOLDS = {
  pauseRatio: {
    good: 0.2,     // 20% pause is normal
    bad: 0.6,      // 60% pause is concerning
  },
  longestPauseMs: {
    good: 1000,    // 1 second is fine
    bad: 5000,     // 5 seconds is long
  },
  prewordPauseAvgMs: {
    good: 200,     // 200ms is natural
    bad: 1500,     // 1.5s is hesitant
  },
  filledPauseRate: {
    good: 0.05,    // 5% filled pauses is natural
    bad: 0.3,      // 30% is a lot of "um"s
  },
  burstCount: {
    low: 1,        // Single burst = no recovery
    optimal: 3,    // 3 bursts = good flow with natural pauses
    high: 8,       // Too many = choppy
  },
};

// =============================================================================
// Main Scorer
// =============================================================================

export interface MomentumResult {
  score: number;  // 0-1
  components: MomentumComponents;
  qualityNotes: string[];
}

/**
 * Calculate momentum score from micro-fluency analysis.
 * Returns 0-1 where 1 = excellent flow, 0 = no speech or complete breakdown.
 */
export function calculateMomentumScore(
  fluency: MicroFluencyAnalysis | null,
  transcript: string | null,
  durationMs: number
): MomentumResult {
  // No fluency data = can't calculate, assume neutral
  if (!fluency || !transcript || transcript.trim().length === 0) {
    return {
      score: 0,
      components: {
        pauseRatio: 1,
        prewordPauseAvgMs: 0,
        filledPauseRate: 0,
        burstCount: 0,
        longestPauseMs: 0,
        trailingOffDetected: true,
      },
      qualityNotes: ['No speech detected'],
    };
  }

  const qualityNotes: string[] = [];
  
  // Extract raw metrics from fluency (using correct property structure)
  const totalPauseMs = 
    fluency.silentPauses.totalMs + 
    (fluency.filledPauses.count * 300) + // Estimate ~300ms per filled pause
    (fluency.preWordPauses.avgMs * fluency.preWordPauses.count) + 
    (fluency.intraWordPauses.count * 200); // Estimate ~200ms per intra-word pause
  
  const pauseRatio = durationMs > 0 ? totalPauseMs / durationMs : 0;
  const longestPauseMs = fluency.longestPauseMs;
  
  // Count filled pauses (um, uh, etc.) relative to word count
  const wordCount = transcript.trim().split(/\s+/).length;
  const filledPauseRate = wordCount > 0 
    ? fluency.filledPauses.count / wordCount 
    : 0;
  
  const burstCount = fluency.burstCount;
  
  // Pre-word pause average (hesitation before words)
  const prewordPauseAvgMs = fluency.preWordPauses.avgMs;
  
  // Detect trailing off pattern
  const trailingOffDetected = detectTrailingOff(transcript, fluency);
  
  // Build components
  const components: MomentumComponents = {
    pauseRatio,
    prewordPauseAvgMs,
    filledPauseRate,
    burstCount,
    longestPauseMs,
    trailingOffDetected,
  };

  // ==========================================================================
  // Score each component (0-1, higher = better)
  // ==========================================================================
  
  // Pause ratio: lower is better
  const pauseRatioScore = normalizeInverse(
    pauseRatio, 
    THRESHOLDS.pauseRatio.good, 
    THRESHOLDS.pauseRatio.bad
  );
  
  // Longest pause: shorter is better
  const longestPauseScore = normalizeInverse(
    longestPauseMs,
    THRESHOLDS.longestPauseMs.good,
    THRESHOLDS.longestPauseMs.bad
  );
  
  // Preword pause: shorter is better
  const prewordScore = normalizeInverse(
    prewordPauseAvgMs,
    THRESHOLDS.prewordPauseAvgMs.good,
    THRESHOLDS.prewordPauseAvgMs.bad
  );
  
  // Filled pause rate: lower is better, but don't penalize heavily
  const filledPauseScore = normalizeInverse(
    filledPauseRate,
    THRESHOLDS.filledPauseRate.good,
    THRESHOLDS.filledPauseRate.bad
  );
  
  // Burst count: optimal around 3, too few or too many is worse
  const burstScore = normalizeBellCurve(
    burstCount,
    THRESHOLDS.burstCount.low,
    THRESHOLDS.burstCount.optimal,
    THRESHOLDS.burstCount.high
  );
  
  // Trailing off: binary penalty
  const trailingOffScore = trailingOffDetected ? 0.3 : 1.0;
  
  // ==========================================================================
  // Weighted combination
  // ==========================================================================
  
  const weightedScore = 
    pauseRatioScore * MOMENTUM_WEIGHTS.pauseRatio +
    longestPauseScore * MOMENTUM_WEIGHTS.longestPause +
    prewordScore * MOMENTUM_WEIGHTS.prewordPause +
    filledPauseScore * MOMENTUM_WEIGHTS.filledPauseRate +
    burstScore * MOMENTUM_WEIGHTS.burstCount +
    trailingOffScore * MOMENTUM_WEIGHTS.trailingOff;
  
  // Add quality notes for debugging
  if (pauseRatioScore < 0.5) qualityNotes.push('High pause ratio');
  if (longestPauseScore < 0.5) qualityNotes.push('Long pause detected');
  if (trailingOffDetected) qualityNotes.push('Trailing off detected');
  if (burstCount === 1) qualityNotes.push('Single speech burst');
  if (burstCount > 6) qualityNotes.push('Choppy speech pattern');
  
  // Clamp to 0-1
  const finalScore = Math.max(0, Math.min(1, weightedScore));
  
  return {
    score: finalScore,
    components,
    qualityNotes,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Normalize a value where lower is better.
 * Returns 1 when value <= good, 0 when value >= bad.
 */
function normalizeInverse(value: number, good: number, bad: number): number {
  if (value <= good) return 1;
  if (value >= bad) return 0;
  return 1 - (value - good) / (bad - good);
}

/**
 * Bell curve normalization: optimal value gets 1, extremes get lower.
 */
function normalizeBellCurve(
  value: number, 
  low: number, 
  optimal: number, 
  high: number
): number {
  if (value <= low) return 0.5;  // Too few
  if (value >= high) return 0.5; // Too many
  if (value === optimal) return 1;
  
  if (value < optimal) {
    // Between low and optimal
    return 0.5 + 0.5 * (value - low) / (optimal - low);
  } else {
    // Between optimal and high
    return 1 - 0.5 * (value - optimal) / (high - optimal);
  }
}

/**
 * Detect trailing off pattern ("and... yeah...", "so... um...")
 */
function detectTrailingOff(transcript: string, fluency: MicroFluencyAnalysis): boolean {
  const normalized = transcript.toLowerCase().trim();
  
  // Check for common trailing patterns
  const trailingPatterns = [
    /\.\.\.\s*(yeah|yep|so|um|uh|and|but)\s*\.{0,3}$/,
    /\s+(yeah|yep|so)\s*\.{0,3}$/,
    /\s+and\s*\.{0,3}$/,
    /\.\.\.\s*$/,
  ];
  
  for (const pattern of trailingPatterns) {
    if (pattern.test(normalized)) {
      return true;
    }
  }
  
  // Also check fluency: if last phrase break is very long, likely trailing
  if (fluency.phraseBreaks.count > 0 && fluency.longestPauseMs > 3000) {
    // Long pause near end suggests trailing off
    return true;
  }
  
  return false;
}

// =============================================================================
// Momentum Trend Analysis (for progress tracking)
// =============================================================================

export interface MomentumTrend {
  avgScore: number;
  scoreChange: number;  // vs previous period
  avgLatencyMs: number;
  latencyChange: number;
  completionRate: number;
  hintsNeededRate: number;
}

export function calculateMomentumTrend(
  recentScores: { score: number; latencyMs: number; complete: boolean; hintUsed: boolean }[],
  previousScores: { score: number; latencyMs: number; complete: boolean; hintUsed: boolean }[]
): MomentumTrend {
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  
  const recentAvg = avg(recentScores.map(s => s.score));
  const previousAvg = avg(previousScores.map(s => s.score));
  
  const recentLatency = avg(recentScores.map(s => s.latencyMs));
  const previousLatency = avg(previousScores.map(s => s.latencyMs));
  
  const completionRate = recentScores.length > 0
    ? recentScores.filter(s => s.complete).length / recentScores.length
    : 0;
  
  const hintsNeededRate = recentScores.length > 0
    ? recentScores.filter(s => s.hintUsed).length / recentScores.length
    : 0;
  
  return {
    avgScore: recentAvg,
    scoreChange: recentAvg - previousAvg,
    avgLatencyMs: recentLatency,
    latencyChange: recentLatency - previousLatency,
    completionRate,
    hintsNeededRate,
  };
}
