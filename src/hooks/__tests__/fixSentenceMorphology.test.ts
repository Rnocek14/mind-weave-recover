/**
 * L6 morphology — hook-level contract
 * (docs/fix-sentence-morphology-spec.md §3.3).
 *
 * Drives useFixSentenceGame at clinicalLevel 6, where the selector serves
 * FIX_SENTENCE_MORPHOLOGY_BANK. The load-bearing assertion: the bare base
 * form must score plain-wrong — no semantic fallback, no partial credit —
 * because base vs inflected IS the contrast under treatment.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFixSentenceGame } from "@/hooks/useFixSentenceGame";

vi.mock("@/hooks/useGameSounds", () => ({
  useGameSounds: () => ({ playSuccess: vi.fn(), playError: vi.fn() }),
}));

// Guard the guard: if the semantic fallback ever runs for a morphology
// trial, this mock makes the test fail loudly instead of hitting network.
vi.mock("@/lib/semanticSimilarity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/semanticSimilarity")>();
  return {
    ...actual,
    getSemanticSimilarity: vi.fn(async () => {
      throw new Error("semantic fallback must not run for morphology trials");
    }),
  };
});

function setup() {
  const onTrialComplete = vi.fn();
  const onGameComplete = vi.fn();
  const hook = renderHook(() =>
    useFixSentenceGame({
      trialCount: 5,
      difficulty: 3,
      clinicalLevel: 6,
      onTrialComplete,
      onGameComplete,
    })
  );
  return { hook, onTrialComplete, onGameComplete };
}

beforeEach(() => {
  localStorage.clear();
});

describe("useFixSentenceGame — L6 morphology", () => {
  it("serves morphology trials at clinical level 6", () => {
    const { hook } = setup();
    expect(hook.result.current.currentTrial?.morphology).toBeDefined();
    expect(hook.result.current.currentTrial?.secondError).toBeUndefined();
  });

  it("the required inflected form scores correct via exact match", async () => {
    const { hook } = setup();
    const trial = hook.result.current.currentTrial!;
    await act(async () => {
      const r = await hook.result.current.scoreAnswer(trial.morphology!.requiredForm);
      expect(r!.isCorrect).toBe(true);
      expect(r!.matchedFix).toBe(trial.morphology!.requiredForm);
    });
  });

  it("the bare base form is plain-wrong: no fallback, no partial credit", async () => {
    const { hook } = setup();
    const trial = hook.result.current.currentTrial!;
    await act(async () => {
      const r = await hook.result.current.scoreAnswer(trial.morphology!.baseForm);
      expect(r!.isCorrect).toBe(false);
      expect(r!.isPartialCredit).toBe(false);
      expect(r!.semanticSimilarity).toBeNull();
    });
  });

  it("an unrelated wrong answer is also scored without the semantic fallback", async () => {
    const { hook } = setup();
    await act(async () => {
      const r = await hook.result.current.scoreAnswer("xylophone banana");
      expect(r!.isCorrect).toBe(false);
      expect(r!.isPartialCredit).toBe(false);
      expect(r!.semanticSimilarity).toBeNull();
    });
  });
});
