/**
 * The last trial of a session must reach the progression ladder.
 *
 * Games call `submitTrial(...)` without awaiting it and then immediately signal
 * completion, which runs `commitSession()`. `submitTrial` used to buffer the
 * progression trial only AFTER awaiting the exercise_events network write, so
 * the final trial (and, in a one-round lesson, every trial) was still in flight
 * when the ladder computed its evidence. Buffering is now synchronous.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

let resolveEvent: (() => void) | null = null;

vi.mock('@/hooks/useExerciseTelemetry', () => ({
  useExerciseTelemetry: () => ({
    // Never resolves until the test releases it — simulates a slow insert.
    logTrial: () => new Promise<void>((res) => { resolveEvent = () => res(); }),
    startTrial: () => {},
    calculateReactionTime: () => 0,
  }),
}));
vi.mock('@/hooks/useAdaptationTrialLogger', () => ({
  useAdaptationTrialLogger: () => ({ logTrial: () => {}, flush: async () => {} }),
}));
vi.mock('@/lib/mastery/flushMasteryShadow', () => ({ flushMasteryShadow: async () => {} }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { useTrialSubmission } from '@/hooks/useTrialSubmission';

describe('useTrialSubmission — progression buffering', () => {
  it('buffers the trial before the telemetry write resolves', async () => {
    const buffered: Array<{ correct: boolean }> = [];
    const progression = {
      recordTrialOutcome: (t: { correct: boolean; support: string }) => { buffered.push(t as never); },
      flushAtSessionEnd: async () => ({ ok: true }),
      state: null,
    };

    const { result } = renderHook(() =>
      useTrialSubmission({
        userId: 'u1',
        profileId: 'p1',
        sessionId: 's1',
        exerciseSlug: 'category_fluency',
        progression: progression as never,
        debug: false,
      }),
    );

    act(() => {
      void result.current.submitTrial({
        level: 3,
        isCorrect: true,
        supportUsed: 'independent',
      } as never);
    });

    // The exercise_events insert is still in flight...
    expect(resolveEvent).not.toBeNull();
    // ...but the ladder already has the trial.
    expect(buffered).toHaveLength(1);

    await act(async () => { resolveEvent?.(); });
  });
});
