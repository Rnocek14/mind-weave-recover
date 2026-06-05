/**
 * MayaNarrationCard — Full-screen therapist guidance card
 * 
 * Renders between games as part of the continuous therapy canvas.
 * Supports: narration-only, narration+input, narration+action button.
 */

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, ArrowRight, Mic, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useUiProfile } from '@/hooks/useUiProfile';
import { variantClass, isMinimal } from '@/lib/ui/variantClass';

interface MayaNarrationCardProps {
  /** Maya's narration text */
  narration: string;
  /** Secondary text (smaller, below narration) */
  subtitle?: string;
  /** Action button text */
  actionLabel?: string;
  /** Called when user taps continue/action */
  onContinue: () => void;
  /** If true, show text/voice input instead of action button */
  showInput?: boolean;
  /** Input placeholder */
  inputPlaceholder?: string;
  /** Called with user's input text */
  onSubmit?: (text: string) => void;
  /** Current phase index for progress dots */
  phaseIndex?: number;
  /** Total phases */
  totalPhases?: number;
  /** Phase labels for progress */
  phaseLabels?: string[];
  /** Auto-advance delay in ms (0 = no auto-advance) */
  autoAdvanceMs?: number;
  /** Whether to show a loading state */
  isProcessing?: boolean;
  /** Optional emoji/icon to show above narration */
  icon?: string;
}

export function MayaNarrationCard({
  narration,
  subtitle,
  actionLabel = 'Continue',
  onContinue,
  showInput = false,
  inputPlaceholder = 'Type or speak your response...',
  onSubmit,
  phaseIndex,
  totalPhases,
  phaseLabels,
  autoAdvanceMs = 0,
  isProcessing = false,
  icon,
}: MayaNarrationCardProps) {
  const tts = useTextToSpeech();
  const { profile } = useUiProfile();
  const { variant } = profile;
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-advance timer
  React.useEffect(() => {
    if (autoAdvanceMs > 0 && !showInput) {
      autoAdvanceRef.current = setTimeout(onContinue, autoAdvanceMs);
      return () => {
        if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
      };
    }
  }, [autoAdvanceMs, onContinue, showInput]);

  const handleSubmit = () => {
    const text = inputText.trim();
    if (!text) return;
    onSubmit?.(text);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress dots */}
      {totalPhases != null && phaseIndex != null && (
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-1.5 justify-center">
            {Array.from({ length: totalPhases }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === phaseIndex
                    ? 'w-8 bg-primary'
                    : i < phaseIndex
                    ? 'w-4 bg-primary/40'
                    : 'w-4 bg-muted-foreground/20'
                )}
              />
            ))}
          </div>
          {phaseLabels?.[phaseIndex] && !isMinimal(variant) && (
            <p className="text-[10px] text-muted-foreground text-center mt-1.5 uppercase tracking-wider font-medium">
              {phaseLabels[phaseIndex]}
            </p>
          )}
        </div>
      )}

      {/* Main content — centered */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className={variantClass(variant, {
          base: 'w-full max-w-sm space-y-6',
          simplified: 'max-w-md space-y-8',
        })}>
          {/* Maya avatar + name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">M</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Maya</p>
              {/* Role sub-label dropped in minimal to reduce reading load */}
              {!isMinimal(variant) && (
                <p className="text-[10px] text-muted-foreground">Speech Therapist</p>
              )}
            </div>
            <button
              onClick={() => tts.speak(narration)}
              className="ml-auto p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Listen"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>

          {/* Icon */}
          {icon && (
            <div className="text-center">
              <span className="text-4xl">{icon}</span>
            </div>
          )}

          {/* Narration */}
          <div className="space-y-3">
            <p className={variantClass(variant, {
              base: 'text-lg leading-relaxed text-foreground',
              simplified: 'text-2xl leading-relaxed',
            })}>
              {narration}
            </p>
            {subtitle && (
              <p className={variantClass(variant, {
                base: 'text-sm text-muted-foreground leading-relaxed',
                simplified: 'text-lg',
              })}>
                {subtitle}
              </p>
            )}
          </div>

          {/* Input or Action */}
          {showInput ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={inputPlaceholder}
                  disabled={isProcessing}
                  className={variantClass(variant, {
                    base: 'flex-1 h-12 rounded-xl border bg-muted/50 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50',
                    simplified: 'h-16 text-lg',
                  })}
                />
                <Button
                  size="icon"
                  aria-label="Submit response"
                  onClick={handleSubmit}
                  disabled={!inputText.trim() || isProcessing}
                  className={variantClass(variant, {
                    base: 'h-12 w-12 rounded-xl shrink-0',
                    simplified: 'h-16 w-16',
                  })}
                >
                  <Send className={variantClass(variant, { base: 'w-4 h-4', simplified: 'w-6 h-6' })} />
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="lg"
              onClick={onContinue}
              disabled={isProcessing}
              className={variantClass(variant, {
                base: 'w-full gap-2 h-12',
                simplified: 'h-16 text-lg',
              })}
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              ) : (
                <>
                  {actionLabel}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
