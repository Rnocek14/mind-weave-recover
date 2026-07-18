import { describe, it, expect } from "vitest";
import { matchAnswer } from "@/lib/answerMatcher";

/**
 * Foil gate: a spoken word that IS a known foil for the trial must never be
 * fuzzy-promoted to correct. Without this, minimal-pair neighbors ("cap" for
 * target "cat") pass the ≤4-char Levenshtein threshold and score as correct,
 * defeating the exercise and inflating accuracy.
 */
describe("answerMatcher foil gate", () => {
  it("never fuzzy-promotes a phonological foil to correct", () => {
    const result = matchAnswer("cap", "cat", ["dog", "mouse"], "animals", ["cap", "hat", "bat"]);
    expect(result.countsAsCorrect).toBe(false);
    expect(result.inferredWord).toBe("cap");
  });

  it("never fuzzy-promotes a semantic foil to correct", () => {
    // "boot" vs "shoe" won't fuzzy match, but a close semantic foil could:
    // target "pen", foil "pin" (1 edit apart)
    const result = matchAnswer("pin", "pen", ["pin", "pencil"], "objects");
    expect(result.countsAsCorrect).toBe(false);
  });

  it("still allows genuine near-miss attempts that are NOT foils", () => {
    // "dat" for "cat" — classic aphasic phonetic error, not a listed foil
    const result = matchAnswer("dat", "cat", ["dog", "mouse"], "animals", ["hat", "bat"]);
    expect(result.countsAsCorrect).toBe(true);
    expect(result.matchType).toBe("phonetic_close");
  });

  it("blocks partial-fragment promotion when the fragment is a foil", () => {
    // target "carrot", foil "car" — saying "car" must not count as a fragment of carrot
    const result = matchAnswer("car", "carrot", ["car"], "food");
    expect(result.countsAsCorrect).toBe(false);
  });

  it("still allows genuine partial fragments", () => {
    const result = matchAnswer("ele", "elephant", ["giraffe"], "animals");
    expect(result.countsAsCorrect).toBe(true);
    expect(result.matchType).toBe("partial_fragment");
  });

  it("exact target match still wins even if similar to a foil", () => {
    const result = matchAnswer("cat", "cat", ["dog"], "animals", ["cap", "hat"]);
    expect(result.countsAsCorrect).toBe(true);
    expect(result.matchType).toBe("exact");
  });
});
