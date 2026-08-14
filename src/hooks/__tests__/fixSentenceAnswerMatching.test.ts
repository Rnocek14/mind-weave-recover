/**
 * Fix Sentence — answer matching against real aphasic response patterns.
 *
 * A patient session surfaced correct answers being marked wrong because the
 * matcher only accepted the bare fix word:
 *   - the whole corrected sentence ("the dentist cleaned my teeth" → "teeth")
 *   - negating the error first ("didn't clean your shoes, he cleaned your teeth")
 *   - a phrase around the fix ("turned the block")
 *   - repeating the word ("tail tail")
 *
 * Semantic similarity is mocked to 0 so every acceptance below is proven by
 * the LOCAL matcher — no embedding fallback in play.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFixSentenceGame } from '@/hooks/useFixSentenceGame';

vi.mock('@/hooks/useGameSounds', () => ({
  useGameSounds: () => ({ playSuccess: vi.fn(), playError: vi.fn() }),
}));

vi.mock('@/lib/semanticSimilarity', () => ({
  getSemanticSimilarity: vi.fn(async () => 0),
  hasLexicalOverlap: vi.fn(() => false),
}));

function setup() {
  return renderHook(() =>
    useFixSentenceGame({ trialCount: 5, difficulty: 1 })
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('useFixSentenceGame.scoreAnswer — embedded-fix acceptance', () => {
  it('accepts the bare fix (existing behavior)', async () => {
    const hook = setup();
    const trial = hook.result.current.currentTrial!;
    let result: Awaited<ReturnType<typeof hook.result.current.scoreAnswer>>;
    await act(async () => {
      result = await hook.result.current.scoreAnswer(trial.acceptedFixes[0]);
    });
    expect(result!.isCorrect).toBe(true);
    expect(result!.matchedFix).toBe(trial.acceptedFixes[0]);
  });

  it('accepts the fix embedded in a longer utterance', async () => {
    const hook = setup();
    const trial = hook.result.current.currentTrial!;
    let result: Awaited<ReturnType<typeof hook.result.current.scoreAnswer>>;
    await act(async () => {
      result = await hook.result.current.scoreAnswer(
        `I think it should be ${trial.acceptedFixes[0]} instead`
      );
    });
    expect(result!.isCorrect).toBe(true);
    expect(result!.matchedFix).toBe(trial.acceptedFixes[0]);
  });

  it('accepts the whole corrected sentence', async () => {
    const hook = setup();
    const trial = hook.result.current.currentTrial!;
    const corrected = trial.sentence
      .toLowerCase()
      .replace(trial.wrongWord.toLowerCase(), trial.acceptedFixes[0].toLowerCase());
    let result: Awaited<ReturnType<typeof hook.result.current.scoreAnswer>>;
    await act(async () => {
      result = await hook.result.current.scoreAnswer(corrected);
    });
    expect(result!.isCorrect).toBe(true);
  });

  it('accepts a negate-then-correct utterance that mentions the wrong word too', async () => {
    const hook = setup();
    const trial = hook.result.current.currentTrial!;
    let result: Awaited<ReturnType<typeof hook.result.current.scoreAnswer>>;
    await act(async () => {
      result = await hook.result.current.scoreAnswer(
        `not ${trial.wrongWord}, it is ${trial.acceptedFixes[0]}`
      );
    });
    expect(result!.isCorrect).toBe(true);
  });

  it('accepts the fix repeated twice', async () => {
    const hook = setup();
    const trial = hook.result.current.currentTrial!;
    const fix = trial.acceptedFixes[0];
    let result: Awaited<ReturnType<typeof hook.result.current.scoreAnswer>>;
    await act(async () => {
      result = await hook.result.current.scoreAnswer(`${fix} ${fix}`);
    });
    expect(result!.isCorrect).toBe(true);
  });

  it('still rejects reading the wrong sentence back unchanged', async () => {
    const hook = setup();
    const trial = hook.result.current.currentTrial!;
    let result: Awaited<ReturnType<typeof hook.result.current.scoreAnswer>>;
    await act(async () => {
      result = await hook.result.current.scoreAnswer(trial.sentence.toLowerCase());
    });
    expect(result!.isCorrect).toBe(false);
  });

  it('still rejects an unrelated answer', async () => {
    const hook = setup();
    let result: Awaited<ReturnType<typeof hook.result.current.scoreAnswer>>;
    await act(async () => {
      result = await hook.result.current.scoreAnswer('completely unrelated zebra');
    });
    expect(result!.isCorrect).toBe(false);
  });
});

describe('useFixSentenceGame — L5 whole-sentence double repair', () => {
  it('completes a two-error trial outright when one utterance fixes both errors', async () => {
    const hook = renderHook(() =>
      useFixSentenceGame({ trialCount: 5, difficulty: 3, clinicalLevel: 5 })
    );
    const trial = hook.result.current.currentTrial!;
    expect(trial.secondError).toBeDefined();
    const both = `${trial.acceptedFixes[0]} and ${trial.secondError!.acceptedFixes[0]}`;
    let result: Awaited<ReturnType<typeof hook.result.current.scoreAnswer>>;
    await act(async () => {
      result = await hook.result.current.scoreAnswer(both);
    });
    expect(result!.isCorrect).toBe(true);
    expect(result!.phaseAdvance).toBeUndefined();
    expect(result!.phase1Fix).toBe(trial.acceptedFixes[0]);
    expect(result!.phase2Fix).toBe(trial.secondError!.acceptedFixes[0]);
  });
});
