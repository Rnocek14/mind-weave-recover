/**
 * SentenceFrame - Tappable sentence template
 * 
 * Shows sentence starters like "I had ___." that users can tap
 * to fill in. Helps structure responses for users who struggle
 * with open-ended prompts.
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface SentenceFrameProps {
  frame: string;
  onSelect: (frame: string) => void;
  isActive?: boolean;
  className?: string;
}

export function SentenceFrame({
  frame,
  onSelect,
  isActive = false,
  className,
}: SentenceFrameProps) {
  // Split frame to highlight the blank
  const parts = frame.split('___');
  
  return (
    <button
      type="button"
      onClick={() => onSelect(frame)}
      className={cn(
        'px-4 py-2.5 rounded-xl text-left transition-all duration-200',
        'bg-muted/50 hover:bg-muted border border-border/50',
        'focus:outline-none focus:ring-2 focus:ring-primary/50',
        'active:scale-98 hover:border-primary/30',
        isActive && 'border-primary bg-primary/5',
        className
      )}
    >
      <span className="text-base">
        {parts[0]}
        <span className="inline-block min-w-[3rem] border-b-2 border-dashed border-primary/50 mx-1" />
        {parts[1] || ''}
      </span>
    </button>
  );
}

interface SentenceFrameGroupProps {
  frames: string[];
  onSelect: (frame: string) => void;
  activeFrame?: string;
  className?: string;
}

export function SentenceFrameGroup({
  frames,
  onSelect,
  activeFrame,
  className,
}: SentenceFrameGroupProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {frames.map((frame, index) => (
        <SentenceFrame
          key={`${frame}-${index}`}
          frame={frame}
          onSelect={onSelect}
          isActive={activeFrame === frame}
        />
      ))}
    </div>
  );
}
