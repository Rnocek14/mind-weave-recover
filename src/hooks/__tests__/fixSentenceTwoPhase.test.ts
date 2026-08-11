/**
 * L5 two-phase repair — hook-level contract
 * (docs/fix-sentence-two-error-spec.md §3).
 *
 * Drives useFixSentenceGame at clinicalLevel 5, where the selector serves
 * FIX_SENTENCE_TWO_ERROR_BANK. Uses exact accepted fixes so the local
 * matcher resolves everything — no semantic/network fallback in play.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFixSentenceGame } from "@/hooks/useFixSentenceGame";

vi.mock("@/hooks/useGameSounds", () => ({
  useGameSounds: () => ({ playSuccess: vi.fn(), playError: vi.fn() }),
}));

function setup() {
  const onTrialComplete = vi.fn();
  const onGameComplete = vi.fn();
  const hook = renderHook(() =>
    useFixSentenceGame({
      trialCount: 5,
      difficulty: 3,
      clinicalLevel: 5,
      onTrialComplete,
      onGameComplete,
    })
  );
  return { hook, onTrialComplete, onGameComplete };
}

beforeEach(() => {
  localStorage.clear();
});

describe("useFixSentenceGame — L5 two-phase repair", () => {
  it("serves two-error trials at clinical level 5", () => {
    const { hook } = setup();
    expect(hook.result.current.currentTrial?.secondError).toBeDefined();
  });

  it("repairs in primary-first order: interim advance, then correct aggregate", async () => {
    const { hook } = setup();
    const trial = hook.result.current.currentTrial!;

    let interim: Awaited<ReturnType<typeof hook.result.current.scoreAnswer>>;
    await act(async () => {
      interim = await hook.result.current.scoreAnswer(trial.acceptedFixes[0]);
    });
    expect(interim!.phaseAdvance).toBe(true);
    expect(interim!.isCorrect).toBe(false);
    expect(hook.result.current.repairPhase).toBe(2);
    expect(hook.result.current.phase2TargetFixes).toEqual(trial.secondError!.acceptedFixes);

    let aggregate: Awaited<ReturnType<typeof hook.result.current.scoreAnswer>>;
    await act(async () => {
      aggregate = await hook.result.current.scoreAnswer(trial.secondError!.acceptedFixes[0]);
    });
    expect(aggregate!.isCorrect).toBe(true);
    expect(aggregate!.phaseAdvance).toBeUndefined();
    expect(aggregate!.phase1Fix).toBe(trial.acceptedFixes[0]);
    expect(aggregate!.phase2Fix).toBe(trial.secondError!.acceptedFixes[0]);
  });

  it("repairs order-agnostically: second error first also works", async () => {
    const { hook } = setup();
    const trial = hook.result.current.currentTrial!;
    // Skip trials where the second error's fix is ALSO accepted by the
    // primary (ambiguity credits the primary by spec) — pick a clean fix.
    const secondFix = trial.secondError!.acceptedFixes.find(
      (f) => !trial.acceptedFixes.includes(f)
    );
    if (!secondFix) return; // ambiguous-only trial; covered by the rule test

    await act(async () => {
      const interim = await hook.result.current.scoreAnswer(secondFix);
      expect(interim!.phaseAdvance).toBe(true);
    });
    // Remaining target is now the PRIMARY error.
    expect(hook.result.current.phase2TargetFixes).toEqual(trial.acceptedFixes);

    await act(async () => {
      const aggregate = await hook.result.current.scoreAnswer(trial.acceptedFixes[0]);
      expect(aggregate!.isCorrect).toBe(true);
    });
  });

  it("a wrong answer in phase 1 does NOT advance the phase", async () => {
    const { hook } = setup();
    await act(async () => {
      const r = await hook.result.current.scoreAnswer("xylophone banana");
      expect(r!.phaseAdvance).toBeUndefined();
      expect(r!.isCorrect).toBe(false);
      expect(r!.isPartialCredit).toBe(false);
    });
    expect(hook.result.current.repairPhase).toBe(1);
  });

  it("abandoning phase 2 submits an aggregate PARTIAL and resets the phase", async () => {
    const { hook, onTrialComplete } = setup();
    const trial = hook.result.current.currentTrial!;

    await act(async () => {
      await hook.result.current.scoreAnswer(trial.acceptedFixes[0]);
    });
    expect(hook.result.current.repairPhase).toBe(2);

    act(() => {
      hook.result.current.nextTrial(); // skip / give-up path
    });

    const partial = hook.result.current.results.find((r) => r.trialId === trial.id);
    expect(partial).toBeDefined();
    expect(partial!.isPartialCredit).toBe(true);
    expect(partial!.isCorrect).toBe(false);
    expect(partial!.phase1Fix).toBe(trial.acceptedFixes[0]);
    expect(partial!.phase2Fix).toBeNull();
    expect(onTrialComplete).toHaveBeenCalledWith(expect.objectContaining({ trialId: trial.id, isPartialCredit: true }));
    expect(hook.result.current.repairPhase).toBe(1);
  });

  it("skipping in phase 1 submits nothing (matches single-error skip semantics)", async () => {
    const { hook, onTrialComplete } = setup();
    act(() => {
      hook.result.current.nextTrial();
    });
    expect(hook.result.current.results).toHaveLength(0);
    expect(onTrialComplete).not.toHaveBeenCalled();
  });
});
