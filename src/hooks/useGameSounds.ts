import { useRef, useCallback } from 'react';

export const useGameSounds = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize audio context lazily
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Play a tone with specific frequency and duration
  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine') => {
    try {
      const audioContext = getAudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = type;
      oscillator.frequency.value = frequency;

      // Envelope for smoother sound
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }, [getAudioContext]);

  // Success sound - ascending cheerful tones
  const playSuccess = useCallback(() => {
    playTone(523.25, 0.1, 'sine'); // C5
    setTimeout(() => playTone(659.25, 0.15, 'sine'), 50); // E5
    setTimeout(() => playTone(783.99, 0.2, 'sine'), 100); // G5
  }, [playTone]);

  // Error sound - descending sad tone
  const playError = useCallback(() => {
    playTone(392, 0.15, 'square'); // G4
    setTimeout(() => playTone(329.63, 0.3, 'square'), 100); // E4
  }, [playTone]);

  // Level up sound - triumphant ascending sequence
  const playLevelUp = useCallback(() => {
    playTone(523.25, 0.1, 'sine'); // C5
    setTimeout(() => playTone(659.25, 0.1, 'sine'), 80); // E5
    setTimeout(() => playTone(783.99, 0.1, 'sine'), 160); // G5
    setTimeout(() => playTone(1046.50, 0.3, 'sine'), 240); // C6
  }, [playTone]);

  // Level down sound - gentle descending
  const playLevelDown = useCallback(() => {
    playTone(523.25, 0.15, 'sine'); // C5
    setTimeout(() => playTone(440, 0.2, 'sine'), 100); // A4
  }, [playTone]);

  // Streak sound - quick ascending beeps
  const playStreak = useCallback(() => {
    playTone(880, 0.08, 'square'); // A5
    setTimeout(() => playTone(1046.50, 0.08, 'square'), 60); // C6
    setTimeout(() => playTone(1318.51, 0.12, 'square'), 120); // E6
  }, [playTone]);

  // Timeout/miss sound - low warning tone
  const playTimeout = useCallback(() => {
    playTone(220, 0.2, 'sawtooth'); // A3
    setTimeout(() => playTone(185, 0.3, 'sawtooth'), 150); // F#3
  }, [playTone]);

  // Hint sound - gentle notification
  const playHint = useCallback(() => {
    playTone(440, 0.1, 'sine'); // A4
    setTimeout(() => playTone(554.37, 0.15, 'sine'), 80); // C#5
  }, [playTone]);

  return {
    playSuccess,
    playError,
    playLevelUp,
    playLevelDown,
    playStreak,
    playTimeout,
    playHint,
  };
};
