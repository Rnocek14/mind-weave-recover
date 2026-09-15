/**
 * VoiceController — global singleton owning Maya's voice state.
 *
 * Wave 1 of the clinical engine hardening pass.
 *
 * Responsibilities:
 *   1. One reactive `isSpeaking` flag visible to every game.
 *   2. A 400ms "tail lock" after TTS ends so the mic never opens while audio
 *      hardware is still bleeding into the recogniser.
 *   3. `awaitMicSafe()` — async helper games call before `startListening()`
 *      to guarantee Sync-Wait protocol, regardless of which TTS code path
 *      (`useTextToSpeech`, browser fallback, edge-stream blob) actually ran.
 *   4. `recordSpoken(text)` — feeds the EchoFilter so it can reject the user
 *      parroting the most recent instructions.
 *
 * NOT responsible for:
 *   - Picking voice / model (still useTextToSpeech)
 *   - Audio playback itself (still useTextToSpeech)
 *
 * The existing `globalAudio` in useTextToSpeech.ts notifies us via
 * `notifySpeakingChanged()` whenever speech starts/stops.
 */

const TAIL_LOCK_MS = 400;
const SPOKEN_HISTORY_MAX = 5;

type Listener = (isSpeaking: boolean) => void;

class VoiceControllerImpl {
  private _isSpeaking = false;
  private _tailLockUntil = 0;
  private _sessionPaused = false;
  private listeners = new Set<Listener>();
  private audioStoppers = new Set<() => void>();
  private spokenHistory: string[] = [];

  /** Called by useTextToSpeech when speech starts or stops. */
  notifySpeakingChanged(isSpeaking: boolean) {
    if (this._isSpeaking === isSpeaking) return;
    this._isSpeaking = isSpeaking;
    if (!isSpeaking) {
      this._tailLockUntil = Date.now() + TAIL_LOCK_MS;
    }
    this.listeners.forEach((l) => {
      try { l(isSpeaking); } catch (e) { console.warn('[VoiceController] listener error', e); }
    });
  }

  /** Subscribe to speaking-state changes. Returns unsubscribe. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get isSpeaking(): boolean {
    return this._isSpeaking;
  }

  /**
   * Hold every voice channel because the person asked for a break.
   *
   * Silencing Maya at the moment of the tap is not enough on its own, and the
   * first version of the pause fix learned that the hard way. Stopping the
   * audio means telling the controller she is no longer speaking — and every
   * game is waiting on exactly that signal to open the mic and re-arm its
   * stall prompts. So the overlay came up, Maya went quiet, and a few seconds
   * later the mic was live behind the overlay and she started talking again.
   * Pause has to be a state the rest of the app can see, not a single action.
   */
  setSessionPaused(paused: boolean) {
    this._sessionPaused = paused;
  }

  get isSessionPaused(): boolean {
    return this._sessionPaused;
  }

  /** True if paused, speaking, OR within the post-speech tail lock. */
  get isMicLocked(): boolean {
    return this._sessionPaused || this._isSpeaking || Date.now() < this._tailLockUntil;
  }

  /**
   * Resolves once the mic is safe to open.
   * Polls every 80ms; bails out after `timeoutMs` so games never hang forever.
   */
  async awaitMicSafe(timeoutMs = 8000): Promise<boolean> {
    let start = Date.now();
    while (this.isMicLocked) {
      if (this._sessionPaused) {
        // The timeout exists so a stuck tail lock can't hang a game forever.
        // A pause is not stuck — it is someone who stepped away, and it can
        // legitimately last an hour. Don't run the clock during it, and never
        // "open the mic anyway" because of it.
        start = Date.now();
        await new Promise((r) => setTimeout(r, 80));
        continue;
      }
      if (Date.now() - start > timeoutMs) {
        console.warn('[VoiceController] awaitMicSafe timed out — opening mic anyway');
        return false;
      }
      await new Promise((r) => setTimeout(r, 80));
    }
    return true;
  }

  /**
   * Register an audio player that lives outside useTextToSpeech's globalAudio.
   *
   * stopGlobalTTS() can only stop the one shared <audio> element that hook
   * owns. usePhraseAudio constructs its own `new Audio(url)` in a hook-local
   * ref, so on /exercise/word-practice and /exercise/conversation-coach
   * "stop all voice" stopped nothing at all and the pause overlay sat there
   * while Maya finished the phrase. Anything that can make sound registers
   * here and "all" means all.
   *
   * Returns an unregister function; call it on unmount.
   */
  registerAudioStopper(stop: () => void): () => void {
    this.audioStoppers.add(stop);
    return () => { this.audioStoppers.delete(stop); };
  }

  /** Stop every registered out-of-band player. Safe to call repeatedly. */
  stopRegisteredAudio() {
    this.audioStoppers.forEach((stop) => {
      try { stop(); } catch (e) { console.warn('[VoiceController] audio stopper error', e); }
    });
  }

  /** Record a line Maya just spoke so EchoFilter can detect parroting. */
  recordSpoken(text: string) {
    if (!text || typeof text !== 'string') return;
    const trimmed = text.trim();
    if (!trimmed) return;
    this.spokenHistory.push(trimmed);
    if (this.spokenHistory.length > SPOKEN_HISTORY_MAX) {
      this.spokenHistory.shift();
    }
  }

  /** Most recent N lines Maya spoke (newest last). */
  getRecentSpoken(n = SPOKEN_HISTORY_MAX): string[] {
    return this.spokenHistory.slice(-n);
  }

  /** Clear spoken history — call on new trial / new exercise. */
  clearSpokenHistory() {
    this.spokenHistory = [];
  }
}

export const voiceController = new VoiceControllerImpl();

/**
 * Hard-stop ALL voice activity:
 *   - aborts any in-flight ElevenLabs fetch + cancels HTML5 audio playback
 *   - cancels any queued browser-synth utterances (defence-in-depth even though
 *     the browser fallback is disabled by default)
 *   - clears Maya's spoken history so EchoFilter starts fresh
 *   - flips voiceController.isSpeaking → false immediately
 *
 * Call this whenever the user transitions between exercises so leftover audio
 * from the previous game can never bleed into the next one.
 */
export const flushVoiceSessionQueue = (reason = 'unknown') => {
  console.log('[voice] flushVoiceSessionQueue:', reason);
  // Lazy import to avoid a circular dependency between voiceController and
  // useTextToSpeech (which imports voiceController at module load).
  import('./voiceControllerStop')
    .then((m) => m.stopAllVoice())
    .catch((e) => console.warn('[voice] flush failed', e));
  voiceController.notifySpeakingChanged(false);
  voiceController.clearSpokenHistory();
};

// Expose for debugging
if (typeof window !== 'undefined') {
  (window as unknown as { __voiceController?: unknown }).__voiceController = voiceController;
  (window as unknown as { __flushVoiceSessionQueue?: unknown }).__flushVoiceSessionQueue =
    flushVoiceSessionQueue;
}
