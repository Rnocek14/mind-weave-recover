/**
 * An interrupted utterance has to finish, or the trial that awaited it stops.
 *
 * Games do `await speak(sentence)` and then DO THE TRIAL — open the mic, arm
 * the stall reminder, call startEcho(). speakStream's promise has five
 * resolvers and every one of them is an event or a timer belonging to the
 * audio element. `pause()` fires neither 'ended' nor 'error', so stopping
 * playback removes four of them at a stroke; the duration-based timer was the
 * only survivor, and it was resolving the promise at the moment the clip
 * WOULD have ended.
 *
 * Clearing that timer on stop was right on its own — it was also reporting
 * "Maya stopped speaking" long after she had been silenced, re-arming effects
 * gated on that. But it removed the last resolver, so pausing while Maya read
 * the sentence left the trial suspended forever: no mic, no prompt, nothing on
 * screen to explain it. Worse than the bug it was part of fixing.
 *
 * This test is the reason that can't come back. It is deliberately written
 * against the promise's OBSERVABLE behaviour, not its internals, because the
 * defect was invisible to every test that checked what stop() clears.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const audioElement = {
  volume: 1,
  playbackRate: 1,
  duration: NaN,
  currentTime: 0,
  src: '',
  onended: null as null | (() => void),
  onerror: null as null | (() => void),
  onloadedmetadata: null as null | (() => void),
  pause: vi.fn(),
  play: vi.fn(() => Promise.resolve()),
};

vi.mock('@/lib/audioUnlock', () => ({
  getUnlockedAudioElement: (url: string) => {
    audioElement.src = url;
    return audioElement as unknown as HTMLAudioElement;
  },
  unlockAudio: vi.fn(),
  isAudioUnlocked: () => true,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } },
}));

import { renderHook } from '@testing-library/react';
import { useTextToSpeech, stopGlobalTTS } from '@/hooks/useTextToSpeech';

beforeEach(() => {
  audioElement.pause.mockClear();
  audioElement.play.mockClear();
  audioElement.duration = NaN;
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    headers: { get: () => 'audio/mpeg' },
    blob: async () => new Blob(['x'], { type: 'audio/mpeg' }),
  })));
  // jsdom ships neither of these.
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => 'blob:stub';
  (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Resolve the microtask/timer queue enough for the fetch chain to land. */
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe('stopping speech mid-utterance', () => {
  it('settles the promise the game is awaiting', async () => {
    const { result } = renderHook(() => useTextToSpeech());

    let done = false;
    const spoken = result.current.speak('the boy walked to the store').then(() => { done = true; });
    await flush();

    // Playback is under way and nothing has resolved it yet.
    expect(audioElement.play).toHaveBeenCalled();
    expect(done).toBe(false);

    // The pause button's stopper. 'ended' and 'error' do NOT fire on pause,
    // which is the whole point — the promise must settle anyway.
    stopGlobalTTS();
    await flush();

    expect(audioElement.pause).toHaveBeenCalled();
    expect(done).toBe(true);
    await spoken;
  });

  it('does not settle twice when the element later fires ended', async () => {
    const { result } = renderHook(() => useTextToSpeech());
    const settlements = vi.fn();
    void result.current.speak('a second sentence').then(settlements);
    await flush();

    stopGlobalTTS();
    await flush();
    expect(settlements).toHaveBeenCalledTimes(1);

    // A late 'ended' from the shared element must be a no-op, not a second
    // teardown that clobbers whatever utterance is playing by then.
    audioElement.onended?.();
    await flush();
    expect(settlements).toHaveBeenCalledTimes(1);
  });
});
