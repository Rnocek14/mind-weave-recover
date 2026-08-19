/**
 * The grouping key is the whole value of the feedback feature: without it a
 * popular bug arrives as forty rows and the inbox stops being read. These
 * tests pin the two properties that matter — the same bug always groups, and
 * genuinely different bugs never do.
 */
import { describe, it, expect } from 'vitest';
import {
  reportSignature,
  reportHeadline,
  normalizeForSignature,
} from '@/lib/feedback/reportSignature';
import { buildTrialReport } from '@/lib/feedback/submitTrialReport';
import {
  recordLastTrial,
  getRecentTrial,
  clearLastTrial,
} from '@/lib/feedback/lastTrial';

const base = {
  exerciseSlug: 'category-fluency',
  stimulusId: 'jobs',
  expected: 'plumber',
  spoken: 'plumbing',
  isCorrect: false,
};

describe('reportSignature', () => {
  it('groups two people hitting the same bug', () => {
    expect(reportSignature(base)).toBe(reportSignature({ ...base }));
  });

  it('ignores differences that are not the bug', () => {
    // Case, punctuation and stray whitespace vary between recognizers and
    // between devices. None of them change which defect this is.
    const noisy = { ...base, spoken: '  Plumbing! ', expected: 'Plumber.' };
    expect(reportSignature(noisy)).toBe(reportSignature(base));
  });

  it('separates a different spoken word', () => {
    expect(reportSignature({ ...base, spoken: 'plunger' })).not.toBe(reportSignature(base));
  });

  it('separates a different item in the same exercise', () => {
    expect(reportSignature({ ...base, stimulusId: 'animals' })).not.toBe(reportSignature(base));
  });

  it('separates the same word in a different exercise', () => {
    expect(reportSignature({ ...base, exerciseSlug: 'photo-naming' })).not.toBe(
      reportSignature(base)
    );
  });

  it('separates wrongly-rejected from wrongly-accepted', () => {
    // Same word, opposite defect. Merging them would hide the rarer and more
    // alarming direction — an answer accepted that should not have been.
    expect(reportSignature({ ...base, isCorrect: true })).not.toBe(reportSignature(base));
  });

  it('is a short stable hex key', () => {
    expect(reportSignature(base)).toMatch(/^[0-9a-f]{8}$/);
  });

  it('survives missing fields without throwing', () => {
    const sparse = { exerciseSlug: 'minimal-pairs', isCorrect: false };
    expect(reportSignature(sparse)).toMatch(/^[0-9a-f]{8}$/);
    expect(reportSignature(sparse)).toBe(reportSignature({ ...sparse, spoken: null, expected: undefined }));
  });
});

describe('normalizeForSignature', () => {
  it('is empty for nothing', () => {
    expect(normalizeForSignature(null)).toBe('');
    expect(normalizeForSignature(undefined)).toBe('');
    expect(normalizeForSignature('   ')).toBe('');
  });

  it('flattens case, punctuation and spacing', () => {
    expect(normalizeForSignature("It's   a TIN-opener!")).toBe('its a tin opener');
  });
});

describe('reportHeadline', () => {
  it('reads as one line without joining anything', () => {
    expect(reportHeadline(base)).toBe(
      'category-fluency: said "plumbing", wanted "plumber" — rejected'
    );
  });

  it('says so plainly when nothing was heard', () => {
    expect(reportHeadline({ ...base, spoken: null })).toContain('(nothing heard)');
  });
});

describe('lastTrial', () => {
  const trial = {
    exerciseSlug: 'fix-sentence',
    sessionId: 's1',
    level: 3,
    trialIndex: 2,
    stimulusId: 'fs_3',
    expected: 'knot',
    userResponse: 'knot',
    browserTranscript: 'not',
    isCorrect: false,
    cueLevel: 1,
  };

  it('returns the trial while it is still the one on screen', () => {
    recordLastTrial(trial, 1_000);
    expect(getRecentTrial(120_000, 5_000)?.stimulusId).toBe('fs_3');
  });

  it('goes quiet once the trial is stale', () => {
    // The button should disappear rather than offer to report something the
    // person has already forgotten.
    recordLastTrial(trial, 1_000);
    expect(getRecentTrial(120_000, 200_000)).toBeNull();
  });

  it('clears, so a report cannot leak across exercises', () => {
    recordLastTrial(trial, 1_000);
    clearLastTrial();
    expect(getRecentTrial(120_000, 2_000)).toBeNull();
  });
});

describe('buildTrialReport', () => {
  const trial = {
    exerciseSlug: 'category-fluency',
    sessionId: 'sess-1',
    level: 2,
    trialIndex: 4,
    stimulusId: 'jobs',
    expected: 'plumber',
    userResponse: 'plumbing',
    browserTranscript: 'plumbing',
    isCorrect: false,
    cueLevel: 0,
    at: 1000,
  };

  it('carries enough context to reproduce the defect without asking anyone', () => {
    const r = buildTrialReport(trial, 'should_have_counted');
    expect(r.exercise_slug).toBe('category-fluency');
    expect(r.stimulus_id).toBe('jobs');
    expect(r.expected_response).toBe('plumber');
    expect(r.browser_transcript).toBe('plumbing');
    expect(r.scored_correct).toBe(false);
    expect(r.headline).toContain('plumbing');
  });

  it('groups the same defect reported by two people', () => {
    const a = buildTrialReport(trial, 'should_have_counted');
    const b = buildTrialReport({ ...trial, sessionId: 'sess-2', at: 99999 }, 'should_have_counted');
    expect(a.signature).toBe(b.signature);
  });

  it('separates the same word reported for a different problem', () => {
    // "it scored me wrong" and "it never heard me" need different fixes.
    const scoring = buildTrialReport(trial, 'should_have_counted');
    const mic = buildTrialReport(trial, 'not_heard');
    expect(scoring.signature).not.toBe(mic.signature);
  });

  it('groups on what the recognizer heard, not the cleaned-up response', () => {
    const a = buildTrialReport(trial, 'should_have_counted');
    const b = buildTrialReport({ ...trial, userResponse: 'something else' }, 'should_have_counted');
    expect(a.signature).toBe(b.signature);
  });

  it('treats an empty note as no note, and caps a long one', () => {
    expect(buildTrialReport(trial, 'not_heard', '   ').note).toBeNull();
    expect(buildTrialReport(trial, 'not_heard', undefined).note).toBeNull();
    expect(buildTrialReport(trial, 'not_heard', 'x'.repeat(5000)).note).toHaveLength(1000);
  });
});
