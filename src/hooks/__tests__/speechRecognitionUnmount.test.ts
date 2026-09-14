/**
 * The microphone must not outlive the page that opened it.
 *
 * Patient mode keeps the recognizer alive across the browser's own stops: when
 * `onend` fires it schedules a restart, up to 999 times, because an aphasia
 * user cannot be asked to toggle Voice off and on. The unmount cleanup called
 * `recognition.stop()` and cleared the pending timers — but `stop()` is
 * asynchronous, so `onend` arrived AFTER cleanup had run, saw no
 * "manually stopped" flag, and scheduled a fresh restart that cleanup could no
 * longer clear. Navigating away from Photo Naming mid-trial therefore left the
 * recognizer running: a hot microphone on a page the patient has left.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = '';
  maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  onresult: ((e: any) => void) | null = null;
  starts = 0;
  stops = 0;
  running = false;

  constructor() {
    FakeRecognition.instances.push(this);
  }

  start() {
    if (this.running) throw new Error('InvalidStateError: already started');
    this.starts += 1;
    this.running = true;
    this.onstart?.();
  }

  stop() {
    this.stops += 1;
    // The real API ends asynchronously — that gap is the whole bug.
  }

  /** The browser delivering the end event some time after stop(). */
  fireEnd() {
    this.running = false;
    this.onend?.();
  }
}

import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

describe('useSpeechRecognition — the recognizer stops when the page goes away', () => {
  beforeEach(() => {
    FakeRecognition.instances = [];
    (window as any).SpeechRecognition = FakeRecognition;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    delete (window as any).SpeechRecognition;
  });

  it('does not restart after unmount when the end event arrives late (patient mode)', () => {
    const { result, unmount } = renderHook(() =>
      useSpeechRecognition({ onResult: () => {}, patientMode: true, continuousListening: true }),
    );

    act(() => { result.current.startListening(); });
    const rec = FakeRecognition.instances[0];
    expect(rec.starts).toBe(1);
    expect(rec.running).toBe(true);

    unmount();
    expect(rec.stops).toBeGreaterThanOrEqual(1);

    // The browser ends the session after the component is gone.
    act(() => { rec.fireEnd(); });
    act(() => { vi.advanceTimersByTime(10_000); });

    expect(rec.starts).toBe(1); // never re-armed
    expect(rec.running).toBe(false);
    expect(FakeRecognition.instances).toHaveLength(1); // no second recognizer either
  });

  it('a pending restart timer scheduled before unmount never fires', () => {
    const { result, unmount } = renderHook(() =>
      useSpeechRecognition({ onResult: () => {}, patientMode: true }),
    );

    act(() => { result.current.startListening(); });
    const rec = FakeRecognition.instances[0];

    // A silence-driven end BEFORE unmount arms the restart backoff.
    act(() => { rec.fireEnd(); });
    unmount();
    act(() => { vi.advanceTimersByTime(10_000); });

    expect(rec.starts).toBe(1);
    expect(rec.running).toBe(false);
  });

  it('still auto-restarts while the component is mounted (the behaviour patients rely on)', () => {
    const { result, unmount } = renderHook(() =>
      useSpeechRecognition({ onResult: () => {}, patientMode: true }),
    );

    act(() => { result.current.startListening(); });
    const rec = FakeRecognition.instances[0];
    act(() => { rec.fireEnd(); });
    act(() => { vi.advanceTimersByTime(2_000); });

    expect(rec.starts).toBe(2);
    expect(rec.running).toBe(true);
    unmount();
  });
});
