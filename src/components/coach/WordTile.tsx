/**
 * WordTile - Tappable word choice button
 * 
 * Used in the Assistive Panel to show word options.
 * Animates on appear, has subtle hover effects, and
 * tracks usage to fade recently-used words.
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface WordTileProps {
  word: string;
  onSelect: (word: string) => void;
  isUsed?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'primed' | 'suggestion';
  className?: string;
}

export function WordTile({
  word,
  onSelect,
  isUsed = false,
  size = 'md',
  variant = 'default',
  className,
}: WordTileProps) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-5 py-2.5 text-lg',
  };

  const variantClasses = {
    default: 'bg-primary/10 text-primary hover:bg-primary/20 border-primary/20',
    primed: 'bg-success/10 text-success hover:bg-success/20 border-success/20',
    suggestion: 'bg-muted text-muted-foreground hover:bg-muted/80 border-muted-foreground/20',
  };

  return (
    <button
      type="button"
      onClick={() => onSelect(word)}
      disabled={isUsed}
      className={cn(
        'rounded-full font-medium border transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2',
        'active:scale-95 hover:scale-105',
        'animate-fade-in',
        sizeClasses[size],
        variantClasses[variant],
        isUsed && 'opacity-40 cursor-not-allowed hover:scale-100',
        className
      )}
    >
      {word}
    </button>
  );
}

interface WordTileGroupProps {
  words: string[];
  onSelect: (word: string) => void;
  usedWords?: string[];
  variant?: 'default' | 'primed' | 'suggestion';
  size?: 'sm' | 'md' | 'lg';
  maxDisplay?: number;
  className?: string;
}

export function WordTileGroup({
  words,
  onSelect,
  usedWords = [],
  variant = 'default',
  size = 'md',
  maxDisplay = 6,
  className,
}: WordTileGroupProps) {
  const displayWords = words.slice(0, maxDisplay);
  
  return (
    <div className={cn('flex flex-wrap gap-2 justify-center', className)}>
      {displayWords.map((word, index) => (
        <WordTile
          key={`${word}-${index}`}
          word={word}
          onSelect={onSelect}
          isUsed={usedWords.includes(word.toLowerCase())}
          variant={variant}
          size={size}
        />
      ))}
    </div>
  );
}
