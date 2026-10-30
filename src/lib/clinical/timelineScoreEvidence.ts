/**
 * Task-score summary for PatientHub session timeline and per-exercise rows.
 *
 * A score exists only for eligible clinical practice. Explicit invalid/noise
 * events and manual confirmations are not automatically task-score failures.
 * Uses the same read-side validity and 0..1 / 0..100 score compatibility
 * contract already used by useWeeklySessionStats.
 */
import { scoredEventPercentages, type ScoredEvidence } from '@/lib/clinical/scoredEvidence';

export interface TimelineScoreEvidence extends ScoredEvidence {
  score: number | null;
}

export interface TimelineScoreSummary {
  /** Number of scorable attempts (not every raw interaction). */
  scoredTrials: number;
  fullyCorrectTrials: number;
  /** Sum retained to weight across sessions without rounding intermediate means. */
  scoreSumPct: number;
  /** Task-score mean; null if no eligible clinical measurements. */
  accuracyPct: number | null;
}

export function summarizeTimelineScore(rows: readonly TimelineScoreEvidence[]): TimelineScoreSummary {
  const scores = scoredEventPercentages(rows);
  const scoredTrials = scores.length;
  const scoreSumPct = scores.reduce((sum, value) => sum + value, 0);
  return {
    scoredTrials,
    fullyCorrectTrials: scores.filter(score => score === 100).length,
    scoreSumPct,
    accuracyPct: scoredTrials ? Math.round(scoreSumPct / scoredTrials * 10) / 10 : null,
  };
}
