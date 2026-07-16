import { describe, it, expect } from "vitest";
import {
  getKidsPhotoPool,
  getKidsPhotoTrials,
  KIDS_SENTENCE_TRIALS,
  getKidsMixedSentenceTrials,
  getKidsPraise,
} from "@/data/kidsContent";

describe("kids photo pool", () => {
  it("only contains early-acquired, easy-tier words", () => {
    const pool = getKidsPhotoPool();
    expect(pool.length).toBeGreaterThan(30); // enough for varied sessions
    for (const trial of pool) {
      expect(trial.features.age_of_acquisition).toBeLessThanOrEqual(6);
      expect(trial.computed_difficulty).toBeLessThanOrEqual(3);
    }
  });

  it("dedupes targets and honors the requested count", () => {
    const trials = getKidsPhotoTrials(10);
    expect(trials).toHaveLength(10);
    const targets = trials.map((t) => t.target.toLowerCase());
    expect(new Set(targets).size).toBe(targets.length);
  });

  it("every trial has an image and foils (playable in the photo game)", () => {
    for (const trial of getKidsPhotoPool()) {
      expect(trial.imageUrl).toBeTruthy();
      expect(trial.semanticFoils.length).toBeGreaterThan(0);
    }
  });
});

describe("kids sentence bank", () => {
  it("stays within kid difficulty levels 1-3", () => {
    for (const t of KIDS_SENTENCE_TRIALS) {
      expect(t.difficulty).toBeGreaterThanOrEqual(1);
      expect(t.difficulty).toBeLessThanOrEqual(3);
    }
  });

  it("options always contain every word of the correct answer (case-insensitive multiset)", () => {
    for (const t of KIDS_SENTENCE_TRIALS) {
      const optionCounts = new Map<string, number>();
      for (const o of t.options) {
        const k = o.toLowerCase();
        optionCounts.set(k, (optionCounts.get(k) ?? 0) + 1);
      }
      for (const w of t.correctAnswer) {
        const k = w.toLowerCase();
        const remaining = optionCounts.get(k) ?? 0;
        expect(remaining, `"${t.id}": answer word "${w}" missing from options`).toBeGreaterThan(0);
        optionCounts.set(k, remaining - 1);
      }
    }
  });

  it("distractors are in options but never in the correct answer", () => {
    for (const t of KIDS_SENTENCE_TRIALS) {
      const answer = new Set(t.correctAnswer.map((w) => w.toLowerCase()));
      for (const d of t.distractors) {
        expect(t.options.map((o) => o.toLowerCase())).toContain(d.toLowerCase());
        expect(answer.has(d.toLowerCase()), `"${t.id}": distractor "${d}" is in the answer`).toBe(false);
      }
    }
  });

  it("has unique ids that never collide with the adult bank convention", () => {
    const ids = KIDS_SENTENCE_TRIALS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith("kid_")).toBe(true);
  });

  it("clamps out-of-range levels and pads short levels to the requested count", () => {
    expect(getKidsMixedSentenceTrials(9, 5)).toHaveLength(5); // clamps to 3
    expect(getKidsMixedSentenceTrials(0, 5)).toHaveLength(5); // clamps to 1
    const padded = getKidsMixedSentenceTrials(2, 10); // level 2 has < 10 items
    expect(padded).toHaveLength(10);
  });
});

describe("kids praise", () => {
  it("returns a non-empty string", () => {
    expect(getKidsPraise().length).toBeGreaterThan(0);
  });
});
