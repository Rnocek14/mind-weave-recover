/**
 * The Describe & Guess cut-off, pinned.
 *
 * REPORTED: "you start talking and it maybe lets you get one sentence out
 * before it takes the answer. realistically you are answering three questions,
 * what it looks like, where you find it, what its used for. once you say one
 * of those it takes the answer."
 *
 * The shared classifier calls any 3+ word utterance 'complete' after 800ms of
 * quiet, and the shared discourse profile turns that into a 1080ms threshold.
 * These tests assert that this game no longer finalizes on that number, and —
 * just as importantly — that it can still always finish.
 */
import { describe, it, expect } from 'vitest';
import {
  decideAutoSubmit,
  DG_MIN_SILENCE_MS,
  DG_THIN_COVERAGE_SILENCE_MS,
  DG_BACKSTOP_ELAPSED_MS,
  DG_HARD_CAP_MS,
} from '@/lib/describeGuess/autoSubmitDecision';

/** What the old inline code computed for a 'complete' 3+ word utterance. */
const CLASSIFIER_COMPLETE_MS = 1080;

const base = {
  silenceMs: 0,
  elapsedMs: 5_000,
  featureCount: 1,
  classifierThresholdMs: CLASSIFIER_COMPLETE_MS,
  suppressAutoSubmit: false,
};

describe('the reported bug', () => {
  it('does not take the answer at the old 1.1 second threshold', () => {
    // This is the exact case the user hit: one sentence out, one feature
    // covered, a short pause to find the next thought.
    const d = decideAutoSubmit({ ...base, silenceMs: 1200 });
    expect(d.shouldEvaluate).toBe(false);
  });

  it('still waits through a long word-finding pause when the answer is unfinished', () => {
    // A person with aphasia routinely pauses several seconds mid-answer.
    const d = decideAutoSubmit({ ...base, silenceMs: 5_000, featureCount: 1 });
    expect(d.shouldEvaluate).toBe(false);
    expect(d.thresholdMs).toBe(DG_THIN_COVERAGE_SILENCE_MS);
  });

  it('never finalizes faster than the floor, even with full coverage', () => {
    const d = decideAutoSubmit({ ...base, silenceMs: DG_MIN_SILENCE_MS - 1, featureCount: 3 });
    expect(d.shouldEvaluate).toBe(false);
    expect(d.thresholdMs).toBe(DG_MIN_SILENCE_MS);
  });
});

describe('finishing normally', () => {
  it('accepts a real stop once the answer is covered', () => {
    const d = decideAutoSubmit({ ...base, silenceMs: DG_MIN_SILENCE_MS, featureCount: 2 });
    expect(d.shouldEvaluate).toBe(true);
    expect(d.reason).toBe('silence');
  });

  it('accepts a longer stop when coverage is thin', () => {
    const d = decideAutoSubmit({ ...base, silenceMs: DG_THIN_COVERAGE_SILENCE_MS, featureCount: 0 });
    expect(d.shouldEvaluate).toBe(true);
    expect(d.reason).toBe('thin-coverage');
  });

  it('is more patient with one feature than with two', () => {
    const thin = decideAutoSubmit({ ...base, featureCount: 1 });
    const covered = decideAutoSubmit({ ...base, featureCount: 2 });
    expect(thin.thresholdMs).toBeGreaterThan(covered.thresholdMs);
  });
});

describe('never makes the shared classifier less patient', () => {
  it('honours a suppression request', () => {
    // The classifier owns "they are clearly still struggling". We only ever
    // extend patience, never shorten it.
    const d = decideAutoSubmit({ ...base, silenceMs: 60_000, suppressAutoSubmit: true });
    expect(d.shouldEvaluate).toBe(false);
    expect(d.reason).toBe('suppressed');
  });

  it('adopts the classifier threshold when it is already longer than our floor', () => {
    const d = decideAutoSubmit({ ...base, classifierThresholdMs: 9_000, featureCount: 3, silenceMs: 8_000 });
    expect(d.shouldEvaluate).toBe(false);
    expect(d.thresholdMs).toBe(9_000);
  });
});

describe('a trial can always end', () => {
  // Raising the floor without these would trade a cut-off for a stuck
  // session, which is worse. There is no other maximum-listening cap in
  // this game.
  it('ends on the backstop after a long listen with a reasonable pause', () => {
    const d = decideAutoSubmit({
      ...base,
      elapsedMs: DG_BACKSTOP_ELAPSED_MS,
      silenceMs: 2_000,
      featureCount: 0,
    });
    expect(d.shouldEvaluate).toBe(true);
    expect(d.reason).toBe('backstop');
  });

  it('ends at the hard cap even mid-speech', () => {
    const d = decideAutoSubmit({
      ...base,
      elapsedMs: DG_HARD_CAP_MS,
      silenceMs: 0,
      featureCount: 0,
      suppressAutoSubmit: true,
    });
    expect(d.shouldEvaluate).toBe(true);
    expect(d.reason).toBe('hard-cap');
  });

  it('does not cut someone off who is still talking before the cap', () => {
    const d = decideAutoSubmit({
      ...base,
      elapsedMs: DG_BACKSTOP_ELAPSED_MS + 10_000,
      silenceMs: 0,
      featureCount: 0,
    });
    expect(d.shouldEvaluate).toBe(false);
  });
});
