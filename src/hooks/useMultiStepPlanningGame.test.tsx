import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/shuffle', () => ({
  shuffleArray: <T,>(items: T[]): T[] => [...items],
}));

import { useMultiStepPlanningGame } from './useMultiStepPlanningGame';

describe('useMultiStepPlanningGame real result generation', () => {
  it('saves the true answer-order evidence instead of the stimulus list order', () => {
    const { result } = renderHook(() => useMultiStepPlanningGame(1, 1));
    expect(result.current.currentItem?.id).toBe('plan-01');

    let reversed: ReturnType<typeof result.current.submitPlan> = null;
    act(() => {
      reversed = result.current.submitPlan(
        'pour water then boil water',
        2500,
        {
          inputMode: 'spoken',
          completionReason: 'completed',
          responseValid: true,
          browserTranscript: 'pour water then boil water',
        },
      );
    });
    expect(reversed).toMatchObject({
      itemId: 'plan-01',
      inputMode: 'spoken',
      sequenceScore: 0,
      sequenceEvidenceAvailable: true,
      sequenceMatchedSteps: 2,
      browserTranscript: 'pour water then boil water',
    });
    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0].sequenceScore).toBe(0);
  });

  it('does not disguise typed fallback as microphone transcription', () => {
    const { result } = renderHook(() => useMultiStepPlanningGame(1, 1));
    let typed: ReturnType<typeof result.current.submitPlan> = null;
    act(() => {
      typed = result.current.submitPlan(
        'boil water then pour water',
        1000,
        {
          inputMode: 'typed',
          completionReason: 'completed',
          responseValid: true,
          browserTranscript: 'fake recognizer output must be discarded',
        },
      );
    });
    expect(typed).toMatchObject({
      inputMode: 'typed',
      completionReason: 'completed',
      browserTranscript: null,
      skipped: false,
      sequenceScore: 1,
    });
  });

  it('records a skipped round without fabricating scored language evidence', () => {
    const { result } = renderHook(() => useMultiStepPlanningGame(1, 1));
    let skipped: ReturnType<typeof result.current.submitPlan> = null;
    act(() => {
      skipped = result.current.submitPlan('', 1000, {
        inputMode: 'none', completionReason: 'skipped', responseValid: false,
      });
    });
    expect(skipped).toMatchObject({
      inputMode: 'none',
      completionReason: 'skipped',
      responseValid: false,
      skipped: true,
      sequenceEvidenceAvailable: false,
      sequenceScore: 0,
      browserTranscript: null,
    });
  });
});
