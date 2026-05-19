/**
 * Audio Unlock — primes the browser AudioContext + speechSynthesis
 * on the first user gesture so TTS works on iOS / mobile Safari across
 * exercise transitions (where there is no fresh user gesture).
 *
 * iOS Safari requires that audio playback (AudioContext.resume() and
 * speechSynthesis.speak()) be initiated from a user gesture at least once
 * per page load. After that, subsequent programmatic plays are allowed.
 *
 * Usage: call `installAudioUnlock()` once near app startup. It auto-removes
 * itself after the first qualifying gesture.
 */

let installed = false;
let unlocked = false;
let sharedAudioElement: HTMLAudioElement | null = null;

const silentMp3 =
  'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjQ1LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//FJAhRWpJVE0SO+ZJyq0aIQS7whbBEcSXmIxc7GtMjFy6krytkemSeAlPI4xLDjF/Hv2lE+Jzfm7/EfnA3//+4xWQ4QyDhV/wHwQDmAAAVqQVRWZ4ipgsXM3Wbeqj3sLMHpfCdLJzMpYpUuMqdNVScRlPpqMQGqQAGOmnXdaERjAYsq2MwTJUcm';

export function isAudioUnlocked(): boolean {
  return unlocked;
}

export function getUnlockedAudioElement(src: string): HTMLAudioElement {
  const audio = sharedAudioElement ?? new Audio();
  sharedAudioElement = audio;
  audio.pause();
  audio.preload = 'auto';
  audio.src = src;
  audio.load();
  return audio;
}

export function installAudioUnlock() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const unlock = () => {
    if (unlocked) return;
    try {
      // 1. Prime AudioContext (HTML5 audio + WebAudio path)
      const Ctor: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (Ctor) {
        const ctx = new Ctor();
        // play a silent buffer
        const buffer = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.start(0);
        // resume if suspended (Safari)
        if (typeof ctx.resume === 'function') {
          ctx.resume().catch(() => {});
        }
      }
    } catch (e) {
      console.warn('[audioUnlock] AudioContext prime failed:', e);
    }

    try {
      // 2. Prime an HTMLAudioElement so subsequent `new Audio(blobUrl).play()`
      // works on iOS Safari / mobile Chrome (which otherwise block playback
      // when the play() call is separated from the user gesture by an await).
      const probe = sharedAudioElement ?? new Audio(silentMp3);
      sharedAudioElement = probe;
      probe.src = silentMp3;
      probe.volume = 0;
      const p = probe.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
      // Pause shortly after so it never makes sound on real devices.
      setTimeout(() => { try { probe.pause(); } catch {} }, 50);
    } catch (e) {
      console.warn('[audioUnlock] HTMLAudio prime failed:', e);
    }

    try {
      // 3. Prime speechSynthesis with a silent utterance
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance('');
        u.volume = 0;
        window.speechSynthesis.speak(u);
      }
    } catch (e) {
      console.warn('[audioUnlock] speechSynthesis prime failed:', e);
    }

    unlocked = true;
    console.log('[audioUnlock] ✅ Audio context primed via user gesture');

    window.removeEventListener('touchend', unlock, true);
    window.removeEventListener('pointerup', unlock, true);
    window.removeEventListener('click', unlock, true);
    window.removeEventListener('mousedown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };

  window.addEventListener('touchend', unlock, true);
  window.addEventListener('pointerup', unlock, true);
  window.addEventListener('click', unlock, true);
  window.addEventListener('mousedown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}
