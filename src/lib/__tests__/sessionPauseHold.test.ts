/**
 * Pause has to hold, not just interrupt.
 *
 * REPORTED: "when you hit the pause button, it does not pause voice. it goes
 * to pause screen but the voice stays active and keeps going."
 *
 * The first fix called stopAllVoice(), which does silence Maya at the instant
 * of the tap. But it also had to call notifySpeakingChanged(false) — otherwise
 * the mic lock, held by an <audio> element that was paused rather than ended,
 * would never clear on resume. And that signal is precisely what every game is
 * waiting on: awaitMicSafe() resolves, the mic opens behind the overlay, and
 * stall-prompt effects that were gated on `isSpeaking` re-arm and make Maya
 * talk again seconds later.
 *
 * So the correct shape is a HELD STATE the rest of the app can observe, and
 * these tests pin the three things that state has to do.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { voiceController } from '@/lib/voiceController';

afterEach(() => {
  voiceController.setSessionPaused(false);
  voiceController.notifySpeakingChanged(false);
});

describe('a paused session', () => {
  it('keeps the mic locked even when nothing is speaking', () => {
    voiceController.notifySpeakingChanged(false);
    voiceController.setSessionPaused(true);
    expect(voiceController.isMicLocked).toBe(true);
  });

  it('does not let awaitMicSafe time out and open the mic anyway', async () => {
    // The 8s bail exists so a stuck tail lock can't hang a game. A pause is
    // not stuck, and a person can be away for an hour. If the timeout ran
    // during a pause, the mic would open behind the overlay on its own.
    voiceController.setSessionPaused(true);
    const settled = vi.fn();
    void voiceController.awaitMicSafe(100).then(settled);
    await new Promise((r) => setTimeout(r, 400)); // 4x the timeout
    expect(settled).not.toHaveBeenCalled();

    voiceController.setSessionPaused(false);
    await expect(voiceController.awaitMicSafe(1000)).resolves.toBe(true);
  });

  it('releases cleanly on resume', async () => {
    voiceController.setSessionPaused(true);
    expect(voiceController.isMicLocked).toBe(true);
    voiceController.setSessionPaused(false);
    await expect(voiceController.awaitMicSafe(2000)).resolves.toBe(true);
  });
});

describe('stopping every voice channel', () => {
  it('reaches players that own their own audio element', () => {
    // usePhraseAudio builds `new Audio(url)` in a hook-local ref, which
    // stopGlobalTTS has no handle on — on the two exercises that use it, the
    // pause button stopped nothing at all.
    const stopped = vi.fn();
    const unregister = voiceController.registerAudioStopper(stopped);
    voiceController.stopRegisteredAudio();
    expect(stopped).toHaveBeenCalledTimes(1);

    unregister();
    voiceController.stopRegisteredAudio();
    expect(stopped).toHaveBeenCalledTimes(1);
  });

  it('keeps going when one player throws', () => {
    const boom = vi.fn(() => { throw new Error('detached'); });
    const ok = vi.fn();
    const u1 = voiceController.registerAudioStopper(boom);
    const u2 = voiceController.registerAudioStopper(ok);
    expect(() => voiceController.stopRegisteredAudio()).not.toThrow();
    expect(ok).toHaveBeenCalled();
    u1(); u2();
  });
});
