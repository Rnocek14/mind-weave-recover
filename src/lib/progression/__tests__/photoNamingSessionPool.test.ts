/**
 * Levelling up must change the exercise, not just the badge.
 *
 * Photo Naming's clinical content selector — high-frequency words at L4,
 * mid-frequency at L5, category spread at L6, phrase carriers at L7 — was
 * written, tested and then left unreachable: `usePhotoNamingGame` consults it
 * only when the caller supplies no `customTrials`, and the exercise page always
 * supplies them. Measured on the real bank, the page served the engine-tier
 * pool at every level, which made four of the seven level-ups
 * (L1->L2, L3->L4, L4->L5, L7->L8) byte-identical word lists.
 */
import { describe, it, expect } from 'vitest';
import {
  resolvePhotoNamingStockPool,
  CLINICAL_POOL_MIN_LEVEL,
  CLINICAL_POOL_MAX_LEVEL,
} from '../photoNamingSessionPool';
import { clinicalLevelToEngineFloor } from '../photoNamingDifficultyBridge';
import { getTrialsForLevel, PHOTO_BANK } from '@/data/photoBank';
import { PROBE_WORDS } from '@/data/probeWords';

const TOTAL_TRIALS = 10;

function poolFor(level: number, totalTrials = TOTAL_TRIALS) {
  return resolvePhotoNamingStockPool({
    clinicalLevel: level,
    engineDifficulty: clinicalLevelToEngineFloor(level, 0),
    count: PHOTO_BANK.length,
    totalTrials,
  });
}

const targets = (level: number) => new Set(poolFor(level).map((t) => t.target.toLowerCase()));

describe('photo naming stock pool follows the clinical level', () => {
  it('gives L4, L5, L6 and L7 genuinely different vocabulary', () => {
    // L4 (high-frequency) and L5 (mid-frequency) are the crossing that used to
    // be a complete no-op: same 70 words, same four choices, same foils.
    const l4 = targets(4);
    const l5 = targets(5);
    expect(l4.size).toBeGreaterThan(0);
    expect(l5.size).toBeGreaterThan(0);
    const overlap = [...l4].filter((w) => l5.has(w)).length;
    expect(overlap, 'L4 and L5 must not train the same frequency band').toBe(0);

    for (const [a, b] of [
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
    ] as Array<[number, number]>) {
      const A = targets(a);
      const B = targets(b);
      const identical = A.size === B.size && [...A].every((w) => B.has(w));
      expect(identical, `L${a} and L${b} still serve the same word list`).toBe(false);
    }
  });

  it('leaves L1–L3 on the engine pool, where the support ladder is the lever', () => {
    // getTrialsForLevel shuffles, so compare the vocabulary, not the order.
    for (const level of [1, 2, 3]) {
      const engine = new Set(
        getTrialsForLevel(clinicalLevelToEngineFloor(level, 0), PHOTO_BANK.length).map(
          (t) => t.target.toLowerCase(),
        ),
      );
      expect([...targets(level)].sort(), `L${level}`).toEqual([...engine].sort());
    }
    expect(CLINICAL_POOL_MIN_LEVEL).toBe(4);
  });

  it('never serves the reserved generalization probes as training words', () => {
    // L8's selector tier draws PROBE_WORDS and tags them for segregation, but
    // nothing downstream honours that tag yet, so the tier stays off: training
    // on the probes would destroy the untrained-probe measure.
    const probes = new Set(PROBE_WORDS.map((t) => t.target.toLowerCase()));
    for (let level = 1; level <= 8; level++) {
      for (const t of poolFor(level)) {
        expect(
          probes.has(t.target.toLowerCase()),
          `L${level} served reserved probe "${t.target}" as training content`,
        ).toBe(false);
      }
    }
    expect(CLINICAL_POOL_MAX_LEVEL).toBe(7);
  });

  it('never offers a narrower pool than the engine baseline it replaced', () => {
    // The bank itself caps how long a session can be at some tiers; that is
    // pre-existing. What must not happen is the clinical tier making it worse —
    // a 54-word tier used for a 60-trial session has to top up, not truncate.
    for (let level = 1; level <= 8; level++) {
      const baseline = new Set(
        getTrialsForLevel(clinicalLevelToEngineFloor(level, 0), PHOTO_BANK.length).map(
          (t) => t.target.toLowerCase(),
        ),
      ).size;
      for (const totalTrials of [10, 20, 60, 120]) {
        const unique = new Set(
          poolFor(level, totalTrials).map((t) => t.target.toLowerCase()),
        ).size;
        expect(
          unique,
          `L${level} at ${totalTrials} trials: ${unique} unique words vs ${baseline} before`,
        ).toBeGreaterThanOrEqual(Math.min(baseline, totalTrials));
      }
    }
  });

  it('falls back to the engine pool before the clinical level has loaded', () => {
    const engine = new Set(
      getTrialsForLevel(5, PHOTO_BANK.length).map((t) => t.target.toLowerCase()),
    );
    for (const level of [null, undefined, Number.NaN]) {
      const got = new Set(
        resolvePhotoNamingStockPool({
          clinicalLevel: level as number | null,
          engineDifficulty: 5,
          count: PHOTO_BANK.length,
          totalTrials: TOTAL_TRIALS,
        }).map((t) => t.target.toLowerCase()),
      );
      expect([...got].sort(), String(level)).toEqual([...engine].sort());
    }
  });
});
