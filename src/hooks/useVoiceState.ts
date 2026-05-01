/**
 * useVoiceState — reactive subscription to the global VoiceController.
 *
 * Use in any game that needs to gate UI / mic on Maya speaking, even if
 * that game does not own the TTS instance that's playing.
 */

import { useEffect, useState } from 'react';
import { voiceController } from '@/lib/voiceController';

export function useVoiceState() {
  const [isSpeaking, setIsSpeaking] = useState(voiceController.isSpeaking);
  useEffect(() => voiceController.subscribe(setIsSpeaking), []);
  return {
    isSpeaking,
    /** True while speaking OR in 400ms post-speech tail lock. */
    isMicLocked: voiceController.isMicLocked,
    awaitMicSafe: voiceController.awaitMicSafe.bind(voiceController),
    recordSpoken: voiceController.recordSpoken.bind(voiceController),
    getRecentSpoken: voiceController.getRecentSpoken.bind(voiceController),
  };
}
