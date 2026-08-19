/**
 * demoTts — tiny browser-native TTS for the PUBLIC demo page only.
 *
 * The in-app voice (Maya/ElevenLabs) requires an authenticated session and
 * costs money per character. The public try-it page has neither auth nor a
 * budget, so demos speak with the free on-device `speechSynthesis` voice.
 * Deliberately NOT wired into the in-app voice stack — this file must never
 * be imported by clinical game components.
 */

let voicesWarmed = false;

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const en = voices.filter((v) => v.lang.startsWith('en'));
  return (
    en.find((v) => /samantha|karen|zira|aria|google us english/i.test(v.name)) ??
    en.find((v) => v.localService) ??
    en[0] ??
    null
  );
}

export function isDemoTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Speak `text`, cancelling anything already speaking. Resolves on end. */
export function demoSpeak(text: string, rate = 0.9): Promise<void> {
  return new Promise((resolve) => {
    if (!isDemoTtsSupported()) { resolve(); return; }
    try {
      window.speechSynthesis.cancel();
      // Some browsers populate voices lazily; poke once.
      if (!voicesWarmed) {
        window.speechSynthesis.getVoices();
        voicesWarmed = true;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate;
      const voice = pickVoice();
      if (voice) u.voice = voice;
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      u.onend = finish;
      u.onerror = finish;
      // Safety: never leave a caller hanging if events don't fire.
      setTimeout(finish, Math.max(2500, text.length * 90));
      window.speechSynthesis.speak(u);
    } catch {
      resolve();
    }
  });
}

export function demoStopSpeaking(): void {
  if (isDemoTtsSupported()) {
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
  }
}
