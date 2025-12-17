/**
 * Global audio manager to prevent multiple audio playbacks from overlapping.
 * Only one audio can play at a time - starting a new one stops the previous.
 */

let currentAudio: HTMLAudioElement | null = null;
let currentStopCallback: (() => void) | null = null;

export const audioManager = {
  /**
   * Play audio from a URL. Stops any currently playing audio first.
   * @param url - The audio URL to play
   * @param onStop - Callback when playback stops (ended, paused, or replaced)
   * @returns The audio element
   */
  play: async (url: string, onStop?: () => void): Promise<HTMLAudioElement> => {
    // Stop any currently playing audio
    audioManager.stop();

    const audio = new Audio(url);
    currentAudio = audio;
    currentStopCallback = onStop || null;

    const handleStop = () => {
      if (currentAudio === audio) {
        currentAudio = null;
        if (currentStopCallback) {
          currentStopCallback();
          currentStopCallback = null;
        }
      }
    };

    audio.addEventListener('ended', handleStop);
    audio.addEventListener('pause', handleStop);
    audio.addEventListener('error', handleStop);

    await audio.play();
    return audio;
  },

  /**
   * Stop the currently playing audio
   */
  stop: () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if (currentStopCallback) {
      currentStopCallback();
      currentStopCallback = null;
    }
  },

  /**
   * Check if a specific audio element is currently playing
   */
  isPlaying: (audio: HTMLAudioElement | null): boolean => {
    return audio !== null && currentAudio === audio && !audio.paused;
  },

  /**
   * Get the currently playing audio element (if any)
   */
  getCurrent: (): HTMLAudioElement | null => currentAudio
};
