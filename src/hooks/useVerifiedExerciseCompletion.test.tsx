import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVerifiedExerciseCompletion } from './useVerifiedExerciseCompletion';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

function setup(scope: string | null = 'patient-a:session-a') {
  const services = {
    commitSession: vi.fn(async (): Promise<{ ok: boolean }> => ({ ok: true })),
    completeSession: vi.fn(async (): Promise<boolean> => true),
    retryFailedSubmissions: vi.fn(async (): Promise<{ ok: boolean }> => ({ ok: true })),
    onConfirmed: vi.fn(),
  };
  const view = renderHook(
    (args: { scope: string | null }) => useVerifiedExerciseCompletion<string[]>({
      ...services, scope: args.scope,
    }),
    { initialProps: { scope } },
  );
  return { ...view, services };
}

beforeEach(() => vi.clearAllMocks());

describe('verified exercise completion patient and clinical-save boundaries', () => {
  it('waits for both raw/progression commit and acknowledged session close', async () => {
    const { result, services } = setup();
    const commit = deferred<{ ok: boolean }>();
    const close = deferred<boolean>();
    services.commitSession.mockReturnValueOnce(commit.promise);
    services.completeSession.mockReturnValueOnce(close.promise);

    let completion!: Promise<boolean>;
    await act(async () => {
      completion = result.current.finish(['synthetic-answer']);
      await Promise.resolve();
    });
    expect(result.current.saveState).toBe('saving');
    expect(services.completeSession).not.toHaveBeenCalled();
    expect(services.onConfirmed).not.toHaveBeenCalled();

    await act(async () => { commit.resolve({ ok: true }); await Promise.resolve(); });
    expect(services.completeSession).toHaveBeenCalledTimes(1);
    expect(result.current.saveState).toBe('saving');
    expect(services.onConfirmed).not.toHaveBeenCalled();

    await act(async () => { close.resolve(true); expect(await completion).toBe(true); });
    expect(result.current.saveState).toBe('complete');
    expect(services.onConfirmed).toHaveBeenCalledTimes(1);
    expect(services.onConfirmed).toHaveBeenCalledWith(['synthetic-answer']);
  });

  it('fails closed before session close and downstream success when a raw commit failed', async () => {
    const { result, services } = setup();
    services.commitSession.mockResolvedValueOnce({ ok: false });
    await act(async () => {
      expect(await result.current.finish(['first-result'])).toBe(false);
    });
    expect(result.current.saveState).toBe('error');
    expect(services.completeSession).not.toHaveBeenCalled();
    expect(services.onConfirmed).not.toHaveBeenCalled();

    services.retryFailedSubmissions.mockResolvedValueOnce({ ok: false });
    await act(async () => {
      expect(await result.current.retry()).toBe(false);
    });
    expect(services.commitSession).toHaveBeenCalledTimes(1);
    expect(services.completeSession).not.toHaveBeenCalled();

    await act(async () => {
      expect(await result.current.retry()).toBe(true);
    });
    expect(result.current.saveState).toBe('complete');
    expect(services.retryFailedSubmissions).toHaveBeenCalledTimes(2);
    expect(services.commitSession).toHaveBeenCalledTimes(2);
    expect(services.completeSession).toHaveBeenCalledTimes(1);
    expect(services.onConfirmed).toHaveBeenCalledTimes(1);
    expect(services.onConfirmed).toHaveBeenCalledWith(['first-result']);
  });

  it('retries a failed close without duplicating committed clinical progression', async () => {
    const { result, services } = setup();
    services.completeSession.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await act(async () => { expect(await result.current.finish(['answer'])).toBe(false); });
    expect(result.current.saveState).toBe('error');
    await act(async () => { expect(await result.current.retry()).toBe(true); });
    expect(services.commitSession).toHaveBeenCalledTimes(1);
    expect(services.completeSession).toHaveBeenCalledTimes(2);
    expect(services.onConfirmed).toHaveBeenCalledTimes(1);
  });

  it('ignores duplicate finish taps during save and after confirmation', async () => {
    const { result, services } = setup();
    const commit = deferred<{ ok: boolean }>();
    services.commitSession.mockReturnValueOnce(commit.promise);
    let pending!: Promise<boolean>;
    await act(async () => {
      pending = result.current.finish(['answer']);
      expect(await result.current.finish(['duplicate'])).toBe(false);
    });
    expect(services.commitSession).toHaveBeenCalledTimes(1);
    await act(async () => {
      commit.resolve({ ok: true });
      expect(await pending).toBe(true);
    });
    await act(async () => {
      expect(await result.current.finish(['second'])).toBe(false);
    });
    expect(services.commitSession).toHaveBeenCalledTimes(1);
    expect(services.onConfirmed).toHaveBeenCalledTimes(1);
    expect(services.onConfirmed).toHaveBeenCalledWith(['answer']);
  });

  it('never closes or announces a stale patient when scope changes during a pending commit', async () => {
    const { result, services, rerender } = setup();
    const commit = deferred<{ ok: boolean }>();
    services.commitSession.mockReturnValueOnce(commit.promise);
    let old!: Promise<boolean>;
    await act(async () => {
      old = result.current.finish(['patient-a']);
      await Promise.resolve();
    });
    rerender({ scope: 'patient-b:session-b' });
    expect(result.current.saveState).toBe('idle');
    await act(async () => {
      commit.resolve({ ok: true });
      expect(await old).toBe(false);
    });
    expect(services.completeSession).not.toHaveBeenCalled();
    expect(services.onConfirmed).not.toHaveBeenCalled();
    await act(async () => { expect(await result.current.finish(['patient-b'])).toBe(true); });
    expect(services.completeSession).toHaveBeenCalledTimes(1);
    expect(services.onConfirmed).toHaveBeenCalledTimes(1);
    expect(services.onConfirmed).toHaveBeenCalledWith(['patient-b']);
  });

  it('cannot claim an offline/unknown session is saved', async () => {
    const { result, services } = setup(null);
    await act(async () => {
      expect(await result.current.finish(['no-session'])).toBe(false);
    });
    expect(result.current.saveState).toBe('error');
    expect(services.commitSession).not.toHaveBeenCalled();
    expect(services.completeSession).not.toHaveBeenCalled();
  });

  it('keeps confirmed success when an optional UI callback throws', async () => {
    const { result, services } = setup();
    services.onConfirmed.mockImplementationOnce(() => { throw new Error('navigation error'); });
    const originalError = console.error;
    console.error = vi.fn();
    try {
      await act(async () => {
        expect(await result.current.finish(['answer'])).toBe(true);
      });
      expect(result.current.saveState).toBe('complete');
      expect(services.commitSession).toHaveBeenCalledTimes(1);
      expect(services.completeSession).toHaveBeenCalledTimes(1);
    } finally {
      console.error = originalError;
    }
  });
});
