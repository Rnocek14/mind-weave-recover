import { describe, expect, it } from 'vitest';
import { summarizeTimelineScore, type TimelineScoreEvidence } from './timelineScoreEvidence';

function trial(score: number | null, extra: Partial<TimelineScoreEvidence> = {}): TimelineScoreEvidence {
  return {
    score,
    counts_toward_score: true,
    validity_label: 'valid_attempt',
    task_parameters: null,
    engagement_flags: null,
    ...extra,
  };
}

describe('clinical timeline scores track actual scorable task evidence', () => {
  it('excludes speech noise, false no-response events and manual confirmations', () => {
    expect(summarizeTimelineScore([
      trial(100),
      trial(50),
      trial(0),
      trial(0, { counts_toward_score: false, validity_label: 'no_response' }),
      trial(100, { counts_toward_score: false, validity_label: 'background_noise' }),
      trial(100, { validity_label: 'manual_confirmed' }),
      trial(null),
    ])).toEqual({
      scoredTrials: 3,
      fullyCorrectTrials: 1,
      scoreSumPct: 150,
      accuracyPct: 50,
    });
  });

  it('does not collapse missing evidence into 0% while preserving a true measured zero', () => {
    expect(summarizeTimelineScore([
      trial(null),
      trial(20, { counts_toward_score: false }),
    ])).toEqual({
      scoredTrials: 0,
      fullyCorrectTrials: 0,
      scoreSumPct: 0,
      accuracyPct: null,
    });
    expect(summarizeTimelineScore([trial(0)])).toEqual({
      scoredTrials: 1,
      fullyCorrectTrials: 0,
      scoreSumPct: 0,
      accuracyPct: 0,
    });
  });

  it('preserves 0..1 compatibility and clinician review overrides', () => {
    expect(summarizeTimelineScore([
      trial(1),
      trial(0.5),
      trial(100, { clinician_validity_override: 'noise' }),
      trial(40, { clinician_validity_override: 'patient', counts_toward_score: false }),
    ])).toEqual({
      scoredTrials: 3,
      fullyCorrectTrials: 1,
      scoreSumPct: 190,
      accuracyPct: 63.3,
    });
  });
});
