import { scoredEventPercentages, type ScoredEvidence } from './scoredEvidence';

export interface RecordedPracticeSummary {
  correct: number;
  total: number;
  averagePracticeScorePct: number | null;
}

/** Descriptive in-app practice only, not a validated clinical outcome. */
export function summarizeRecordedPractice(
  events: readonly (ScoredEvidence & { score: number | null })[],
): RecordedPracticeSummary {
  const scores = scoredEventPercentages(events);
  const total = scores.length;
  return {
    correct: scores.filter((score) => score === 100).length,
    total,
    averagePracticeScorePct: total === 0
      ? null
      : scores.reduce((sum, score) => sum + score, 0) / total,
  };
}
