/**
 * InlineMinimalPairMessage — Two images side-by-side in the conversation
 * 
 * NOT a card. NOT a mode switch. Maya says a word, two images appear
 * inline, and the user taps the matching one. Stays in chat flow.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

interface InlineMinimalPairMessageProps {
  image1Url: string;
  image2Url: string;
  word1: string;
  word2: string;
  /** Which image the user should tap (0 or 1) */
  targetIndex: 0 | 1;
  /** Whether this challenge has been answered */
  answered: boolean;
  /** Which image the user selected (null = not yet) */
  selectedIndex: number | null;
  /** Whether the answer was correct */
  wasCorrect: boolean | null;
  /** Callback when user taps an image */
  onSelect?: (index: 0 | 1) => void;
}

export function InlineMinimalPairMessage({
  image1Url,
  image2Url,
  word1,
  word2,
  targetIndex,
  answered,
  selectedIndex,
  wasCorrect,
  onSelect,
}: InlineMinimalPairMessageProps) {
  return (
    <div className="flex items-start gap-4 animate-fade-in">
      {/* Maya avatar space (matches AI message alignment) */}
      <div className="w-12 flex-shrink-0" />

      {/* Two images side-by-side — calm, simple, tappable */}
      <div className="flex gap-3 max-w-[320px]">
        {[0, 1].map((idx) => {
          const imgUrl = idx === 0 ? image1Url : image2Url;
          const word = idx === 0 ? word1 : word2;
          const isSelected = selectedIndex === idx;
          const isTarget = targetIndex === idx;

          return (
            <button
              key={idx}
              onClick={() => !answered && onSelect?.(idx as 0 | 1)}
              disabled={answered}
              className={cn(
                "relative rounded-2xl overflow-hidden border-2 transition-all duration-200 flex-1",
                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                !answered && "hover:scale-[1.03] hover:border-primary/40 cursor-pointer border-border/50",
                answered && isTarget && "border-green-500 ring-2 ring-green-500/20",
                answered && isSelected && !isTarget && "border-destructive ring-2 ring-destructive/20",
                answered && !isSelected && !isTarget && "border-border/30 opacity-50",
              )}
            >
              <img
                src={imgUrl}
                alt={`Option ${idx + 1}`}
                className="w-full aspect-square object-cover"
                draggable={false}
              />

              {/* Feedback overlay */}
              {answered && (
                <div className={cn(
                  "absolute inset-0 flex items-center justify-center",
                  isTarget ? "bg-green-500/15" : isSelected ? "bg-destructive/15" : "bg-background/30"
                )}>
                  {isTarget && (
                    <div className="bg-green-500 text-white rounded-full p-2">
                      <Check className="w-5 h-5" />
                    </div>
                  )}
                  {isSelected && !isTarget && (
                    <div className="bg-destructive text-white rounded-full p-2">
                      <X className="w-5 h-5" />
                    </div>
                  )}
                </div>
              )}

              {/* Word label after answering */}
              {answered && (
                <div className={cn(
                  "absolute bottom-0 left-0 right-0 py-1.5 px-2 text-center text-sm font-medium",
                  isTarget ? "bg-green-500 text-white" : "bg-muted text-foreground"
                )}>
                  {word}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
