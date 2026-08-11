import { describe, it, expect } from "vitest";
import { FIX_SENTENCE_BANK, FIX_SENTENCE_TWO_ERROR_BANK } from "@/data/fixSentenceBank";
import {
  selectTwoErrorCandidates,
  selectFixSentencePool,
  TWO_ERROR_GAME_READY,
  MIN_TIER_POOL_SIZE,
} from "@/lib/progression/fixSentenceContentSelector";

/** 1-based word position of `word` in `sentence` (punctuation stripped). */
function wordPosition(sentence: string, word: string, nth = 1): number {
  const words = sentence
    .toLowerCase()
    .replace(/[.,!?'"]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  let seen = 0;
  for (let i = 0; i < words.length; i++) {
    if (words[i] === word.toLowerCase()) {
      seen += 1;
      if (seen === nth) return i + 1;
    }
  }
  return -1;
}

describe("two-error bank integrity", () => {
  it("has at least the selector's minimum pool", () => {
    expect(selectTwoErrorCandidates().length).toBeGreaterThanOrEqual(MIN_TIER_POOL_SIZE);
  });

  it("every trial defines a genuine, distinct second error", () => {
    for (const t of FIX_SENTENCE_TWO_ERROR_BANK) {
      expect(t.secondError, t.id).toBeDefined();
      expect(t.secondError!.wrongWord, t.id).not.toBe(t.wrongWord);
      expect(t.secondError!.acceptedFixes.length, t.id).toBeGreaterThan(0);
      expect(t.acceptedFixes.length, t.id).toBeGreaterThan(0);
    }
  });

  it("wrongWordIndex values are COMPUTED-correct 1-based positions", () => {
    // Hand-authored indices have produced off-by-ones repeatedly; this
    // computes them from the sentence so the class of error cannot recur.
    for (const t of FIX_SENTENCE_TWO_ERROR_BANK) {
      expect(wordPosition(t.sentence, t.wrongWord), `${t.id} primary`).toBe(t.wrongWordIndex);
      // The second error may reuse a word form; find the occurrence AT the
      // declared index rather than assuming first occurrence.
      const words = t.sentence.toLowerCase().replace(/[.,!?'"]/g, " ").split(/\s+/).filter(Boolean);
      expect(words[t.secondError!.wrongWordIndex - 1], `${t.id} second`).toBe(
        t.secondError!.wrongWord.toLowerCase()
      );
    }
  });

  it("two-error trials never leak into the single-error bank", () => {
    for (const t of FIX_SENTENCE_BANK) {
      expect(t.secondError, t.id).toBeUndefined();
    }
  });

  it("the L5 selector skips honestly while the game gate is off", () => {
    if (TWO_ERROR_GAME_READY) return; // becomes moot once the loop ships
    const result = selectFixSentencePool(5);
    expect(result.fallback?.skipped).toBe(true);
    // And the fallback pool must contain no two-error sentences.
    for (const t of result.pool) {
      expect(t.secondError, t.id).toBeUndefined();
    }
  });

  it("serves the two-error cohort at L5 once the gate flips", () => {
    if (!TWO_ERROR_GAME_READY) return;
    const result = selectFixSentencePool(5);
    expect(result.reason).toBe("two_error");
    expect(result.pool.every((t) => t.secondError != null)).toBe(true);
  });
});
