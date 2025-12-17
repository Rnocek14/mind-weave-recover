/**
 * Global audio manager to prevent multiple audio playbacks from overlapping.
 * Only one audio can play at a time - starting a new one stops the previous.
 * Uses event-based subscription (no polling) for state sync.
 */

let currentAudio: HTMLAudioElement | null = null;
let currentKey: string | null = null;
let currentHandlers: { ended: () => void; error: () => void } | null = null;

// Subscription system for state changes (no polling needed)
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());

export const audioManager = {
  /**
   * Play audio from a URL. Stops any currently playing audio first.
   * @param url - The audio URL to play
   * @param key - Unique identifier for this audio (e.g., storagePath)
   * @returns The audio element
   */
  play: async (url: string, key: string): Promise<HTMLAudioElement> => {
    // Stop any currently playing audio
    audioManager.stop();

    const audio = new Audio(url);
    currentAudio = audio;
    currentKey = key;

    // Create handlers we can remove later
    // Note: We only listen for 'ended' and 'error' as terminal events.
    // 'pause' is NOT treated as terminal - user may pause/resume, or platform may pause.
    const handlers = {
      ended: () => {
        if (currentAudio === audio) {
          currentAudio = null;
          currentKey = null;
          currentHandlers = null;
          notify();
        }
      },
      error: () => {
        if (currentAudio === audio) {
          currentAudio = null;
          currentKey = null;
          currentHandlers = null;
          notify();
        }
      }
    };

    audio.addEventListener('ended', handlers.ended);
    audio.addEventListener('error', handlers.error);
    currentHandlers = handlers;

    notify();
    await audio.play();
    return audio;
  },

  /**
   * Stop the currently playing audio and clean up listeners
   */
  stop: () => {
    if (currentAudio && currentHandlers) {
      currentAudio.removeEventListener('ended', currentHandlers.ended);
      currentAudio.removeEventListener('error', currentHandlers.error);
      currentAudio.pause();
    }
    currentAudio = null;
    currentKey = null;
    currentHandlers = null;
    notify();
  },

  /**
   * Get the key of the currently playing audio
   */
  getCurrentKey: (): string | null => currentKey,

  /**
   * Check if a specific key is currently playing
   */
  isPlayingKey: (key: string): boolean => currentKey === key && currentAudio !== null && !currentAudio.paused,

  /**
   * Subscribe to state changes. Returns unsubscribe function.
   */
  subscribe: (fn: () => void): (() => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
};
