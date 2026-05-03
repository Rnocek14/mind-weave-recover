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
  private listeners = new Set<Listener>();
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

  /** True if speaking OR within the post-speech tail lock. */
  get isMicLocked(): boolean {
    return this._isSpeaking || Date.now() < this._tailLockUntil;
  }

  /**
   * Resolves once the mic is safe to open.
   * Polls every 80ms; bails out after `timeoutMs` so games never hang forever.
   */
  async awaitMicSafe(timeoutMs = 8000): Promise<boolean> {
    const start = Date.now();
    while (this.isMicLocked) {
      if (Date.now() - start > timeoutMs) {
        console.warn('[VoiceController] awaitMicSafe timed out — opening mic anyway');
        return false;
      }
      await new Promise((r) => setTimeout(r, 80));
    }
    return true;
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
