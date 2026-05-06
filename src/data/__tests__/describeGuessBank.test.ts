/**
 * Ticket B regression tests — Describe & Guess cross-session recency.
 *
 * Verifies:
 *  - `getDescribeGuessTrials` prefers fresh items over recently shown ones
 *  - `markDescribeGuessTrialsShown` persists IDs to localStorage
 *  - The recency window is bounded (cannot grow without limit)
 *  - After every trial in a tier has been seen, recent items are reused
 *    (graceful fallback — no empty result)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDescribeGuessTrials,
  markDescribeGuessTrialsShown,
  DESCRIBE_GUESS_BANK,
} from '../describeGuessBank';

const RECENCY_KEY = 'describeGuess_recentTrialIds_v1';

describe('describeGuessBank recency (Ticket B)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists trial IDs after dispensing', () => {
    const first = getDescribeGuessTrials({ difficulty: 1, count: 3 });
    expect(first.length).toBe(3);

    const stored = JSON.parse(window.localStorage.getItem(RECENCY_KEY) || '[]');
    expect(stored).toEqual(expect.arrayContaining(first.map((t) => t.id)));
  });

  it('prefers fresh trials on the next call when fresh trials exist', () => {
    const tier1 = DESCRIBE_GUESS_BANK.filter((t) => t.difficulty === 1);
    const half = Math.floor(tier1.length / 2);
    expect(half).toBeGreaterThan(0);

    const first = getDescribeGuessTrials({ difficulty: 1, count: half });
    const firstIds = new Set(first.map((t) => t.id));

    const second = getDescribeGuessTrials({ difficulty: 1, count: half });
    const overlap = second.filter((t) => firstIds.has(t.id));

    // Second batch should pull from the fresh remainder, not repeat the first
    expect(overlap.length).toBe(0);
  });

  it('falls back to recent trials when all are exhausted (no empty result)', () => {
    const tier1Count = DESCRIBE_GUESS_BANK.filter((t) => t.difficulty === 1).length;

    // Exhaust all tier-1 trials
    getDescribeGuessTrials({ difficulty: 1, count: tier1Count });

    // Next call should still return items (recycled), not empty
    const next = getDescribeGuessTrials({ difficulty: 1, count: 3 });
    expect(next.length).toBeGreaterThan(0);
  });

  it('bounds the recency window to at most 24 IDs', () => {
    for (let i = 0; i < 10; i++) {
      markDescribeGuessTrialsShown(
        DESCRIBE_GUESS_BANK.slice(0, 8).map((t) => t.id),
      );
    }
    const stored = JSON.parse(window.localStorage.getItem(RECENCY_KEY) || '[]');
    expect(stored.length).toBeLessThanOrEqual(24);
  });

  it('survives a corrupted localStorage value', () => {
    window.localStorage.setItem(RECENCY_KEY, 'not-json{{');
    const result = getDescribeGuessTrials({ difficulty: 1, count: 3 });
    expect(result.length).toBe(3);
  });

  it('markDescribeGuessTrialsShown is a no-op for empty input', () => {
    markDescribeGuessTrialsShown([]);
    const stored = window.localStorage.getItem(RECENCY_KEY);
    expect(stored).toBeNull();
  });
});
