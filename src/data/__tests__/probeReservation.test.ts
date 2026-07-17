import { describe, it, expect } from "vitest";
import {
  RESERVED_PROBE_TARGETS,
  TRAINING_PHOTO_BANK,
  getTrialsForLevel,
  getRandomTrials,
  PHOTO_BANK,
} from "@/data/photoBank";
import { PROBE_WORDS } from "@/data/probeWords";
import { getKidsPhotoPool } from "@/data/kidsContent";
import { selectPhotoNamingPool } from "@/lib/progression/photoNamingContentSelector";

/**
 * Generalization-probe integrity: probe targets must never be trainable.
 * If any of these fail, probe results stop measuring transfer and start
 * measuring practice-item memory (the pr4-probe-bank-cleanup bug).
 */
describe("probe target reservation", () => {
  it("every probe word is covered by the reservation set", () => {
    for (const probe of PROBE_WORDS) {
      expect(
        RESERVED_PROBE_TARGETS.has(probe.target.toLowerCase()),
        `probe target "${probe.target}" missing from RESERVED_PROBE_TARGETS`,
      ).toBe(true);
    }
  });

  it("TRAINING_PHOTO_BANK is disjoint from probe targets", () => {
    for (const trial of TRAINING_PHOTO_BANK) {
      expect(RESERVED_PROBE_TARGETS.has(trial.target.toLowerCase())).toBe(false);
    }
    // Reservation actually removed something (probe words DO exist in PHOTO_BANK)
    expect(TRAINING_PHOTO_BANK.length).toBeLessThan(PHOTO_BANK.length);
  });

  it("getTrialsForLevel never returns a probe target at any level", () => {
    for (let level = 1; level <= 10; level++) {
      const trials = getTrialsForLevel(level, 200);
      for (const t of trials) {
        expect(
          RESERVED_PROBE_TARGETS.has(t.target.toLowerCase()),
          `level ${level} leaked probe target "${t.target}"`,
        ).toBe(false);
      }
    }
  });

  it("getTrialsForLevel allows a probe target only via explicit focusWords override", () => {
    const trials = getTrialsForLevel(1, 200, { focusWords: ["tree"] });
    const targets = trials.map((t) => t.target.toLowerCase());
    expect(targets).toContain("tree");
    for (const reserved of RESERVED_PROBE_TARGETS) {
      if (reserved !== "tree") expect(targets).not.toContain(reserved);
    }
  });

  it("getRandomTrials and the kids pool never return probe targets", () => {
    for (const t of getRandomTrials(500)) {
      expect(RESERVED_PROBE_TARGETS.has(t.target.toLowerCase())).toBe(false);
    }
    for (const t of getKidsPhotoPool()) {
      expect(RESERVED_PROBE_TARGETS.has(t.target.toLowerCase())).toBe(false);
    }
  });

  it("clinical selector training tiers (L1-L7) never return probe targets", () => {
    for (const level of [1, 4, 5, 6, 7]) {
      const sel = selectPhotoNamingPool(level);
      for (const t of sel.pool) {
        expect(
          RESERVED_PROBE_TARGETS.has(t.target.toLowerCase()),
          `selector L${level} leaked probe target "${t.target}"`,
        ).toBe(false);
      }
    }
  });
});
