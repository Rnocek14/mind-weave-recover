/**
 * VoiceInputBar — Voice-enabled input for Smart Coach sessions
 * 
 * Level 3 voice: speak with safety rails
 * - Tap mic → speak → see transcript preview → Send / Edit / Retry
 * - Low-confidence fallback shows choice chips
 * - Always has text input as fallback
 * - All interactions tracked via voiceInteractionTelemetry
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Pencil, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { trackVoiceEvent } from '@/lib/voiceInteractionTelemetry';

type VoiceState = 'idle' | 'listening' | 'preview' | 'error';

interface VoiceInputBarProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Topic keywords for fallback chips */
  topicKeywords?: string[];
  /** Whether Maya TTS auto-play is on */
  autoPlayVoice?: boolean;
  onToggleAutoPlay?: () => void;
  /** Current turn number for telemetry */
  turnNumber?: number;
}

export function VoiceInputBar({
  onSend,
  disabled = false,
  placeholder = 'Type your response...',
  topicKeywords = [],
  autoPlayVoice = false,
  onToggleAutoPlay,
  turnNumber,
}: VoiceInputBarProps) {
  const [inputText, setInputText] = useState('');
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [showFallbackChips, setShowFallbackChips] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const noResultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      if (noResultTimeoutRef.current) clearTimeout(noResultTimeoutRef.current);
    };
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported || disabled) return;

    trackVoiceEvent('mic_start', { turnNumber });

    setSpeechError(null);
    setShowFallbackChips(false);
    setVoiceTranscript('');
    setInterimTranscript('');

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      setVoiceState('listening');
      // If no result after 8s, show fallback
      noResultTimeoutRef.current = setTimeout(() => {
        if (voiceState === 'listening') {
          try { recognition.stop(); } catch {}
          trackVoiceEvent('mic_no_speech', { turnNumber });
          setSpeechError("I didn't catch that.");
          setShowFallbackChips(true);
          setVoiceState('error');
        }
      }, 8000);
    };

    recognition.onresult = (event: any) => {
      if (noResultTimeoutRef.current) {
        clearTimeout(noResultTimeoutRef.current);
        noResultTimeoutRef.current = null;
      }

      const results = event.results;
      const lastResult = results[results.length - 1];
      
      if (lastResult.isFinal) {
        const transcript = lastResult[0].transcript.trim();
        const confidence = lastResult[0].confidence;
        
        if (confidence < 0.3 || transcript.length === 0) {
          trackVoiceEvent('mic_low_confidence', { 
            confidence, 
            wordCount: transcript.split(/\s+/).filter(Boolean).length,
            turnNumber,
          });
          setSpeechError("I didn't quite catch that.");
          setShowFallbackChips(true);
          setVoiceState('error');
          if (transcript) setVoiceTranscript(transcript);
        } else {
          trackVoiceEvent('mic_success', { 
            confidence, 
            wordCount: transcript.split(/\s+/).filter(Boolean).length,
            turnNumber,
          });
          setVoiceTranscript(transcript);
          setInterimTranscript('');
          setVoiceState('preview');
        }
      } else {
        setInterimTranscript(lastResult[0].transcript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      if (noResultTimeoutRef.current) {
        clearTimeout(noResultTimeoutRef.current);
        noResultTimeoutRef.current = null;
      }

      if (event.error === 'no-speech') {
        trackVoiceEvent('mic_no_speech', { turnNumber });
        setSpeechError("I didn't hear anything.");
        setShowFallbackChips(true);
        setVoiceState('error');
      } else if (event.error === 'not-allowed') {
        trackVoiceEvent('mic_error', { turnNumber });
        setSpeechError('Microphone access needed.');
        setVoiceState('idle');
      } else if (event.error !== 'aborted') {
        trackVoiceEvent('mic_error', { turnNumber });
        setSpeechError('Something went wrong. Try again or type.');
        setVoiceState('error');
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (noResultTimeoutRef.current) {
        clearTimeout(noResultTimeoutRef.current);
        noResultTimeoutRef.current = null;
      }
      setVoiceState(prev => prev === 'listening' ? 'error' : prev);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setSpeechError('Could not start microphone.');
      setVoiceState('idle');
    }
  }, [isSupported, disabled, turnNumber]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    if (noResultTimeoutRef.current) {
      clearTimeout(noResultTimeoutRef.current);
      noResultTimeoutRef.current = null;
    }
    trackVoiceEvent('mic_cancelled', { turnNumber });
    setVoiceState('idle');
    setInterimTranscript('');
  }, [turnNumber]);

  const handleSendVoice = useCallback(() => {
    if (voiceTranscript.trim()) {
      trackVoiceEvent('preview_accepted', { 
        wordCount: voiceTranscript.trim().split(/\s+/).length,
        turnNumber,
      });
      onSend(voiceTranscript.trim());
      setVoiceTranscript('');
      setVoiceState('idle');
      setShowFallbackChips(false);
    }
  }, [voiceTranscript, onSend, turnNumber]);

  const handleEditVoice = useCallback(() => {
    trackVoiceEvent('preview_edited', { turnNumber });
    setInputText(voiceTranscript);
    setVoiceTranscript('');
    setVoiceState('idle');
    setShowFallbackChips(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [voiceTranscript, turnNumber]);

  const handleRetry = useCallback(() => {
    trackVoiceEvent('preview_retried', { turnNumber });
    setShowFallbackChips(false);
    setSpeechError(null);
    startListening();
  }, [startListening, turnNumber]);

  const handleSendText = useCallback(() => {
    if (inputText.trim()) {
      trackVoiceEvent('text_sent', { 
        wordCount: inputText.trim().split(/\s+/).length,
        turnNumber,
      });
      onSend(inputText.trim());
      setInputText('');
    }
  }, [inputText, onSend, turnNumber]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleChipSelect = useCallback((chip: string) => {
    trackVoiceEvent('fallback_chip_used', { turnNumber });
    onSend(chip);
    setShowFallbackChips(false);
    setSpeechError(null);
    setVoiceState('idle');
  }, [onSend, turnNumber]);

  const handleToggleAutoPlay = useCallback(() => {
    trackVoiceEvent('tts_auto_toggled', { turnNumber });
    onToggleAutoPlay?.();
  }, [onToggleAutoPlay, turnNumber]);

  // Generate contextual fallback chips from topic keywords
  const fallbackChips = topicKeywords.slice(0, 4);

  // ─── Listening state ───────────────────────────────────────
  if (voiceState === 'listening') {
    return (
      <div className="p-3 border-t shrink-0">
        <div className="max-w-2xl mx-auto space-y-2">
          <div className="flex items-center justify-center gap-3">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center animate-pulse">
                <Mic className="w-6 h-6 text-destructive" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-destructive/30 animate-ping" />
            </div>
          </div>
          {interimTranscript ? (
            <p className="text-center text-sm text-foreground font-medium">
              {interimTranscript}
            </p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Listening — take your time
            </p>
          )}
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={stopListening} className="gap-1.5 text-xs">
              <MicOff className="w-3.5 h-3.5" />
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Preview state ─────────────────────────────────────────
  if (voiceState === 'preview') {
    return (
      <div className="p-3 border-t shrink-0">
        <div className="max-w-2xl mx-auto space-y-2">
          <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
            <p className="text-sm font-medium">"{voiceTranscript}"</p>
          </div>
          <div className="flex gap-2 justify-center">
            <Button size="sm" onClick={handleSendVoice} className="gap-1.5">
              <Send className="w-3.5 h-3.5" />
              Send
            </Button>
            <Button variant="outline" size="sm" onClick={handleEditVoice} className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={handleRetry} className="gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error / fallback state ────────────────────────────────
  if (voiceState === 'error' || showFallbackChips) {
    return (
      <div className="p-3 border-t shrink-0">
        <div className="max-w-2xl mx-auto space-y-3">
          {speechError && (
            <p className="text-center text-sm text-muted-foreground">{speechError}</p>
          )}
          
          {showFallbackChips && fallbackChips.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {fallbackChips.map(chip => (
                <Button
                  key={chip}
                  variant="outline"
                  size="sm"
                  onClick={() => handleChipSelect(chip)}
                  className="text-xs capitalize"
                >
                  {chip}
                </Button>
              ))}
            </div>
          )}
          
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={handleRetry} className="gap-1.5">
              <Mic className="w-3.5 h-3.5" />
              Try again
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              trackVoiceEvent('fallback_type_used', { turnNumber });
              setVoiceState('idle');
              setShowFallbackChips(false);
              setSpeechError(null);
              setTimeout(() => inputRef.current?.focus(), 100);
            }} className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" />
              Type instead
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Default idle state ────────────────────────────────────
  return (
    <div className="p-3 border-t shrink-0">
      <div className="flex gap-2 max-w-2xl mx-auto items-center">
        {/* Auto-play voice toggle — subtle, doesn't compete with primary actions */}
        {onToggleAutoPlay && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleAutoPlay}
            aria-label={autoPlayVoice ? 'Turn voice off' : 'Turn voice on'}
            className={cn(
              'shrink-0 h-9 w-9',
              autoPlayVoice ? 'text-primary' : 'text-muted-foreground/50'
            )}
            title={autoPlayVoice ? 'Voice on' : 'Voice off'}
          >
            {autoPlayVoice ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
        )}
        
        <Input
          ref={inputRef}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1"
          autoComplete="off"
        />
        
        {/* Mic button — primary voice action */}
        {isSupported && (
          <Button
            variant="outline"
            size="icon"
            onClick={startListening}
            disabled={disabled}
            aria-label="Speak your response"
            className="shrink-0 h-9 w-9"
            title="Speak your response"
          >
            <Mic className="w-4 h-4" />
          </Button>
        )}
        
        {/* Send button */}
        <Button
          size="icon"
          onClick={handleSendText}
          disabled={!inputText.trim() || disabled}
          aria-label="Send response"
          className="shrink-0 h-9 w-9"
        >
          <Send className="w-4 h-4" />
        </Button>
        </Button>
      </div>
    </div>
  );
}
