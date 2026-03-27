/**
 * useInputMode — Single source of truth for "who owns the microphone right now"
 * 
 * Replaces the fragmented combination of:
 *   currentPhase, conversationState, isCardActiveRef, isCardListeningRef,
 *   hasPendingCard, exerciseModal.isOpen, isProcessingRef
 * 
 * with ONE authoritative mode that determines transcript routing.
 */

import { useState, useRef, useCallback } from 'react';

export type InputMode = 
  | 'idle'           // No one owns mic — waiting for user action or session start
  | 'chat_listening' // Conversation pipeline owns mic — speech-end detection active
  | 'card_listening' // Card pipeline owns mic — transcript goes to card only
  | 'popup_listening'// Popup exercise owns mic
  | 'tts_playing'    // TTS is speaking — mic input is ignored/buffered
  | 'processing';    // AI is thinking — no new turns should start

export interface InputModeController {
  /** Current mode (React state — triggers re-renders for UI) */
  mode: InputMode;
  /** Current mode (ref — for synchronous checks in callbacks, always current) */
  modeRef: React.RefObject<InputMode>;
  /** Atomically transition to a new mode */
  setMode: (newMode: InputMode) => void;
  /** Check if a specific mode is active (uses ref for accuracy) */
  isMode: (checkMode: InputMode) => boolean;
  /** Convenience: is the mic in any "listening" mode? */
  isAnyListening: () => boolean;
}

export function useInputMode(initialMode: InputMode = 'idle'): InputModeController {
  const [mode, setModeState] = useState<InputMode>(initialMode);
  const modeRef = useRef<InputMode>(initialMode);

  const setMode = useCallback((newMode: InputMode) => {
    const prev = modeRef.current;
    // Atomic: ref updates synchronously, state triggers re-render
    modeRef.current = newMode;
    setModeState(newMode);
    
    // Always log mode transitions for debugging
    console.log(`[InputMode] ${prev} → ${newMode}`);
  }, []);

  const isMode = useCallback((checkMode: InputMode) => {
    return modeRef.current === checkMode;
  }, []);

  const isAnyListening = useCallback(() => {
    const m = modeRef.current;
    return m === 'chat_listening' || m === 'card_listening' || m === 'popup_listening';
  }, []);

  return {
    mode,
    modeRef: modeRef as React.RefObject<InputMode>,
    setMode,
    isMode,
    isAnyListening,
  };
}
