import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeechEndDetection } from '@/hooks/useSpeechEndDetection';

/**
 * Verifies the aphasia patience fixes in useSpeechEndDetection.
 *
 * The reported symptom was pause-heavy speakers being cut off mid-utterance: the
 * hook used to commit the turn the instant the browser flagged ANY isFinal
 * result, which the browser does on ordinary inter-word pauses. These tests lock
 * in that (a) an isFinal no longer instantly commits a turn that may continue,
 * and (b) the turn still commits after a patient silence window (never hangs,
 * never finalizes under ~1s).
 */
describe('useSpeechEndDetection — aphasia patience', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('does NOT commit immediately on isFinal for an incomplete fragment', () => {
    const onSpeechEnd = vi.fn();
    const { result } = renderHook(() =>
      useSpeechEndDetection({ onSpeechEnd, enabled: true }),
    );
    act(() => result.current.onStart());
    // "the" — a fragment a pause-heavy aphasic speaker would keep going from.
    act(() => result.current.onTranscriptUpdate('the', true));
    expect(onSpeechEnd).not.toHaveBeenCalled();
  });

  it('does NOT commit a full sentence instantly on isFinal — it waits out a patient window', () => {
    const onSpeechEnd = vi.fn();
    const { result } = renderHook(() =>
      useSpeechEndDetection({ onSpeechEnd, enabled: true }),
    );
    act(() => result.current.onStart());
    act(() => result.current.onTranscriptUpdate('the dog is running very fast', true));
    // Not committed instantly...
    expect(onSpeechEnd).not.toHaveBeenCalled();
    // ...and definitely not under ~1s of silence.
    act(() => vi.advanceTimersByTime(500));
    expect(onSpeechEnd).not.toHaveBeenCalled();
  });

  it('still commits after a patient silence window (never hangs)', () => {
    const onSpeechEnd = vi.fn();
    const { result } = renderHook(() =>
      useSpeechEndDetection({ onSpeechEnd, enabled: true }),
    );
    act(() => result.current.onStart());
    act(() => result.current.onTranscriptUpdate('the dog is running very fast', true));
    // After a generous patient window with no continuation, it finalizes.
    act(() => vi.advanceTimersByTime(3000));
    expect(onSpeechEnd).toHaveBeenCalledWith('the dog is running very fast');
  });
});
