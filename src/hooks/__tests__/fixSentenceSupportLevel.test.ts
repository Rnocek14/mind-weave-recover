/**
 * What the ladder is told about a spoken answer.
 *
 * The microphone is open beside the choice tiles at levels 1-2, so a person
 * can say the answer instead of tapping it. The ladder measures WHAT HELP WAS
 * ON SCREEN, not which channel the answer arrived through — so both paths have
 * to log the same support level. If speaking logged open_response while
 * tapping logged highlight_plus_choice, choosing to talk would look like
 * unsupported production and push someone up the levels on evidence they never
 * gave.
 *
 * WHY THIS TEST EXISTS AT THIS LEVEL. The support value was first attached to
 * `baseResult` alone — and only three of scoreAnswer's SEVEN return paths
 * spread it. The other four hand-build their own object, so the value was
 * computed correctly and thrown away on most answers. Measured live: tapped
 * "song" logged highlight_plus_choice, spoken "chair" on the same level with
 * the same four tiles visible logged open_response. Asserting it through one
 * happy path would have missed it, so every branch is exercised here.
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

function setup(clinicalLevel: number) {
  return renderHook(() => useFixSentenceGame({ trialCount: 5, difficulty: 1, clinicalLevel }));
}

beforeEach(() => localStorage.clear());

/** Every way an answer can leave scoreAnswer, on one level. */
async function supportFor(
  hook: ReturnType<typeof setup>,
  spoken: string,
  choicesOnScreen: boolean
) {
  let result: Awaited<ReturnType<typeof hook.result.current.scoreAnswer>>;
  await act(async () => {
    result = await hook.result.current.scoreAnswer(spoken, false, choicesOnScreen);
  });
  return result!;
}

describe('a spoken answer is logged by what was on screen', () => {
  it('level 1 with tiles up reports highlight_plus_choice, right or wrong', async () => {
    const hook = setup(1);
    const trial = hook.result.current.currentTrial!;

    const correct = await supportFor(hook, trial.acceptedFixes[0], true);
    expect(correct.isCorrect).toBe(true);
    expect(correct.support).toBe('highlight_plus_choice');

    const wrong = await supportFor(hook, 'zzzblurfle', true);
    expect(wrong.isCorrect).toBe(false);
    // A wrong answer had exactly the same help as a right one.
    expect(wrong.support).toBe('highlight_plus_choice');
  });

  it('level 2 with tiles up reports choice_based', async () => {
    const hook = setup(2);
    const trial = hook.result.current.currentTrial!;
    const r = await supportFor(hook, trial.acceptedFixes[0], true);
    expect(r.support).toBe('choice_based');
  });

  it('reports open_response when nothing was on screen to help', async () => {
    const hook = setup(4);
    const trial = hook.result.current.currentTrial!;
    const r = await supportFor(hook, trial.acceptedFixes[0], false);
    expect(r.support).toBe('open_response');
  });

  it('never leaves support undefined, whichever branch answers', async () => {
    // The branches differ by trial shape (morphology, two-error, approximate
    // match, plain miss) and each one has its own return statement. Sweep a
    // realistic spread of inputs across several trials and insist every single
    // result carries a support level.
    for (const level of [1, 2, 5, 6]) {
      const hook = setup(level);
      for (let i = 0; i < 4; i++) {
        const trial = hook.result.current.currentTrial;
        if (!trial) break;
        for (const spoken of [trial.acceptedFixes[0], trial.wrongWord, 'zzzblurfle', trial.sentence]) {
          const r = await supportFor(hook, spoken, level <= 2);
          expect(r?.support, `level ${level}, said "${spoken}"`).toBeTruthy();
        }
        act(() => { hook.result.current.nextTrial(); });
      }
    }
  });
});
