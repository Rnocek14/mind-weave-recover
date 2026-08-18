/**
 * useVoiceGuidance — connects the voice guidance registry + TTS + coaching mode.
 * 
 * All methods are no-ops when mode !== 'full'.
 * Uses audioManager for global interruption control: only one TTS plays at a time,
 * and user actions can stop speech instantly.
 */

import { useCallback, useRef } from 'react';
import { useCoachingMode } from '@/contexts/CoachingModeContext';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { getVoiceGuidance, resolveVoiceIntro, VoiceGuidance } from '@/lib/voiceGuidanceMap';

export function useVoiceGuidance(exerciseSlug?: string) {
  const { isVoiceLed, shouldAutoSpeak, shouldAutoReadContent } = useCoachingMode();
  const { speak, stop, isSpeaking, isLoading } = useTextToSpeech();
  const speakingRef = useRef(false);

  const guidance: VoiceGuidance | null = exerciseSlug ? getVoiceGuidance(exerciseSlug) : null;

  /** Stop any current speech immediately — call on phase change, user action, etc. */
  const interrupt = useCallback(() => {
    stop();
    speakingRef.current = false;
  }, [stop]);

  /** Speak text only if in Full Coaching mode. Returns promise that resolves when done. */
  const speakIfVoiceLed = useCallback(async (text: string): Promise<void> => {
    if (!isVoiceLed) return;
    interrupt(); // Stop any previous speech
    speakingRef.current = true;
    try {
      await speak(text);
    } finally {
      speakingRef.current = false;
    }
  }, [isVoiceLed, speak, interrupt]);

  /** Speak the exercise intro — supports dynamic context */
  const speakIntro = useCallback(async (context?: Record<string, string>): Promise<void> => {
    if (!shouldAutoSpeak || !guidance) return;
    const text = resolveVoiceIntro(guidance, context);
    if (!text) return;
    return speakIfVoiceLed(text);
  }, [shouldAutoSpeak, guidance, speakIfVoiceLed]);

  /** Speak the exercise task instruction */
  const speakTask = useCallback(async (): Promise<void> => {
    if (!shouldAutoSpeak || !guidance) return;
    return speakIfVoiceLed(guidance.voiceTask);
  }, [shouldAutoSpeak, guidance, speakIfVoiceLed]);

  /** Speak the stall reminder — rotates through alternates when defined. */
  const reminderIndexRef = useRef(0);
  const speakReminder = useCallback(async (): Promise<void> => {
    if (!shouldAutoSpeak || !guidance?.voiceReminder) return;
    const lines = [guidance.voiceReminder, ...(guidance.voiceReminderAlts ?? [])];
    const line = lines[reminderIndexRef.current % lines.length];
    reminderIndexRef.current += 1;
    return speakIfVoiceLed(line);
  }, [shouldAutoSpeak, guidance, speakIfVoiceLed]);

  /** Auto-read arbitrary text (for stories, questions). Only in Full Coaching. */
  const autoReadText = useCallback(async (text: string): Promise<void> => {
    if (!shouldAutoReadContent) return;
    return speakIfVoiceLed(text);
  }, [shouldAutoReadContent, speakIfVoiceLed]);

  return {
    speakIntro,
    speakTask,
    speakReminder,
    autoReadText,
    speakIfVoiceLed,
    interrupt,
    isSpeaking: isSpeaking || isLoading,
    isVoiceLed,
    shouldAutoSpeak,
    shouldAutoReadContent,
    guidance,
  };
}
