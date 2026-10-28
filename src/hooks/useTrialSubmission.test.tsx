import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  logExerciseEvent: vi.fn(),
  startTrial: vi.fn(),
  calculateReactionTime: vi.fn(),
  logAdaptationTrial: vi.fn(),
  flushAdaptation: vi.fn(),
  flushMasteryShadow: vi.fn(),
  recordLastTrial: vi.fn(),
}));

vi.mock('@/hooks/useExerciseTelemetry', () => ({
  useExerciseTelemetry: () => ({
    logTrial: mocks.logExerciseEvent,
    startTrial: mocks.startTrial,
    calculateReactionTime: mocks.calculateReactionTime,
  }),
}));

vi.mock('@/hooks/useAdaptationTrialLogger', () => ({
  useAdaptationTrialLogger: () => ({
    logTrial: mocks.logAdaptationTrial,
    flush: mocks.flushAdaptation,
  }),
}));

vi.mock('@/lib/mastery/flushMasteryShadow', () => ({
  flushMasteryShadow: mocks.flushMasteryShadow,
}));

vi.mock('@/lib/feedback/lastTrial', () => ({
  recordLastTrial: mocks.recordLastTrial,
}));

import { useTrialSubmission, type ProgressionAdapter } from './useTrialSubmission';
import type { UnifiedTrialInput, UnifiedTrialSummary } from '@/lib/trial/types';

const input: UnifiedTrialInput = {
  profileId: 'profile-1',
  sessionId: 'session-1',
  gameId: 'photo-naming',
  level: 1,
  isCorrect: true,
  supportUsed: 'independent',
  latencyMs: 500,
  taskParameters: {
    unified_route_adaptation_log: true,
  },
};

function progression(): ProgressionAdapter {
  return {
    recordTrialOutcome: vi.fn(),
    flushAtSessionEnd: vi.fn(async () => ({ ok: true })),
    state: { currentLevel: 1, progressPct: 25, supportBaseline: 0 },
    __bufferedTrialCount: vi.fn(() => 1),
  };
}

describe('useTrialSubmission persistence gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.flushAdaptation.mockResolvedValue(undefined);
    mocks.flushMasteryShadow.mockResolvedValue(undefined);
  });

  it('does not route adaptation or progression when the raw clinical event was not persisted', async () => {
    mocks.logExerciseEvent.mockResolvedValue(false);
    const p = progression();

    const { result } = renderHook(() =>
      useTrialSubmission({
        userId: 'user-1',
        profileId: 'profile-1',
        sessionId: 'session-1',
        exerciseSlug: 'photo-naming',
        progression: p,
        debug: false,
      }),
    );

    let summary: UnifiedTrialSummary | undefined;
    await act(async () => {
      summary = await result.current.submitTrial(input);
    });

    expect(mocks.logExerciseEvent).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({
      ok: false,
      routed: {
        exerciseEvents: false,
        adaptationTrialLogs: false,
        progressionBuffered: false,
      },
    });
    expect(mocks.logAdaptationTrial).not.toHaveBeenCalled();
    expect(p.recordTrialOutcome).not.toHaveBeenCalled();
  });

  it('routes each downstream layer once after the raw clinical event is persisted', async () => {
    mocks.logExerciseEvent.mockResolvedValue(true);
    const p = progression();

    const { result } = renderHook(() =>
      useTrialSubmission({
        userId: 'user-1',
        profileId: 'profile-1',
        sessionId: 'session-1',
        exerciseSlug: 'photo-naming',
        progression: p,
        debug: false,
      }),
    );

    let summary: UnifiedTrialSummary | undefined;
    await act(async () => {
      summary = await result.current.submitTrial(input);
    });

    expect(mocks.logExerciseEvent).toHaveBeenCalledTimes(1);
    expect(mocks.logAdaptationTrial).toHaveBeenCalledTimes(1);
    expect(p.recordTrialOutcome).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({
      ok: true,
      routed: {
        exerciseEvents: true,
        adaptationTrialLogs: true,
        progressionBuffered: true,
      },
    });
  });
});

describe('useTrialSubmission session-finalization barrier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.flushAdaptation.mockResolvedValue(undefined);
    mocks.flushMasteryShadow.mockResolvedValue(undefined);
  });

  it('must save the final in-flight trial and buffer it before flushing progression', async () => {
    let completeRawSave!: (saved: boolean) => void;
    const delayedRawSave = new Promise<boolean>(resolve => { completeRawSave = resolve; });
    mocks.logExerciseEvent.mockReturnValue(delayedRawSave);
    const adapter = progression();
    const order: string[] = [];
    adapter.recordTrialOutcome = vi.fn(() => { order.push('buffered'); });
    adapter.flushAtSessionEnd = vi.fn(async () => { order.push('flushed'); return { ok: true }; });

    const { result } = renderHook(() => useTrialSubmission({
      userId: 'user-1', profileId: 'profile-1', sessionId: 'session-1',
      exerciseSlug: 'fix-sentence', progression: adapter, debug: false,
    }));

    let save!: Promise<UnifiedTrialSummary>;
    let commit!: ReturnType<typeof result.current.commitSession>;
    await act(async () => {
      save = result.current.submitTrial(input);
      commit = result.current.commitSession();
      await Promise.resolve();
    });
    // On the final frame a game may commit without awaiting its previous
    // submitTrial; flushing first silently omits the final clinical attempt.
    expect(adapter.flushAtSessionEnd).not.toHaveBeenCalled();
    expect(mocks.flushAdaptation).not.toHaveBeenCalled();

    await act(async () => {
      completeRawSave(true);
      await Promise.all([save, commit]);
    });
    expect(adapter.recordTrialOutcome).toHaveBeenCalledTimes(1);
    expect(adapter.flushAtSessionEnd).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['buffered', 'flushed']);
  });
  it('does not report a successful commit when a trial database write was rejected', async () => {
    let completeRawSave!: (saved: boolean) => void;
    mocks.logExerciseEvent.mockReturnValue(new Promise<boolean>(resolve => { completeRawSave = resolve; }));
    const adapter = progression();
    const { result } = renderHook(() => useTrialSubmission({
      userId: 'user-1', profileId: 'profile-1', sessionId: 'session-1',
      exerciseSlug: 'fix-sentence', progression: adapter, debug: false,
    }));

    let save!: Promise<UnifiedTrialSummary>;
    let commit!: ReturnType<typeof result.current.commitSession>;
    await act(async () => {
      save = result.current.submitTrial(input);
      commit = result.current.commitSession();
    });
    expect(adapter.flushAtSessionEnd).not.toHaveBeenCalled();

    let summary!: UnifiedTrialSummary;
    let committed!: Awaited<typeof commit>;
    await act(async () => {
      completeRawSave(false);
      [summary, committed] = await Promise.all([save, commit]);
    });
    expect(summary.ok).toBe(false);
    expect(committed.ok).toBe(false);
    expect(committed.errors).toEqual(expect.arrayContaining([expect.stringMatching(/unconfirmed trial submissions/)]));
    expect(adapter.recordTrialOutcome).not.toHaveBeenCalled();
    expect(mocks.logAdaptationTrial).not.toHaveBeenCalled();
  });

  it('waits for two simultaneous saves before any session-end flush', async () => {
    const resolvers: Array<(saved: boolean) => void> = [];
    mocks.logExerciseEvent.mockImplementation(() => new Promise<boolean>(resolve => { resolvers.push(resolve); }));
    const adapter = progression();
    const { result } = renderHook(() => useTrialSubmission({
      userId: 'user-1', profileId: 'profile-1', sessionId: 'session-1',
      exerciseSlug: 'fix-sentence', progression: adapter, debug: false,
    }));
    let pending!: Array<Promise<UnifiedTrialSummary>>;
    let commit!: ReturnType<typeof result.current.commitSession>;
    await act(async () => {
      pending = [result.current.submitTrial(input), result.current.submitTrial({ ...input, trialIndex: 2 })];
      commit = result.current.commitSession();
    });
    expect(resolvers).toHaveLength(2);
    await act(async () => {
      resolvers[0](true);
      await pending[0];
    });
    expect(adapter.flushAtSessionEnd).not.toHaveBeenCalled();
    await act(async () => {
      resolvers[1](true);
      const all = await Promise.all([...pending, commit]);
      expect(all[2].ok).toBe(true);
    });
    expect(adapter.recordTrialOutcome).toHaveBeenCalledTimes(2);
    expect(adapter.flushAtSessionEnd).toHaveBeenCalledTimes(1);
    expect(mocks.flushAdaptation).toHaveBeenCalledTimes(1);
  });

});
