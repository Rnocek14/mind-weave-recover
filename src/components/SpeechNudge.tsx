/**
 * SpeechNudge — Non-intrusive nudge overlay for speech exercises.
 * 
 * Shows gentle encouragement when the speech state classifier
 * detects the user is struggling or in extended silence.
 * 
 * Rules:
 * - Appears subtly (fade in)
 * - Disappears when user speaks
 * - Never blocks interaction
 * - Max once per 15 seconds (no spam)
 */

import { useState, useEffect, useRef } from 'react';
import { NUDGE_MESSAGES } from '@/lib/speechStateClassifier';
import { cn } from '@/lib/utils';

interface SpeechNudgeProps {
  /** Nudge hint key from the classifier (null = hide) */
  nudgeHint: string | null;
  /** Whether the user is actively speaking (hides nudge) */
  isSpeaking?: boolean;
  className?: string;
}

const COOLDOWN_MS = 15000; // Minimum 15s between nudges

export function SpeechNudge({ nudgeHint, isSpeaking, className }: SpeechNudgeProps) {
  const [visible, setVisible] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const lastShownRef = useRef(0);
  const lastHintRef = useRef<string | null>(null);

  useEffect(() => {
    // Hide if speaking or no hint
    if (isSpeaking || !nudgeHint) {
      setVisible(false);
      return;
    }

    // Don't repeat the same hint too quickly
    const now = Date.now();
    if (nudgeHint === lastHintRef.current && now - lastShownRef.current < COOLDOWN_MS) {
      return;
    }

    const message = NUDGE_MESSAGES[nudgeHint];
    if (!message) return;

    lastHintRef.current = nudgeHint;
    lastShownRef.current = now;
    setDisplayText(message);
    setVisible(true);

    // Auto-hide after 4 seconds
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [nudgeHint, isSpeaking]);

  if (!visible || !displayText) return null;

  return (
    <div
      className={cn(
        'text-sm text-muted-foreground italic animate-in fade-in-0 duration-500',
        'text-center py-1',
        className,
      )}
    >
      {displayText}
    </div>
  );
}
