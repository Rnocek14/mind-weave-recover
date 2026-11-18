import { afterEach, describe, expect, it } from 'vitest';
import { voiceController } from './voiceController';

afterEach(() => {
  voiceController.setSessionPaused(false);
  voiceController.setReorienting(false);
  voiceController.notifySpeakingChanged(false);
});

describe('mic safety during pause reorientation', () => {
  it('keeps the microphone locked even after the paused flag clears', () => {
    voiceController.setSessionPaused(true);
    voiceController.setReorienting(true);
    voiceController.setSessionPaused(false);
    expect(voiceController.isSessionPaused).toBe(false);
    expect(voiceController.isMicLocked).toBe(true);
  });

  it('does not notify a listening game to resume until orientation is complete', () => {
    const events: boolean[] = [];
    const unsubscribe = voiceController.subscribeSessionPaused((paused) => events.push(paused));
    try {
      voiceController.setSessionPaused(true);
      voiceController.setReorienting(true);
      voiceController.setSessionPaused(false);
      expect(events).toEqual([true]);
      expect(voiceController.isMicLocked).toBe(true);
      voiceController.setReorienting(false);
      expect(events).toEqual([true, false]);
    } finally {
      unsubscribe();
    }
  });

  it('cancels a deferred resume if another pause begins', () => {
    const events: boolean[] = [];
    const unsubscribe = voiceController.subscribeSessionPaused((paused) => events.push(paused));
    try {
      voiceController.setSessionPaused(true);
      voiceController.setReorienting(true);
      voiceController.setSessionPaused(false);
      voiceController.setSessionPaused(true);
      voiceController.setReorienting(false);
      expect(events).toEqual([true, true]);
    } finally {
      unsubscribe();
    }
  });

  it('does not allow awaitMicSafe to time out while reorienting', async () => {
    voiceController.setReorienting(true);
    let resolved = false;
    const pending = voiceController.awaitMicSafe(1).then(() => { resolved = true; });
    await new Promise((r) => setTimeout(r, 150));
    expect(resolved).toBe(false);
    voiceController.setReorienting(false);
    await pending;
    expect(resolved).toBe(true);
  });
});
