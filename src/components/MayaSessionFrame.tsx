/**
 * MayaSessionFrame — Full-screen Maya intro/transition overlay for session framing.
 * 
 * Used for:
 * 1. Session intro (before first exercise)
 * 2. Between-exercise transitions with Maya's clinical bridging text
 * 
 * Full Coaching mode: auto-speaks the text via TTS.
 * Auto-advances after speech ends (or after timer if not voice-led).
 * Tap-to-skip always available.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, ArrowRight, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCoachingMode } from '@/contexts/CoachingModeContext';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';

interface MayaSessionFrameProps {
  text: string;
  /** "intro" shows a session header; "transition" is lighter */
  type: 'intro' | 'transition';
  sessionTheme?: string;
  /** Auto-advance delay in seconds (default 6 for intro, 4 for transition) */
  duration?: number;
  onContinue: () => void;
}

export function MayaSessionFrame({ 
  text, 
  type, 
  sessionTheme, 
  duration,
  onContinue 
}: MayaSessionFrameProps) {
  const { isVoiceLed } = useCoachingMode();
  const { speak, stop, isSpeaking, isLoading } = useTextToSpeech();
  
  // Timing: voice-led waits for TTS + 1s pause; non-voice uses timer
  const defaultDuration = type === 'intro' ? 6 : 4;
  const totalDuration = duration ?? defaultDuration;
  const [timeLeft, setTimeLeft] = useState(totalDuration);
  const [speechDone, setSpeechDone] = useState(false);
  const [speechStarted, setSpeechStarted] = useState(false);
  const hasSpokenRef = useRef(false);
  const mountedRef = useRef(true);

  // Cleanup on unmount — stop any active speech
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stop();
    };
  }, [stop]);

  // Auto-speak in Full Coaching mode
  useEffect(() => {
    if (!isVoiceLed || hasSpokenRef.current) return;
    hasSpokenRef.current = true;

    const doSpeak = async () => {
      await speak(text);
      if (mountedRef.current) {
        setSpeechDone(true);
      }
    };
    doSpeak();
  }, [isVoiceLed, text, speak]);

  // Timer-based auto-advance (non-voice mode)
  useEffect(() => {
    if (isVoiceLed) return; // Voice mode uses speech completion instead
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onContinue();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onContinue, isVoiceLed]);

  // Voice mode: auto-advance ~1s after speech finishes
  useEffect(() => {
    if (!isVoiceLed || !speechDone) return;
    const postSpeechDelay = type === 'intro' ? 1000 : 750;
    const timer = setTimeout(() => {
      if (mountedRef.current) onContinue();
    }, postSpeechDelay);
    return () => clearTimeout(timer);
  }, [isVoiceLed, speechDone, onContinue, type]);

  const handleContinue = useCallback(() => {
    stop(); // Interrupt any active speech immediately
    onContinue();
  }, [stop, onContinue]);

  const handleRepeat = useCallback(() => {
    stop();
    setSpeechDone(false);
    hasSpokenRef.current = false;
    // Re-trigger speech
    const doSpeak = async () => {
      await speak(text);
      if (mountedRef.current) setSpeechDone(true);
    };
    doSpeak();
  }, [stop, speak, text]);

  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8 animate-in fade-in duration-500">
        {/* Maya avatar */}
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <MessageCircle className="w-8 h-8 text-primary" />
        </div>

        {/* Session theme label (intro only) */}
        {type === 'intro' && sessionTheme && (
          <p className="text-xs font-medium tracking-widest uppercase text-primary/60">
            {sessionTheme}
          </p>
        )}

        {/* Maya's text */}
        <p className="text-lg leading-relaxed text-foreground">
          {text}
        </p>

        {/* Speaking indicator or auto-advance bar */}
        {isVoiceLed ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            {isSpeaking && (
              <>
                <Volume2 className="w-4 h-4 animate-pulse" />
                <span>Maya is speaking...</span>
              </>
            )}
          </div>
        ) : (
          <div className="w-24 mx-auto bg-muted rounded-full h-1 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-1000 ease-linear"
              style={{ width: `${((totalDuration - timeLeft) / totalDuration) * 100}%` }}
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3">
          {isVoiceLed && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={handleRepeat}
            >
              <Volume2 className="w-4 h-4 mr-1.5" />
              Repeat
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={handleContinue}
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
