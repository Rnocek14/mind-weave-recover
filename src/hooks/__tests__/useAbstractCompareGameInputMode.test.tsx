import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAbstractCompareGame } from '@/hooks/useAbstractCompareGame';

describe('Abstract Compare input provenance in actual game hook', () => {
  for (const inputMode of ['typed', 'spoken', 'skip'] as const) {
    it(`records a distinct ${inputMode} attempt without changing the practice scoring contract`, () => {
      const { result } = renderHook(() => useAbstractCompareGame(1, 1));
      expect(result.current.currentItem).toBeTruthy();
      let observed: ReturnType<typeof result.current.submitAnswer>;
      act(() => {
        observed = result.current.submitAnswer(
          inputMode === 'skip' ? '' : 'They are similar and different',
          1200,
          inputMode,
        );
      });
      expect(observed!).toBeTruthy();
      expect(observed?.inputMode).toBe(inputMode);
      expect(result.current.results[0]?.inputMode).toBe(inputMode);
      if (inputMode === 'skip') expect(observed?.skipped).toBe(true);
    });
  }
});
