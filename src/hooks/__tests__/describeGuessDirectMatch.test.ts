/**
 * Describe & Guess — DIRECT-match gating regression test.
 *
 * matchAnswer classifies ANY 3+ non-foil-word utterance as 'circumlocution'
 * with countsAsCorrect: true. evaluateGuess used to treat that as a DIRECT
 * hit, so the app "guessed" (and prompted "Say X") instantly after the very
 * first description ("this you can eat" → "Say apple"). A circumlocution
 * classification must instead fall through to the semantic 2-of-3 rule.
 *
 * Collaborators are mocked so the gate itself is what's under test:
 * semantic similarity pinned to 0 → any guess here can only come from the
 * DIRECT shortcut.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDescribeGuessGame } from '@/hooks/useDescribeGuessGame';
import { matchAnswer } from '@/lib/answerMatcher';

vi.mock('@/hooks/useGameSounds', () => ({
  useGameSounds: () => ({ playSuccess: vi.fn(), playError: vi.fn() }),
}));

vi.mock('@/lib/semanticSimilarity', () => ({
  getSemanticSimilarity: vi.fn(async () => 0),
  hasLexicalOverlap: vi.fn(() => false),
}));

vi.mock('@/lib/evaluation/validationTelemetry', () => ({
  trackValidation: vi.fn(),
  logValidationDetail: vi.fn(),
}));

vi.mock('@/lib/evaluation/responseValidation', () => ({
  validateSpokenResponse: vi.fn(() => ({ valid: true, rejectionReason: null })),
}));

vi.mock('@/lib/answerMatcher', () => ({
  matchAnswer: vi.fn(),
}));

const mockedMatchAnswer = vi.mocked(matchAnswer);

function setup() {
  return renderHook(() => useDescribeGuessGame({ trialCount: 4 }));
}

beforeEach(() => {
  mockedMatchAnswer.mockReset();
});

describe('useDescribeGuessGame.evaluateGuess — DIRECT gate', () => {
  it('a circumlocution classification does NOT trigger the DIRECT guess', async () => {
    mockedMatchAnswer.mockReturnValue({
      isMatch: true,
      matchType: 'circumlocution',
      confidence: 0.5,
      inferredWord: 'whatever',
      countsAsCorrect: true,
      isWordFindingAttempt: true,
    });
    const hook = setup();
    const trial = hook.result.current.currentTrial!;
    let result: Awaited<ReturnType<typeof hook.result.current.evaluateGuess>>;
    await act(async () => {
      result = await hook.result.current.evaluateGuess('this you can eat', trial);
    });
    expect(result!.rulesPassed).not.toContain('DIRECT');
    expect(result!.guessed).toBe(false);
  });

  it('an exact word-level match still triggers the DIRECT guess', async () => {
    mockedMatchAnswer.mockReturnValue({
      isMatch: true,
      matchType: 'exact',
      confidence: 1,
      inferredWord: 'apple',
      countsAsCorrect: true,
      isWordFindingAttempt: false,
    });
    const hook = setup();
    const trial = hook.result.current.currentTrial!;
    let result: Awaited<ReturnType<typeof hook.result.current.evaluateGuess>>;
    await act(async () => {
      result = await hook.result.current.evaluateGuess('it is an apple', trial);
    });
    expect(result!.rulesPassed).toContain('DIRECT');
    expect(result!.guessed).toBe(true);
  });
});
