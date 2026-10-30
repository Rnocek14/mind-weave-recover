import { describe, expect, it } from 'vitest';
import type { ScoredRow } from '@/lib/sessionAccuracySummary';
import { summarizeCaseloadClinicalTrials } from './clinicianCaseloadScoring';

function trial(overrides: Partial<ScoredRow> = {}): ScoredRow {
  return {
    score: 100,
    cue_level: 0,
    counts_toward_score: true,
    validity_label: null,
    exercise_slug: 'meaning_match',
    task_parameters: { trial_mode: 'recognition' },
    engagement_flags: null,
    whisper_transcript: null,
    browser_transcript: null,
    ...overrides,
  };
}

describe('clinician caseload metrics use persisted clinical evidence', () => {
  it('excludes non-scorable, manual-confirmed and conversation attempts from the denominator', () => {
    const rows = [
      trial({ score: 100 }),
      trial({ score: 0 }),
      trial({ score: 0, counts_toward_score: false, validity_label: 'no_response' }),
      trial({ score: 100, counts_toward_score: false, validity_label: 'background_noise' }),
      trial({ score: 100, validity_label: 'manual_confirmed' }),
      trial({ score: 100, exercise_slug: 'conversation_coach' }),
      trial({ score: null }),
    ];
    expect(summarizeCaseloadClinicalTrials(rows)).toEqual({
      scoredTrials: 2,
      taskAccuracyPct: 50,
    });
  });

  it('distinguishes real 0% from no measured accuracy', () => {
    expect(summarizeCaseloadClinicalTrials([trial({ score: 0 })])).toEqual({
      scoredTrials: 1,
      taskAccuracyPct: 0,
    });
    expect(summarizeCaseloadClinicalTrials([
      trial({ score: 0, counts_toward_score: false }),
      trial({ score: null }),
    ])).toEqual({
      scoredTrials: 0,
      taskAccuracyPct: null,
    });
  });

  it('preserves the canonical legacy-null validity and explicit cue semantics', () => {
    expect(summarizeCaseloadClinicalTrials([
      trial({ score: 100, counts_toward_score: null, validity_label: null, cue_level: 2 }),
      trial({ score: 0, counts_toward_score: null, validity_label: null, cue_level: 0 }),
    ])).toEqual({ scoredTrials: 2, taskAccuracyPct: 50 });
  });
});
