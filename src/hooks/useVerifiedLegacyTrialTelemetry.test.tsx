import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  logTrial: vi.fn(),
  startTrial: vi.fn(),
  reset: vi.fn(),
  calculateReactionTime: vi.fn(),
}));
vi.mock('@/hooks/useExerciseTelemetry', () => ({
  useExerciseTelemetry: () => ({
    startTrial: service.startTrial,
    logTrial: service.logTrial,
    calculateReactionTime: service.calculateReactionTime,
    reset: service.reset,
  }),
}));

import { useVerifiedLegacyTrialTelemetry } from './useVerifiedLegacyTrialTelemetry';

function hook() {
  return renderHook(({ id, profile }) => useVerifiedLegacyTrialTelemetry(
    id, 'reach-tap', 'synthetic-user', profile,
  ), { initialProps: { id: 'synthetic-session', profile: 'synthetic-profile' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  service.logTrial.mockResolvedValue(true);
});
afterEach(() => cleanup());

describe('generic Reach/Tap/Phrase original-ID evidence save barrier', () => {
  it('will not confirm an unacknowledged attempt, then retries the identical clinical payload', async () => {
    service.logTrial.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { result } = hook();
    await act(async () => {
      expect(await result.current.logTrial({
        correct: true, reactionTimeMs: 1300, trialIndex: 1,
      })).toBe(false);
      expect(await result.current.commitSession()).toEqual({ ok: false });
    });
    await act(async () => {
      expect(await result.current.retryFailedSubmissions()).toEqual({ ok: true });
      expect(await result.current.commitSession()).toEqual({ ok: true });
    });
    expect(service.logTrial).toHaveBeenCalledTimes(2);
    const original = service.logTrial.mock.calls[0][0];
    expect(original.attemptId).toEqual(expect.any(String));
    expect(original).toEqual(service.logTrial.mock.calls[1][0]);
  });

  it('does not close before the last in-flight event acknowledgement', async () => {
    let resolve!: (value: boolean) => void;
    service.logTrial.mockImplementationOnce(() => new Promise<boolean>(r => { resolve = r; }));
    const { result } = hook();
    let commit!: Promise<{ ok: boolean }>;
    await act(async () => {
      void result.current.logTrial({ correct: false, reactionTimeMs: 1000, trialIndex: 1 });
      commit = result.current.commitSession();
      await Promise.resolve();
    });
    let settled = false;
    void commit.then(() => { settled = true; });
    expect(settled).toBe(false);
    await act(async () => {
      resolve(true);
      expect(await commit).toEqual({ ok: true });
    });
    expect(service.logTrial).toHaveBeenCalledTimes(1);
  });

  it('deduplicates duplicate submissions of the same attempt ID', async () => {
    const { result } = hook();
    const payload = { attemptId: 'synthetic-attempt', correct: true, reactionTimeMs: 100 };
    await act(async () => {
      expect(await result.current.logTrial(payload)).toBe(true);
      expect(await result.current.logTrial(payload)).toBe(true);
    });
    expect(service.logTrial).toHaveBeenCalledTimes(1);
  });

  it('clears all patient evidence on profile or session switch', async () => {
    const { result, rerender } = hook();
    await act(async () => {
      expect(await result.current.logTrial({
        correct: true, reactionTimeMs: 100, trialIndex: 1,
      })).toBe(true);
    });
    rerender({ id: 'another-session', profile: 'another-profile' });
    await act(async () => {
      expect(await result.current.commitSession()).toEqual({ ok: false });
      expect(await result.current.retryFailedSubmissions()).toEqual({ ok: true });
    });
    expect(service.logTrial).toHaveBeenCalledTimes(1);
  });

  it('cannot advertise an unknown or zero-response session as completed therapy', async () => {
    const { result, rerender } = hook();
    await act(async () => {
      expect(await result.current.commitSession()).toEqual({ ok: false });
    });
    rerender({ id: '', profile: '' });
    await act(async () => {
      expect(await result.current.logTrial({ correct: true, reactionTimeMs: 100 })).toBe(false);
      expect(await result.current.commitSession()).toEqual({ ok: false });
    });
    expect(service.logTrial).not.toHaveBeenCalled();
  });
});
