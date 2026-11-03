import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSentenceGame } from '@/hooks/useSentenceGame';
import { getRecentlyShownIds } from '@/lib/sessionHistory';

vi.mock('@/contexts/KidsModeContext', () => ({
  useKidsMode: () => ({ kidsMode: false }),
}));

describe('Sentence Construction live-hook clinical content and speech scoring', () => {
  beforeEach(() => localStorage.clear());

  it.each([
    { clinical: 1, tier: 10, permitted: [1] },
    { clinical: 5, tier: 1, permitted: [6] },
    { clinical: 8, tier: 1, permitted: [9, 10] },
  ])('honors clinical level $clinical regardless of engine tier $tier', async ({ clinical, tier, permitted }) => {
    const { result } = renderHook(() => useSentenceGame(10, tier, [], clinical));
    await waitFor(() => expect(result.current.trials).toHaveLength(10));
    expect(result.current.trials.every(t => permitted.includes(t.difficulty))).toBe(true);
    const firstTrial = result.current.trials[0].id;
    act(() => result.current.setActiveDifficulty(tier === 10 ? 1 : 10));
    expect(result.current.trials[0].id).toBe(firstTrial);
    expect(result.current.trials.every(t => permitted.includes(t.difficulty))).toBe(true);
  });

  it('records real recently-shown sentence IDs against the right game namespace', async () => {
    const { result } = renderHook(() => useSentenceGame(10, 1, [], 1));
    await waitFor(() => expect(result.current.trials).toHaveLength(10));
    const recentIds = getRecentlyShownIds('sentence_game', 2);
    for (const trial of result.current.trials) {
      expect(recentIds.has(trial.id), `missing ${trial.id} from recency history`).toBe(true);
    }
  });

  it('scores the current recognized spoken sentence, not stale word-tile state', async () => {
    const { result } = renderHook(() => useSentenceGame(10, 1, [], 1));
    await waitFor(() => expect(result.current.trials).toHaveLength(10));
    const stimulus = result.current.trials[0];
    expect(result.current.currentAnswer).toHaveLength(0);
    let scoreFromSpeech = false;
    act(() => {
      const scored = result.current.submitAnswer(stimulus.correctAnswer);
      scoreFromSpeech = Boolean(scored?.correct);
    });
    expect(scoreFromSpeech).toBe(true);
    expect(result.current.score).toBe(1);
  });
});
