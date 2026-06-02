/**
 * MayaAssistantBubble — Persistent floating help bubble
 * 
 * Provides quiet support during games. NOT a chat interface.
 * Offers structured help actions with progressive hint ladder.
 * Visual states: idle (breathing), speaking (glow), listening (pulse).
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, RotateCcw, Lightbulb, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUiProfile } from '@/hooks/useUiProfile';
import { variantClass, isMinimal } from '@/lib/ui/variantClass';

interface MayaAssistantBubbleProps {
  /** Whether Maya is currently "speaking" (glow animation) */
  isSpeaking?: boolean;
  /** Whether the bubble is visible */
  visible?: boolean;
  /** Called when user selects a help action */
  onAction?: (action: MayaHelpAction) => void;
  /** Current hint level (0-4) for hint ladder display */
  hintLevel?: number;
  /** Optional last spoken text to show as transcript */
  lastSpokenText?: string;
}

export type MayaHelpAction = 
  | 'repeat_instructions'
  | 'give_hint'
  | 'what_are_we_doing';

const HELP_OPTIONS: { action: MayaHelpAction; label: string; icon: React.ReactNode }[] = [
  { action: 'repeat_instructions', label: 'What do I do?', icon: <RotateCcw className="w-4 h-4" /> },
  { action: 'give_hint', label: 'Give me a hint', icon: <Lightbulb className="w-4 h-4" /> },
  { action: 'what_are_we_doing', label: "Why this exercise?", icon: <Target className="w-4 h-4" /> },
];

const HINT_LEVELS = ['Simpler restatement', 'Gentle cue', 'Stronger hint'];

export function MayaAssistantBubble({
  isSpeaking = false,
  visible = true,
  onAction,
  hintLevel = 0,
  lastSpokenText,
}: MayaAssistantBubbleProps) {
  const { profile } = useUiProfile();
  const { variant } = profile;
  const [isOpen, setIsOpen] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const transcriptTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show transcript briefly when Maya speaks
  useEffect(() => {
    if (lastSpokenText && isSpeaking) {
      setShowTranscript(true);
      if (transcriptTimeout.current) clearTimeout(transcriptTimeout.current);
      transcriptTimeout.current = setTimeout(() => setShowTranscript(false), 4000);
    }
    return () => {
      if (transcriptTimeout.current) clearTimeout(transcriptTimeout.current);
    };
  }, [lastSpokenText, isSpeaking]);

  if (!visible) return null;

  const handleAction = (action: MayaHelpAction) => {
    onAction?.(action);
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Transcript bubble (shown briefly when speaking) */}
      {showTranscript && lastSpokenText && !isOpen && (
        <div className={variantClass(variant, {
          base: 'bg-card border rounded-xl shadow-md p-3 w-60 animate-in fade-in slide-in-from-bottom-2 duration-200',
          simplified: 'w-72 p-4',
        })}>
          <p className={variantClass(variant, {
            base: 'text-xs text-muted-foreground leading-relaxed line-clamp-3',
            simplified: 'text-base text-foreground/80',
          })}>
            {lastSpokenText}
          </p>
        </div>
      )}

      {/* Help panel */}
      {isOpen && (
        <div className={variantClass(variant, {
          base: 'bg-card border rounded-2xl shadow-lg p-3 w-60 animate-in fade-in slide-in-from-bottom-2 duration-200',
          simplified: 'w-72 p-4',
        })}>
          <div className="flex items-center justify-between mb-2">
            <p className={variantClass(variant, {
              base: 'text-xs font-semibold text-foreground',
              simplified: 'text-sm',
            })}>Maya can help</p>
            <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {HELP_OPTIONS.map((opt) => (
              <button
                key={opt.action}
                onClick={() => handleAction(opt.action)}
                className={variantClass(variant, {
                  base: 'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors text-left',
                  simplified: 'gap-3 px-4 py-3.5 text-base',
                })}
              >
                <span className="text-muted-foreground shrink-0">{opt.icon}</span>
                <div className="min-w-0">
                  <span className="block">{opt.label}</span>
                  {opt.action === 'give_hint' && hintLevel > 0 && (
                    <span className="block text-[10px] text-muted-foreground mt-0.5">
                      {Math.min(hintLevel + 1, 3)}/3 — {HINT_LEVELS[Math.min(hintLevel, 2)]}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bubble with visual states */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          variantClass(variant, {
            base: 'w-12 h-12',
            simplified: 'w-16 h-16',
          }),
          'rounded-full flex items-center justify-center transition-all duration-300 shadow-lg relative',
          'bg-primary text-primary-foreground',
          isSpeaking && 'ring-4 ring-primary/30',
          isOpen && 'ring-2 ring-primary/50'
        )}
        title="Ask Maya for help"
      >
        {isOpen ? (
          <X className={variantClass(variant, { base: 'w-5 h-5', simplified: 'w-7 h-7' })} />
        ) : (
          <span className={variantClass(variant, { base: 'text-sm font-bold', simplified: 'text-lg font-bold' })}>M</span>
        )}

        {/* Speaking indicator dots — suppressed in minimal to cut visual load (glow ring remains) */}
        {isSpeaking && !isOpen && !isMinimal(variant) && (
          <div className="absolute -top-1 -right-1 flex gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </button>
    </div>
  );
}
