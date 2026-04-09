/**
 * MayaSessionFrame — Full-screen Maya intro/transition overlay for session framing.
 * 
 * Used for:
 * 1. Session intro (before first exercise)
 * 2. Between-exercise transitions with Maya's clinical bridging text
 * 
 * Auto-advances after a delay, with tap-to-skip.
 */

import { useState, useEffect, useRef } from 'react';
import { MessageCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MayaSessionFrameProps {
  text: string;
  /** "intro" shows a session header; "transition" is lighter */
  type: 'intro' | 'transition';
  sessionTheme?: string;
  /** Auto-advance delay in seconds (default 5 for intro, 4 for transition) */
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
  const defaultDuration = type === 'intro' ? 6 : 4;
  const totalDuration = duration ?? defaultDuration;
  const [timeLeft, setTimeLeft] = useState(totalDuration);
  const startRef = useRef(Date.now());

  useEffect(() => {
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
  }, [onContinue]);

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

        {/* Auto-advance bar */}
        <div className="w-24 mx-auto bg-muted rounded-full h-1 overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${((totalDuration - timeLeft) / totalDuration) * 100}%` }}
          />
        </div>

        {/* Skip button */}
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={onContinue}
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}
