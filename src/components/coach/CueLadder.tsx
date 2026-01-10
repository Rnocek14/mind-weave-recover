/**
 * CueLadder - Progressive cue support buttons
 * 
 * Shows escalating levels of support:
 * 1. Think (encouragement)
 * 2. Category hint
 * 3. Semantic hint
 * 4. First sound
 * 5. Show word
 * 
 * Each level reveals more information to help word retrieval.
 */

import React from 'react';
import { Lightbulb, HelpCircle, Volume2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface CueLevel {
  level: number;
  name: string;
  icon: React.ReactNode;
  description: string;
}

const CUE_LEVELS: CueLevel[] = [
  { level: 1, name: 'Hint', icon: <Lightbulb className="w-4 h-4" />, description: 'Category hint' },
  { level: 2, name: 'Sound', icon: <Volume2 className="w-4 h-4" />, description: 'First sound' },
  { level: 3, name: 'Show', icon: <Eye className="w-4 h-4" />, description: 'Show word' },
];

interface CueLadderProps {
  currentLevel: number;
  onRequestCue: (level: number) => void;
  cueText?: string;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}

export function CueLadder({
  currentLevel,
  onRequestCue,
  cueText,
  disabled = false,
  compact = false,
  className,
}: CueLadderProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Cue text display */}
      {cueText && (
        <div className="px-4 py-2 bg-primary/10 rounded-xl text-center animate-fade-in">
          <p className="text-sm text-primary font-medium">{cueText}</p>
        </div>
      )}
      
      {/* Cue buttons */}
      <div className={cn(
        'flex gap-2',
        compact ? 'justify-center' : 'justify-between'
      )}>
        {CUE_LEVELS.map((cue) => {
          const isAvailable = cue.level > currentLevel;
          const isActive = cue.level === currentLevel + 1;
          
          return (
            <Button
              key={cue.level}
              variant={isActive ? 'default' : 'outline'}
              size={compact ? 'sm' : 'default'}
              onClick={() => onRequestCue(cue.level)}
              disabled={disabled || !isAvailable}
              className={cn(
                'flex-1 gap-2 transition-all',
                isActive && 'ring-2 ring-primary/30',
                !isAvailable && 'opacity-50'
              )}
            >
              {cue.icon}
              {!compact && <span>{cue.name}</span>}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

interface SimpleCueButtonProps {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function SimpleCueButton({
  onClick,
  label = 'Need a hint?',
  disabled = false,
  className,
}: SimpleCueButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'gap-2 text-muted-foreground hover:text-primary',
        className
      )}
    >
      <HelpCircle className="w-4 h-4" />
      {label}
    </Button>
  );
}
