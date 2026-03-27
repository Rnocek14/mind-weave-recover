/**
 * useSpeechRouter — Unified transcript routing
 * 
 * There is exactly ONE place where "where does this transcript go?" is decided.
 * It reads the authoritative InputMode ref and routes accordingly.
 * 
 * This replaces the scattered if/else branches in ConversationCoachGame.
 */

import { useCallback, useRef, useEffect } from 'react';
import type { InputMode } from './useInputMode';

interface SpeechRouterOptions {
  /** Ref to the current authoritative input mode */
  modeRef: React.RefObject<InputMode>;
  /** Handle transcript in chat mode */
  onChatTranscript: (transcript: string, isFinal: boolean) => void;
  /** Handle transcript in card mode */
  onCardTranscript: (transcript: string, isFinal: boolean) => void;
  /** Handle transcript in popup mode */
  onPopupTranscript: (transcript: string, isFinal: boolean) => void;
}

export interface SpeechRouter {
  /** Route a transcript to the correct handler based on current mode */
  route: (transcript: string, isFinal: boolean) => void;
  /** Route from the useSpeechRecognition onResult callback (always final) */
  routeFinal: (transcript: string) => void;
}

export function useSpeechRouter({
  modeRef,
  onChatTranscript,
  onCardTranscript,
  onPopupTranscript,
}: SpeechRouterOptions): SpeechRouter {
  // Store callbacks in refs to avoid stale closures
  const onChatRef = useRef(onChatTranscript);
  const onCardRef = useRef(onCardTranscript);
  const onPopupRef = useRef(onPopupTranscript);
  
  useEffect(() => { onChatRef.current = onChatTranscript; }, [onChatTranscript]);
  useEffect(() => { onCardRef.current = onCardTranscript; }, [onCardTranscript]);
  useEffect(() => { onPopupRef.current = onPopupTranscript; }, [onPopupTranscript]);

  const route = useCallback((transcript: string, isFinal: boolean) => {
    const currentMode = modeRef.current;

    switch (currentMode) {
      case 'chat_listening':
        onChatRef.current(transcript, isFinal);
        break;

      case 'card_listening':
        onCardRef.current(transcript, isFinal);
        break;

      case 'popup_listening':
        onPopupRef.current(transcript, isFinal);
        break;

      case 'tts_playing':
        // Intentionally drop — user spoke over TTS
        if (isFinal && transcript.trim()) {
          console.log('[SpeechRouter] Dropping transcript during TTS:', transcript.slice(0, 30));
        }
        break;

      case 'processing':
        // Intentionally drop — system is processing
        if (isFinal && transcript.trim()) {
          console.log('[SpeechRouter] Dropping transcript during processing:', transcript.slice(0, 30));
        }
        break;

      case 'idle':
        // Intentionally drop — no active listener
        if (isFinal && transcript.trim()) {
          console.log('[SpeechRouter] Dropping transcript in idle:', transcript.slice(0, 30));
        }
        break;

      default:
        console.warn('[SpeechRouter] Unknown mode:', currentMode);
    }
  }, [modeRef]);

  const routeFinal = useCallback((transcript: string) => {
    route(transcript, true);
  }, [route]);

  return { route, routeFinal };
}
