/**
 * InlinePhotoMessage — A photo that appears as a conversation artifact
 * 
 * NOT a card. NOT a mode switch. Just an image in the chat that Maya
 * asks the user about. The user responds through normal conversation flow.
 * 
 * States:
 * - 'waiting' — Image shown, waiting for user to speak
 * - 'answered' — User gave a response, Maya will handle it
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface InlinePhotoMessageProps {
  imageUrl: string;
  /** Whether this challenge has been answered yet */
  answered: boolean;
  /** The target word (shown only after answering, if revealed) */
  revealedWord?: string;
}

export function InlinePhotoMessage({ imageUrl, answered, revealedWord }: InlinePhotoMessageProps) {
  return (
    <div className="flex items-start gap-4 animate-fade-in">
      {/* Maya avatar space (matches AI message alignment) */}
      <div className="w-12 flex-shrink-0" />
      
      {/* Inline photo — calm, simple, not card-like */}
      <div className={cn(
        "rounded-2xl overflow-hidden shadow-soft border border-border/50 transition-all duration-300",
        "max-w-[240px]",
        answered && "opacity-80"
      )}>
        <img
          src={imageUrl}
          alt="What is this?"
          className="w-full aspect-square object-cover"
          draggable={false}
        />
        {/* Subtle label after reveal */}
        {answered && revealedWord && (
          <div className="bg-card px-3 py-2 text-center border-t border-border/30">
            <span className="text-sm font-medium text-foreground">{revealedWord}</span>
          </div>
        )}
      </div>
    </div>
  );
}
