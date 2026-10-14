import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAcknowledgedTrialReporter } from './acknowledgedTrialReporter';

afterEach(() => {
  vi.useRealTimers();
});

describe('acknowledged primary clinical trial', () => {
  it('saves full analysis when it finishes before the deadline', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(true);
    const reporter = createAcknowledgedTrialReporter(save, { mode: 'fallback' }, 3000);
    await reporter.report({ mode: 'full' });
    await vi.advanceTimersByTimeAsync(4000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ mode: 'full' });
    await expect(reporter.acknowledgement).resolves.toBe(true);
  });

  it('saves the fallback once if optional analysis never resolves', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(true);
    const reporter = createAcknowledgedTrialReporter(save, { mode: 'fallback' }, 3000);
    await vi.advanceTimersByTimeAsync(3001);
    await expect(reporter.acknowledgement).resolves.toBe(true);
    await reporter.report({ mode: 'late' });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ mode: 'fallback' });
  });

  it('does not report success until the storage promise resolves', async () => {
    vi.useFakeTimers();
    let acknowledge: (v: boolean) => void = () => {};
    const save = vi.fn(() => new Promise<boolean>((resolve) => { acknowledge = resolve; }));
    const reporter = createAcknowledgedTrialReporter(save, { attempt: 1 }, 100);
    await vi.advanceTimersByTimeAsync(100);
    let settled = false;
    void reporter.acknowledgement.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    acknowledge(true);
    await expect(reporter.acknowledgement).resolves.toBe(true);
  });

  it('reports a failed write, and retries the exact captured payload', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const fallback = { attemptId: 'stable-1', scored: false };
    const reporter = createAcknowledgedTrialReporter(save, fallback, 100);
    await vi.advanceTimersByTimeAsync(100);
    await expect(reporter.acknowledgement).resolves.toBe(false);
    expect(await reporter.retry()).toBe(true);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenNthCalledWith(2, fallback);
  });

  it('fails closed when the callback throws and cannot claim a persisted write', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockRejectedValue(new Error('offline'));
    const reporter = createAcknowledgedTrialReporter(save, { attemptId: 'a' }, 100);
    await vi.advanceTimersByTimeAsync(100);
    await expect(reporter.acknowledgement).resolves.toBe(false);
    expect(await reporter.retry()).toBe(false);
  });
});
