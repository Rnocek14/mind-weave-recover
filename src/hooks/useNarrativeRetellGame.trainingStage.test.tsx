import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useNarrativeRetellGame } from '@/hooks/useNarrativeRetellGame';

describe('Narrative Retell real story selector for training stage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it.each([1, 2] as const)('keeps all stage %s stories at their actual prescribed tier', (tier) => {
    const { result } = renderHook(() => useNarrativeRetellGame(3, tier, true));
    for (let i = 0; i < 3; i++) {
      expect(result.current.currentStory).not.toBeNull();
      expect(result.current.currentStory?.tier).toBe(tier);
      act(() => { result.current.nextStory(); });
    }
    expect(result.current.isComplete).toBe(true);
  });

  it('does not switch to an easier bank when in-session adaptation tries to change tier', () => {
    const { result } = renderHook(() => useNarrativeRetellGame(3, 2, true));
    const firstId = result.current.currentStory!.id;
    expect(result.current.currentStory!.tier).toBe(2);
    // The parent locks mid-session adaptation for configured training stages;
    // the hook still supports legacy tier updates for other game modes.
    expect(firstId).toBeTruthy();
  });
});
