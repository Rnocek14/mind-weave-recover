import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { getAbstractPracticeStage } from '@/lib/abstractCompare/trainingStages';
import { useAbstractCompareGame } from './useAbstractCompareGame';

afterEach(() => cleanup());

describe('Abstract Comparison actual hook — stage restricted content', () => {
  it.each([1, 2, 3] as const)('plays Stage %i with no unrelated or repeated pair', level => {
    const stage = getAbstractPracticeStage(level)!;
    const { result } = renderHook(() => useAbstractCompareGame(4, stage.contentTier, stage));
    const visited = new Set<string>();
    for (let trial = 0; trial < 4; trial++) {
      const item = result.current.currentItem!;
      expect(item).not.toBeNull();
      expect(item.tier).toBe(stage.contentTier);
      expect(visited.has(item.id)).toBe(false);
      visited.add(item.id);
      act(() => {
        result.current.submitAnswer('These things can be used to help', 1500, 'typed');
        result.current.nextItem();
      });
      expect(result.current.results).toHaveLength(trial + 1);
    }
    expect(result.current.isComplete).toBe(true);
    expect(result.current.results.every(r => r.inputMode === 'typed')).toBe(true);
  });

  it('does not shift a selected Stage 3 pair pool when the legacy engine requests tier 1', () => {
    const stage = getAbstractPracticeStage(3)!;
    const { result } = renderHook(() => useAbstractCompareGame(4, 2, stage));
    const original = result.current.currentItem!.id;
    act(() => result.current.setActiveTier(1));
    expect(result.current.activeTier).toBe(2);
    expect(result.current.currentItem?.id).toBe(original);
  });

  it('does not mark typed exercise content as spoken input', () => {
    const stage = getAbstractPracticeStage(1)!;
    const { result } = renderHook(() => useAbstractCompareGame(2, 1, stage));
    act(() => { result.current.submitAnswer('They are both animals', 400, 'typed'); });
    expect(result.current.results[0]).toMatchObject({
      inputMode: 'typed', transcript: 'They are both animals',
    });
    act(() => result.current.nextItem());
    act(() => { result.current.submitAnswer('', 0, 'skip'); });
    expect(result.current.results[1]).toMatchObject({ inputMode: 'skip', skipped: true });
  });
});
