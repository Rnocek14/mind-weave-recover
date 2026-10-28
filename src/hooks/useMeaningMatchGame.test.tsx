import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MEANING_MATCH_ITEMS } from '@/data/meaningMatchItems';
import { useMeaningMatchGame } from './useMeaningMatchGame';

afterEach(() => vi.restoreAllMocks());

describe('Meaning Match answer integrity (actual game state engine)', () => {
  it('does not always display the correct answer in position A across controlled random orders', () => {
    const displayedCorrectIndices: number[] = [];
    for (const draw of [0, 0.75, 0.999]) {
      const random = vi.spyOn(Math, 'random').mockReturnValue(draw);
      const { result, unmount } = renderHook(() => useMeaningMatchGame(2, 1));
      const item = result.current.currentItem;
      expect(item).not.toBeNull();
      const bank = MEANING_MATCH_ITEMS.find(original => original.id === item!.id);
      expect(bank).toBeDefined();
      expect(item!.options[item!.correctIndex]).toBe(bank!.options[bank!.correctIndex]);
      expect(item!.options).toHaveLength(bank!.options.length);
      expect(new Set(item!.options)).toEqual(new Set(bank!.options));
      displayedCorrectIndices.push(item!.correctIndex);
      unmount();
      random.mockRestore();
    }
    // There are multiple independently sampled answer arrangements.
    // A hard-coded 'A' shortcut must not make comprehension trials pass.
    expect(new Set(displayedCorrectIndices).size).toBeGreaterThan(1);
  });

  it('records the actual displayed answer and the matching correct choice, without changing scoring', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { result } = renderHook(() => useMeaningMatchGame(2, 1));
    const item = result.current.currentItem!;
    expect(item).toBeTruthy();
    let outcome!: ReturnType<typeof result.current.submitAnswer>;
    act(() => { outcome = result.current.submitAnswer(item.correctIndex, 3000, false); });
    expect(outcome).toMatchObject({
      itemId: item.id,
      correct: true,
      selectedIndex: item.correctIndex,
      correctIndex: item.correctIndex,
      selectedOption: item.options[item.correctIndex],
      correctOption: item.options[item.correctIndex],
      points: 18,
    });
  });

  it('reports the selected wrong option precisely instead of omitting the error evidence', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { result } = renderHook(() => useMeaningMatchGame(2, 1));
    const item = result.current.currentItem!;
    const wrong = (item.correctIndex + 1) % item.options.length;
    let outcome!: ReturnType<typeof result.current.submitAnswer>;
    act(() => { outcome = result.current.submitAnswer(wrong, 13000, true); });
    expect(outcome).toMatchObject({
      correct: false,
      selectedIndex: wrong,
      correctIndex: item.correctIndex,
      selectedOption: item.options[wrong],
      correctOption: item.options[item.correctIndex],
      usedHint: true,
      points: 0,
    });
  });
});
