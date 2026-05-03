/**
 * Tiny shim to break the circular dependency between voiceController.ts and
 * useTextToSpeech.ts. flushVoiceSessionQueue() lazy-imports this module so
 * the heavy hook code is not pulled into voiceController's import graph.
 */
import { stopGlobalTTS } from '@/hooks/useTextToSpeech';

export const stopAllVoice = () => {
  try { stopGlobalTTS(); } catch (e) { console.warn('[voice] stopGlobalTTS error', e); }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch {}
  }
};
