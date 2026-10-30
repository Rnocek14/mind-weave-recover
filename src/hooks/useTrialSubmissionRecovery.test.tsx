import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnifiedTrialInput } from '@/lib/trial/types';

const services = vi.hoisted(() => ({
  logExerciseEvent: vi.fn(),
  logAdaptationTrial: vi.fn(),
  flushAdaptation: vi.fn(),
  flushMasteryShadow: vi.fn(),
  recordLastTrial: vi.fn(),
}));

vi.mock('@/hooks/useExerciseTelemetry', () => ({
  useExerciseTelemetry: () => ({
    logTrial: services.logExerciseEvent,
    startTrial: vi.fn(),
    calculateReactionTime: vi.fn(),
  }),
}));
vi.mock('@/hooks/useAdaptationTrialLogger', () => ({
  useAdaptationTrialLogger: () => ({
    logTrial: services.logAdaptationTrial,
    flushVerified: services.flushAdaptation,
  }),
}));
vi.mock('@/lib/mastery/flushMasteryShadow', () => ({
  flushMasteryShadow: services.flushMasteryShadow,
}));
vi.mock('@/lib/feedback/lastTrial', () => ({
  recordLastTrial: services.recordLastTrial,
}));

import { useTrialSubmission, type ProgressionAdapter } from './useTrialSubmission';

function input(trialIndex = 1): UnifiedTrialInput {
  return {
    profileId: 'synthetic-profile-a',
    sessionId: 'synthetic-session-a',
    gameId: 'two_clues',
    level: 2,
    stimulusId: 'puzzle-' + trialIndex,
    trialIndex,
    trialMode: 'production',
    userResponse: 'word-' + trialIndex,
    isCorrect: true,
    accuracyScore: 1,
    supportUsed: 'independent',
    latencyMs: 1200,
    taskParameters: {
      unified_route_adaptation_log: true,
      saved_index: trialIndex,
    },
  };
}

function adapter(): ProgressionAdapter {
  return {
    recordTrialOutcome: vi.fn(),
    flushAtSessionEnd: vi.fn(async () => ({ ok: true })),
    state: { currentLevel: 2, progressPct: 25, supportBaseline: 0 },
    __bufferedTrialCount: vi.fn(() => 1),
  };
}

function hook(progression: ProgressionAdapter = adapter()) {
  return renderHook(() => useTrialSubmission({
    userId: 'synthetic-user-a',
    profileId: 'synthetic-profile-a',
    sessionId: 'synthetic-session-a',
    exerciseSlug: 'two_clues',
    progression,
    debug: false,
  }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { resolve, promise };
}

beforeEach(() => {
  vi.clearAllMocks();
  services.logExerciseEvent.mockResolvedValue(true);
  services.flushAdaptation.mockResolvedValue(true);
  services.flushMasteryShadow.mockResolvedValue(undefined);
});

describe('useTrialSubmission: explicit idempotent recovery of unconfirmed clinical attempts', () => {
  it('blocks close until missing attempt is confirmed; replays its original attempt ID', async () => {
    services.logExerciseEvent.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const progression = adapter();
    const { result } = hook(progression);

    await act(async () => {
      expect((await result.current.submitTrial(input(7))).ok).toBe(false);
    });
    await act(async () => {
      const premature = await result.current.commitSession();
      expect(premature.ok).toBe(false);
      expect(premature.errors).toEqual(expect.arrayContaining([expect.stringMatching(/unconfirmed trial submissions/)]));
    });
    expect(progression.flushAtSessionEnd).not.toHaveBeenCalled();
    expect(services.flushAdaptation).not.toHaveBeenCalled();
    expect(services.flushMasteryShadow).not.toHaveBeenCalled();
    expect(progression.recordTrialOutcome).not.toHaveBeenCalled();

    await act(async () => {
      expect(await result.current.retryFailedSubmissions()).toEqual({
        ok: true, recovered: 1, remaining: 0,
      });
    });
    expect(services.logExerciseEvent).toHaveBeenCalledTimes(2);
    const first = services.logExerciseEvent.mock.calls[0][0];
    const second = services.logExerciseEvent.mock.calls[1][0];
    expect(first.attemptId).toEqual(expect.any(String));
    expect(first.attemptId).toBe(second.attemptId);
    expect(first.trialIndex).toBe(7);
    expect(second.trialIndex).toBe(7);
    expect(first.taskParameters.user_response).toBe('word-7');
    expect(second.taskParameters.user_response).toBe('word-7');
    expect(progression.recordTrialOutcome).toHaveBeenCalledTimes(1);
    expect(services.logAdaptationTrial).toHaveBeenCalledTimes(1);
    expect(services.recordLastTrial).toHaveBeenCalledTimes(1);

    await act(async () => {
      expect((await result.current.commitSession()).ok).toBe(true);
    });
    expect(progression.flushAtSessionEnd).toHaveBeenCalledTimes(1);
    expect(services.flushMasteryShadow).toHaveBeenCalledTimes(1);
  });

  it('remains blocked after unsuccessful explicit retry, then can recover later', async () => {
    services.logExerciseEvent
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const progression = adapter();
    const { result } = hook(progression);
    await act(async () => { await result.current.submitTrial(input()); });

    await act(async () => {
      expect(await result.current.retryFailedSubmissions()).toEqual({
        ok: false, recovered: 0, remaining: 1,
      });
      expect((await result.current.commitSession()).ok).toBe(false);
    });
    expect(progression.recordTrialOutcome).not.toHaveBeenCalled();
    expect(progression.flushAtSessionEnd).not.toHaveBeenCalled();

    await act(async () => {
      expect(await result.current.retryFailedSubmissions()).toEqual({
        ok: true, recovered: 1, remaining: 0,
      });
      expect((await result.current.commitSession()).ok).toBe(true);
    });
    const ids = services.logExerciseEvent.mock.calls.map(call => call[0].attemptId);
    expect(new Set(ids).size).toBe(1);
    expect(progression.recordTrialOutcome).toHaveBeenCalledTimes(1);
  });

  it('deduplicates simultaneous retry taps while a write is pending', async () => {
    const pending = deferred<boolean>();
    services.logExerciseEvent.mockResolvedValueOnce(false).mockReturnValueOnce(pending.promise);
    const { result } = hook();
    await act(async () => { await result.current.submitTrial(input()); });

    let a!: ReturnType<typeof result.current.retryFailedSubmissions>;
    let b!: ReturnType<typeof result.current.retryFailedSubmissions>;
    await act(async () => {
      a = result.current.retryFailedSubmissions();
      b = result.current.retryFailedSubmissions();
      await Promise.resolve();
    });
    expect(services.logExerciseEvent).toHaveBeenCalledTimes(2);
    await act(async () => {
      pending.resolve(true);
      expect(await a).toMatchObject({ ok: true, recovered: 1, remaining: 0 });
      expect(await b).toMatchObject({ ok: true, recovered: 1, remaining: 0 });
    });
    expect(services.logExerciseEvent).toHaveBeenCalledTimes(2);
  });

  it('retries only failed attempts with distinct identities and original order', async () => {
    services.logExerciseEvent
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const progression = adapter();
    const { result } = hook(progression);
    await act(async () => {
      await result.current.submitTrial(input(1));
      await result.current.submitTrial(input(2));
    });
    expect(progression.recordTrialOutcome).toHaveBeenCalledTimes(1);
    await act(async () => {
      expect(await result.current.retryFailedSubmissions()).toMatchObject({ ok: true, recovered: 1 });
    });

    expect(services.logExerciseEvent).toHaveBeenCalledTimes(3);
    const calls = services.logExerciseEvent.mock.calls.map(([event]) => event);
    expect(calls[0].attemptId).not.toBe(calls[1].attemptId);
    expect(calls[1].attemptId).toBe(calls[2].attemptId);
    expect(calls[1].trialIndex).toBe(2);
    expect(calls[2].trialIndex).toBe(2);
    expect(progression.recordTrialOutcome).toHaveBeenCalledTimes(2);
    expect(services.recordLastTrial).toHaveBeenCalledTimes(2);
    expect(services.logAdaptationTrial.mock.calls.map(([event]) => event.trialIndex)).toEqual([0, 1]);
  });

  it('never replays an old patient session under another profile', async () => {
    services.logExerciseEvent.mockResolvedValueOnce(false);
    const progression = adapter();
    const { result, rerender } = renderHook(
      ({ userId, profileId, sessionId }) => useTrialSubmission({
        userId, profileId, sessionId,
        exerciseSlug: 'two_clues', progression, debug: false,
      }),
      { initialProps: {
        userId: 'synthetic-user-a',
        profileId: 'synthetic-profile-a',
        sessionId: 'synthetic-session-a',
      } },
    );
    await act(async () => { await result.current.submitTrial(input()); });
    rerender({
      userId: 'synthetic-user-b',
      profileId: 'synthetic-profile-b',
      sessionId: 'synthetic-session-b',
    });
    await act(async () => {
      expect(await result.current.retryFailedSubmissions()).toEqual({
        ok: true, recovered: 0, remaining: 0,
      });
    });
    expect(services.logExerciseEvent).toHaveBeenCalledTimes(1);
  });
});
