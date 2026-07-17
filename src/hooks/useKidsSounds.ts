import { useCallback, useRef } from 'react';

/**
 * Kids Mode sound set — synthesized with WebAudio like useGameSounds, but
 * tuned for kids: brighter success arpeggios, a soft friendly "boop" for
 * misses (never a harsh buzzer), a sparkle run for streaks, and a fanfare
 * for finishing a session. Only Kids Mode code paths should call these.
 */
export const useKidsSounds = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playTone = useCallback(
    (frequency: number, duration: number, type: OscillatorType = 'triangle', volume = 0.25) => {
      try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = type;
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
      } catch {
        /* audio unavailable — stay silent */
      }
    },
    [getAudioContext],
  );

  /** Correct answer: bright ascending arpeggio with a sparkle on top. */
  const playKidsSuccess = useCallback(() => {
    playTone(523.25, 0.12); // C5
    setTimeout(() => playTone(659.25, 0.12), 70); // E5
    setTimeout(() => playTone(783.99, 0.14), 140); // G5
    setTimeout(() => playTone(1567.98, 0.18, 'sine', 0.15), 210); // G6 sparkle
  }, [playTone]);

  /** Miss: two soft, low-volume sine boops — encouraging, not punishing. */
  const playKidsOops = useCallback(() => {
    playTone(440, 0.12, 'sine', 0.12); // A4
    setTimeout(() => playTone(392, 0.18, 'sine', 0.12), 110); // G4
  }, [playTone]);

  /** Streak (3+ in a row): quick rising sparkle run. */
  const playKidsStreak = useCallback(() => {
    playTone(659.25, 0.08); // E5
    setTimeout(() => playTone(783.99, 0.08), 60); // G5
    setTimeout(() => playTone(1046.5, 0.08), 120); // C6
    setTimeout(() => playTone(1318.51, 0.1), 180); // E6
    setTimeout(() => playTone(1567.98, 0.22, 'sine', 0.18), 240); // G6
  }, [playTone]);

  /** Session complete: little fanfare. */
  const playKidsFanfare = useCallback(() => {
    playTone(523.25, 0.14); // C5
    setTimeout(() => playTone(523.25, 0.1), 150); // C5
    setTimeout(() => playTone(659.25, 0.14), 260); // E5
    setTimeout(() => playTone(783.99, 0.16), 400); // G5
    setTimeout(() => playTone(1046.5, 0.4, 'triangle', 0.3), 560); // C6 hold
  }, [playTone]);

  return { playKidsSuccess, playKidsOops, playKidsStreak, playKidsFanfare };
};
