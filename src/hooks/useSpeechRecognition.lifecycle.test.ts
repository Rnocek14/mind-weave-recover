// Regression tests for the microphone lifecycle. No real patient data or hardware needed.
// These tests deliberately simulate browser speech-recognition events.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSpeechRecognition } from './useSpeechRecognition';
import { voiceController } from '@/lib/voiceController';

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = '';
  maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onresult: ((event: unknown) => void) | null = null;
  starts = 0;
  stops = 0;
  deferredStop = false;
  stopping = false;
  constructor() { FakeRecognition.instances.push(this); }
  start() { if (this.stopping) throw new Error('recognizer is still stopping'); this.starts++; this.onstart?.(); }
  stop() { this.stops++; if (this.deferredStop) { this.stopping = true; } else { this.onend?.(); } }
  finishStop() { this.stopping = false; this.onend?.(); }
  emitError(error: string) { this.onerror?.({ error }); }
  end() { this.onend?.(); }
}

describe('patient microphone lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeRecognition.instances = [];
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: FakeRecognition });
    voiceController.setSessionPaused(false);
  });
  afterEach(() => {
    voiceController.setSessionPaused(false);
    vi.clearAllTimers();
    vi.useRealTimers();
    Reflect.deleteProperty(window, 'SpeechRecognition');
  });

  it('starts automatically when enabled and requested', () => {
    const { result, unmount } = renderHook(() => useSpeechRecognition({
      onResult: vi.fn(), autoStart: true, patientMode: true, enabled: true,
    }));
    expect(FakeRecognition.instances[0].starts).toBe(1);
    expect(result.current.isListening).toBe(true);
    unmount();
  });

  it('never starts when disabled', () => {
    const { unmount } = renderHook(() => useSpeechRecognition({
      onResult: vi.fn(), autoStart: true, patientMode: true, enabled: false,
    }));
    expect(FakeRecognition.instances[0].starts).toBe(0);
    unmount();
  });

  it('does not retry after permission denial', () => {
    const { result, unmount } = renderHook(() => useSpeechRecognition({
      onResult: vi.fn(), autoStart: true, patientMode: true,
    }));
    const recognition = FakeRecognition.instances[0];
    act(() => recognition.emitError('not-allowed'));
    act(() => { vi.advanceTimersByTime(10000); });
    expect(recognition.starts).toBe(1);
    expect(result.current.error).toMatch(/denied/i);
    unmount();
  });

  it('recovers after a spontaneous recognizer end', () => {
    const { unmount } = renderHook(() => useSpeechRecognition({
      onResult: vi.fn(), autoStart: true, patientMode: true,
    }));
    const recognition = FakeRecognition.instances[0];
    act(() => recognition.end());
    act(() => { vi.advanceTimersByTime(1500); });
    expect(recognition.starts).toBeGreaterThan(1);
    unmount();
  });

  it('stops recording on session pause and resumes afterward', () => {
    const { result, unmount } = renderHook(() => useSpeechRecognition({
      onResult: vi.fn(), autoStart: true, patientMode: true,
    }));
    const recognition = FakeRecognition.instances[0];
    act(() => voiceController.setSessionPaused(true));
    expect(recognition.stops).toBeGreaterThan(0);
    expect(result.current.isListening).toBe(false);
    act(() => voiceController.setSessionPaused(false));
    expect(recognition.starts).toBeGreaterThan(1);
    unmount();
  });

  it('recovers when resume happens before the browser finishes stopping', () => {
    const { result, unmount } = renderHook(() => useSpeechRecognition({
      onResult: vi.fn(), autoStart: true, patientMode: true,
    }));
    const recognition = FakeRecognition.instances[0];
    recognition.deferredStop = true;
    act(() => voiceController.setSessionPaused(true));
    expect(recognition.stopping).toBe(true);
    act(() => voiceController.setSessionPaused(false));
    // A real browser can reject start() while stop() is still pending.
    act(() => recognition.finishStop());
    act(() => { vi.advanceTimersByTime(1500); });
    expect(result.current.isListening).toBe(true);
    expect(recognition.starts).toBeGreaterThan(1);
    unmount();
  });

  it('does not restart after unmount', () => {
    const { unmount } = renderHook(() => useSpeechRecognition({
      onResult: vi.fn(), autoStart: true, patientMode: true,
    }));
    const recognition = FakeRecognition.instances[0];
    unmount();
    act(() => { vi.advanceTimersByTime(10000); });
    expect(recognition.starts).toBe(1);
  });
});
