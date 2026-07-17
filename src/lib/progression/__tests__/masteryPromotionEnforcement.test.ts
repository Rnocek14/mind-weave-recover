import { describe, it, expect } from "vitest";
import {
  applySessionToState,
  defaultProgressionState,
  type SessionRollupInput,
} from "@/lib/progression/clinicalProgression";
import { classifyMasteryPromotion } from "@/lib/mastery/masteryPromotionDecision";

/**
 * A.3 enforcement: the A.2 promotion RECOMMENDATION now gates level-up.
 * delay_reinforce holds promotion for one confirming session; it can never
 * become a permanent block because the next flush re-reads fresh mastery.
 */

function baseState() {
  const s = defaultProgressionState({ userId: "u1", profileId: "p1", exerciseSlug: "photo-naming" });
  return { ...s, currentLevel: 2, progressPct: 95 };
}

// Enough independent-correct trials to cross 100% and satisfy evidence.
const winningInput = (overrides: Partial<SessionRollupInput> = {}): SessionRollupInput => ({
  trials: Array.from({ length: 10 }, () => ({ correct: true, support: "independent" as const })),
  evidenceMet: true,
  progressDelta: 20,
  masteryVerdict: "pass",
  ...overrides,
});

describe("mastery promotion enforcement in applySessionToState", () => {
  it("delay_reinforce holds the level even when everything else passes", () => {
    const next = applySessionToState(baseState(), winningInput({ masteryPromotion: "delay_reinforce" }));
    expect(next.currentLevel).toBe(2);
    expect(next.progressPct).toBe(100); // held at top, not reset
  });

  it("promote allows the level-up", () => {
    const next = applySessionToState(baseState(), winningInput({ masteryPromotion: "promote" }));
    expect(next.currentLevel).toBe(3);
    expect(next.progressPct).toBe(0);
  });

  it("no_opinion and undefined preserve legacy behavior (level-up proceeds)", () => {
    for (const p of ["no_opinion", undefined] as const) {
      const next = applySessionToState(baseState(), winningInput({ masteryPromotion: p }));
      expect(next.currentLevel).toBe(3);
    }
  });

  it("the hold is not permanent: a later session with promote advances from the held state", () => {
    const held = applySessionToState(baseState(), winningInput({ masteryPromotion: "delay_reinforce" }));
    const next = applySessionToState(held, winningInput({ masteryPromotion: "promote", progressDelta: 0 }));
    expect(next.currentLevel).toBe(3);
  });
});

describe("classifier → enforcement integration", () => {
  it("cue-dependent high-accuracy learner is delayed, independent learner promotes", () => {
    const cueDependent = classifyMasteryPromotion({
      verdict: "pass",
      masteryScore: 0.9,
      cueIndependence: 0.3, // heavily cued
    });
    expect(cueDependent.decision).toBe("delay_reinforce");
    const heldState = applySessionToState(
      baseState(),
      winningInput({ masteryPromotion: cueDependent.decision }),
    );
    expect(heldState.currentLevel).toBe(2);

    const independent = classifyMasteryPromotion({
      verdict: "pass",
      masteryScore: 0.9,
      cueIndependence: 0.9,
    });
    expect(independent.decision).toBe("promote");
    const promoted = applySessionToState(
      baseState(),
      winningInput({ masteryPromotion: independent.decision }),
    );
    expect(promoted.currentLevel).toBe(3);
  });

  it("no mastery data yields no_opinion — new users are never blocked", () => {
    const rec = classifyMasteryPromotion({ verdict: "skip", masteryScore: null, cueIndependence: null });
    expect(rec.decision).toBe("no_opinion");
  });
});
