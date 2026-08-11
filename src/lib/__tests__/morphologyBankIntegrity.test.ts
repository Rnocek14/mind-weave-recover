import { describe, it, expect } from "vitest";
import { FIX_SENTENCE_BANK, FIX_SENTENCE_MORPHOLOGY_BANK } from "@/data/fixSentenceBank";
import {
  selectMorphologyCandidates,
  selectFixSentencePool,
  MORPHOLOGY_GAME_READY,
  MIN_TIER_POOL_SIZE,
} from "@/lib/progression/fixSentenceContentSelector";

/** 1-based word position of `word` in `sentence` (punctuation stripped). */
function wordPosition(sentence: string, word: string): number {
  const words = sentence
    .toLowerCase()
    .replace(/[.,!?'"]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (words[i] === word.toLowerCase()) return i + 1;
  }
  return -1;
}

describe("morphology bank integrity (L6 cohort contract)", () => {
  it("has at least the selector's minimum pool", () => {
    expect(selectMorphologyCandidates().length).toBeGreaterThanOrEqual(MIN_TIER_POOL_SIZE);
  });

  it("every trial carries a well-formed morphology block", () => {
    for (const t of FIX_SENTENCE_MORPHOLOGY_BANK) {
      expect(t.morphology, t.id).toBeDefined();
      expect(t.errorType, t.id).toBe("morphology_error");
      expect(t.difficulty, t.id).toBe(3);
      expect(t.morphology!.erroneousForm, t.id).toBe(t.wrongWord);
      expect(t.acceptedFixes, t.id).toContain(t.morphology!.requiredForm);
      expect(t.morphology!.requiredForm, t.id).not.toBe(t.morphology!.baseForm);
    }
  });

  it("the bare base form is never an accepted fix or alias (spec §3.3)", () => {
    for (const t of FIX_SENTENCE_MORPHOLOGY_BANK) {
      const base = t.morphology!.baseForm.toLowerCase();
      for (const fix of t.acceptedFixes) {
        expect(fix.toLowerCase(), `${t.id}: fix "${fix}"`).not.toBe(base);
      }
      for (const aliases of Object.values(t.fixAliases)) {
        for (const a of aliases) {
          expect(a.toLowerCase(), `${t.id}: alias "${a}"`).not.toBe(base);
        }
      }
    }
  });

  it("wrongWordIndex values are COMPUTED-correct 1-based positions", () => {
    for (const t of FIX_SENTENCE_MORPHOLOGY_BANK) {
      expect(wordPosition(t.sentence, t.wrongWord), t.id).toBe(t.wrongWordIndex);
    }
  });

  it("sentences sit in the L4/L5 length register (8–14 words)", () => {
    for (const t of FIX_SENTENCE_MORPHOLOGY_BANK) {
      const n = t.sentence.replace(/[.,!?'"]/g, " ").split(/\s+/).filter(Boolean).length;
      expect(n, `${t.id}: ${n} words`).toBeGreaterThanOrEqual(8);
      expect(n, `${t.id}: ${n} words`).toBeLessThanOrEqual(14);
    }
  });

  it('cohort spans ≥3 error classes so "mixed" is honest', () => {
    const classes = new Set(FIX_SENTENCE_MORPHOLOGY_BANK.map((t) => t.morphology!.errorClass));
    expect(classes.size).toBeGreaterThanOrEqual(3);
  });

  it("morphology trials never leak into the single-error bank", () => {
    for (const t of FIX_SENTENCE_BANK) {
      expect(t.morphology, t.id).toBeUndefined();
      expect(t.errorType, t.id).not.toBe("morphology_error");
    }
  });

  it("the L6 selector skips honestly while the game gate is off", () => {
    if (MORPHOLOGY_GAME_READY) return; // moot once the tier ships
    const result = selectFixSentencePool(6);
    expect(result.fallback?.skipped).toBe(true);
    for (const t of result.pool) {
      expect(t.morphology, t.id).toBeUndefined();
    }
  });

  it("serves the morphology cohort at L6 once the gate flips", () => {
    if (!MORPHOLOGY_GAME_READY) return;
    const result = selectFixSentencePool(6);
    expect(result.reason).toBe("mixed_morphology");
    expect(result.fallback).toBeNull();
    expect(result.pool.every((t) => t.morphology != null)).toBe(true);
  });
});
