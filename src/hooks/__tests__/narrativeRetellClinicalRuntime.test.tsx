import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useNarrativeRetellGame } from '@/hooks/useNarrativeRetellGame';

describe('Narrative Retell live hook — pinned clinical content', () => {
  beforeEach(() => localStorage.clear());

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'renders level %i content even when the in-session engine starts at a different tier',
    (level) => {
      const { result, unmount } = renderHook(() => useNarrativeRetellGame(3, 1, level));
      const story = result.current.currentStory;
      expect(story).not.toBeNull();
      if (level <= 3) {
        expect(story?.id).toMatch(/^micro-/);
        expect(story?.keyEvents).toHaveLength(level);
        expect(story?.scenes).toHaveLength(level);
      } else {
        expect(story?.id).not.toMatch(/^micro-/);
        expect(story!.keyEvents.length).toBeGreaterThanOrEqual(
          level === 4 || level === 5 ? 4 : level === 8 ? 6 : 5,
        );
      }
      expect(result.current.totalStories).toBe(3);
      unmount();
    },
  );

  it('does not replace a 1-fact clinical story when adaptive engine calls setActiveTier', () => {
    const { result } = renderHook(() => useNarrativeRetellGame(3, 1, 1));
    const storyId = result.current.currentStory!.id;
    act(() => result.current.setActiveTier(3));
    expect(result.current.currentStory?.id).toBe(storyId);
    expect(result.current.currentStory?.keyEvents).toHaveLength(1);
    const fact = result.current.currentStory!.keyEvents[0];
    act(() => { result.current.submitRetell(fact, 1000); });
    const submitted = result.current.results[0];
    expect(submitted?.eventsFound).toBeGreaterThanOrEqual(1);
    expect(submitted?.eventsTotal).toBe(1);
    act(() => result.current.nextStory());
    expect(result.current.currentStory?.keyEvents).toHaveLength(1);
    expect(result.current.currentIndex).toBe(1);
  });

  it('replaces the result of a retry instead of counting the same story twice', () => {
    const { result } = renderHook(() => useNarrativeRetellGame(3, 1, 1));
    const firstId = result.current.currentStory!.id;
    act(() => { result.current.submitRetell('', 1000); });
    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0].skipped).toBe(true);
    const rememberedWord = result.current.currentStory!.keyEvents[0];
    act(() => { result.current.submitRetell(rememberedWord, 1200); });
    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0].storyId).toBe(firstId);
    expect(result.current.results[0].skipped).toBe(false);
    expect(result.current.results[0].eventsFound).toBe(1);
  });

  it('returns a zero-event result for a skip rather than a successful recall', () => {
    const { result } = renderHook(() => useNarrativeRetellGame(3, 3, 2));
    act(() => { result.current.submitRetell('', 1000); });
    const submitted = result.current.results[0];
    expect(submitted?.skipped).toBe(true);
    expect(submitted?.eventsFound).toBe(0);
    expect(submitted?.eventsTotal).toBe(2);
  });
});
