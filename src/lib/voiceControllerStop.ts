/**
 * Tiny shim to break the circular dependency between voiceController.ts and
 * useTextToSpeech.ts. flushVoiceSessionQueue() lazy-imports this module so
 * the heavy hook code is not pulled into voiceController's import graph.
 */
import { stopGlobalTTS } from '@/hooks/useTextToSpeech';
import { voiceController } from '@/lib/voiceController';

export const stopAllVoice = () => {
  try { stopGlobalTTS(); } catch (e) { console.warn('[voice] stopGlobalTTS error', e); }
  // stopGlobalTTS only reaches useTextToSpeech's shared <audio> element.
  // Players that build their own (usePhraseAudio) register with the
  // controller; without this line "stop all voice" silently missed them.
  try { voiceController.stopRegisteredAudio(); } catch (e) { console.warn('[voice] registered audio stop error', e); }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch {}
  }
};
