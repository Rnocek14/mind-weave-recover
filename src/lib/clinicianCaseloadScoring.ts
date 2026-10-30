import { reduceAccuracy, type ScoredRow } from '@/lib/sessionAccuracySummary';

/**
 * Clinician caseload accuracy must agree with the canonical persisted session
 * reducer: invalid/no-response/unscorable/manual-confirmed/conversation rows
 * must not silently become failures or successes.
 *
 * A measured 0% is DIFFERENT from no scorable attempts (null).
 */
export function summarizeCaseloadClinicalTrials(rows: ScoredRow[]): {
  scoredTrials: number;
  taskAccuracyPct: number | null;
} {
  const summary = reduceAccuracy(rows);
  return {
    scoredTrials: summary.scored_trials,
    taskAccuracyPct: summary.accuracy,
  };
}
