import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePatientSpeechTurn } from '@/hooks/usePatientSpeechTurn';

describe('usePatientSpeechTurn — Finish the Thought', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-04T12:00:00Z'));
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const onSpeechEnd = vi.fn();
    const hook = renderHook(
      ({ transcript, enabled }: { transcript: string; enabled: boolean }) =>
        usePatientSpeechTurn({ task: 'thought_continuation', transcript, enabled, onSpeechEnd }),
      { initialProps: { transcript: '', enabled: true } },
    );
    return { ...hook, onSpeechEnd };
  }

  it('does not analyze at 2, 5 or 8 seconds; continued speech restarts the patient window', () => {
    const { rerender, onSpeechEnd } = setup();
    rerender({ transcript: 'I wanted to', enabled: true });
    act(() => vi.advanceTimersByTime(8_000));
    expect(onSpeechEnd).not.toHaveBeenCalled();
    rerender({ transcript: 'I wanted to visit the park.', enabled: true });
    act(() => vi.advanceTimersByTime(8_000));
    expect(onSpeechEnd).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(3_000));
    expect(onSpeechEnd).toHaveBeenCalledTimes(1);
    expect(onSpeechEnd).toHaveBeenCalledWith('I wanted to visit the park.');
  });

  it('does not auto-score an explicitly unfinished sentence; patient can tap Done', () => {
    const { result, rerender, onSpeechEnd } = setup();
    rerender({ transcript: 'I went to the store because', enabled: true });
    act(() => vi.advanceTimersByTime(12_000));
    expect(onSpeechEnd).not.toHaveBeenCalled();
    expect(result.current.waitingForCompletion).toBe(true);
    act(() => result.current.finishNow());
    expect(onSpeechEnd).toHaveBeenCalledWith('I went to the store because');
    act(() => vi.advanceTimersByTime(30_000));
    expect(onSpeechEnd).toHaveBeenCalledTimes(1);
  });

  it('allows early Done without a duplicate at timeout', () => {
    const { result, rerender, onSpeechEnd } = setup();
    rerender({ transcript: 'I chose the red cup.', enabled: true });
    act(() => result.current.finishNow());
    act(() => result.current.finishNow());
    act(() => vi.advanceTimersByTime(20_000));
    expect(onSpeechEnd).toHaveBeenCalledTimes(1);
  });

  it('cancels stale scoring on disable, reset, and unmount', () => {
    const { result, rerender, unmount, onSpeechEnd } = setup();
    rerender({ transcript: 'I went to the store.', enabled: true });
    act(() => vi.advanceTimersByTime(7_000));
    rerender({ transcript: 'I went to the store.', enabled: false });
    act(() => vi.advanceTimersByTime(20_000));
    expect(onSpeechEnd).not.toHaveBeenCalled();
    act(() => result.current.resetTurn());
    rerender({ transcript: '', enabled: true });
    rerender({ transcript: 'I went to the park.', enabled: true });
    unmount();
    act(() => vi.advanceTimersByTime(20_000));
    expect(onSpeechEnd).not.toHaveBeenCalled();
  });

  it('does not auto-score old text after feedback asks for another sentence', () => {
    const { result, rerender, onSpeechEnd } = setup();
    rerender({ transcript: 'I went outside.', enabled: true });
    act(() => result.current.finishNow());
    expect(onSpeechEnd).toHaveBeenCalledTimes(1);
    rerender({ transcript: 'I went outside.', enabled: false });
    act(() => result.current.waitForNewSpeech());
    expect(result.current.awaitingNewSpeech).toBe(true);
    // A second manual click must not log the previously captured response.
    act(() => result.current.finishNow());
    expect(onSpeechEnd).toHaveBeenCalledTimes(1);
    rerender({ transcript: 'I went outside.', enabled: true });
    act(() => vi.advanceTimersByTime(20_000));
    expect(onSpeechEnd).toHaveBeenCalledTimes(1);
    rerender({ transcript: 'I went outside. To see my neighbor.', enabled: true });
    expect(result.current.awaitingNewSpeech).toBe(false);
    act(() => vi.advanceTimersByTime(14_000));
    expect(onSpeechEnd).toHaveBeenCalledTimes(2);
    expect(onSpeechEnd).toHaveBeenLastCalledWith('I went outside. To see my neighbor.');
  });
});
