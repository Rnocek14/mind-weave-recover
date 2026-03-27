/**
 * Shared UI primitives for "invisible" in-chat exercises.
 * 
 * Design principle: these should feel like natural conversation moments,
 * not separate game screens. Minimal chrome, instant clarity, zero friction.
 */

import React from 'react';
import { Volume2, VolumeX, Check, Lightbulb, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Conversation Bubble — exercises live inside a message-shaped container
// ============================================================================

interface CardContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContainer({ children, className }: CardContainerProps) {
  return (
    <div className={cn(
      "rounded-2xl bg-card/80 backdrop-blur-sm",
      "shadow-[var(--shadow-soft)] border border-border/40",
      "animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
      className
    )}>
      {children}
    </div>
  );
}

// ============================================================================
// Speech Status Bar — subtle listening indicator
// ============================================================================

interface SpeechStatusBarProps {
  isListening: boolean;
  wordCount: number;
  showWordCount?: boolean;
  encouragingMessage?: string;
}

const ENCOURAGING_MESSAGES = [
  "Take your time...",
  "I'm listening...",
  "No rush...",
  "You're doing great...",
];

export function SpeechStatusBar({ 
  isListening, 
  wordCount, 
  showWordCount = true,
  encouragingMessage 
}: SpeechStatusBarProps) {
  const [messageIndex] = React.useState(() => 
    Math.floor(Math.random() * ENCOURAGING_MESSAGES.length)
  );
  
  const message = encouragingMessage || ENCOURAGING_MESSAGES[messageIndex];

  if (!isListening) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-1.5">
      <div className="flex items-center gap-0.5">
        <span className="w-1 h-2.5 bg-primary/60 rounded-full animate-[pulse_1s_ease-in-out_infinite]" />
        <span className="w-1 h-3.5 bg-primary/60 rounded-full animate-[pulse_1s_ease-in-out_0.15s_infinite]" />
        <span className="w-1 h-2 bg-primary/60 rounded-full animate-[pulse_1s_ease-in-out_0.3s_infinite]" />
      </div>
      <span className="text-xs text-muted-foreground">
        {showWordCount && wordCount > 0 
          ? `${wordCount} word${wordCount === 1 ? '' : 's'}`
          : message
        }
      </span>
    </div>
  );
}

// ============================================================================
// Audio Button — minimal "hear it" icon
// ============================================================================

interface AudioButtonProps {
  onPlay: () => void;
  isPlaying?: boolean;
  isLoading?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'outline';
}

export function AudioButton({ 
  onPlay, 
  isPlaying = false, 
  isLoading = false,
  label = "Hear it",
  size = 'md',
  variant = 'ghost'
}: AudioButtonProps) {
  const sizeClasses = {
    sm: 'w-9 h-9',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const iconSize = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <button
      onClick={onPlay}
      disabled={isPlaying || isLoading}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full",
        "text-primary hover:bg-primary/10 active:scale-95",
        "transition-all duration-200 disabled:opacity-40",
        sizeClasses[size],
        label && "px-3 w-auto",
      )}
    >
      {isLoading ? (
        <Loader2 className={cn(iconSize[size], "animate-spin")} />
      ) : isPlaying ? (
        <VolumeX className={iconSize[size]} />
      ) : (
        <Volume2 className={iconSize[size]} />
      )}
      {label && <span className="text-sm font-medium">{label}</span>}
    </button>
  );
}

// ============================================================================
// Success Moment — brief, warm confirmation (not a celebration screen)
// ============================================================================

interface SuccessAnimationProps {
  message?: string;
  subMessage?: string;
}

export function SuccessAnimation({ 
  message = "Got it!", 
  subMessage 
}: SuccessAnimationProps) {
  return (
    <div className="flex items-center gap-2.5 py-2 animate-in fade-in duration-200">
      <div className="w-8 h-8 rounded-full bg-[hsl(var(--success)/0.15)] flex items-center justify-center flex-shrink-0">
        <Check className="w-4 h-4 text-[hsl(var(--success))]" />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-[hsl(var(--success))]">
          {message}
        </span>
        {subMessage && (
          <span className="text-xs text-muted-foreground">{subMessage}</span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Hint Chip — subtle inline cue
// ============================================================================

interface HintChipProps {
  hint: string;
  type?: 'semantic' | 'phonemic' | 'general';
  className?: string;
}

export function HintChip({ hint, type = 'general', className }: HintChipProps) {
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full",
      "bg-muted/60 text-muted-foreground text-xs",
      "animate-in fade-in slide-in-from-bottom-1 duration-200",
      className
    )}>
      <Lightbulb className="w-3 h-3" />
      <span>{hint}</span>
    </div>
  );
}

// ============================================================================
// Transcript Display — what the user is saying
// ============================================================================

interface TranscriptDisplayProps {
  transcript: string;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

export function TranscriptDisplay({ 
  transcript, 
  placeholder = "...",
  minHeight = "min-h-[28px]",
  className 
}: TranscriptDisplayProps) {
  return (
    <div className={cn(
      "text-sm text-center px-2",
      minHeight,
      transcript ? "text-foreground font-medium" : "text-muted-foreground/40",
      className
    )}>
      {transcript || placeholder}
    </div>
  );
}

// ============================================================================
// Large Touch Button — accessible 48px+ tap target
// ============================================================================

interface LargeTouchButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'outline';
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export function LargeTouchButton({ 
  onClick, 
  children, 
  variant = 'primary',
  disabled = false,
  className,
  icon
}: LargeTouchButtonProps) {
  const variantStyles = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    success: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] hover:bg-[hsl(var(--success)/0.9)]',
    outline: 'border border-border bg-transparent hover:bg-muted/50 text-foreground',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-h-[48px] min-w-[48px] px-5 py-2.5 rounded-xl font-medium text-sm",
        "flex items-center justify-center gap-2",
        "transition-all duration-150 active:scale-[0.97]",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        variantStyles[variant],
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// ============================================================================
// Choice Buttons — for word selection fallback
// ============================================================================

interface ChoiceButtonGridProps {
  choices: string[];
  onSelect: (choice: string) => void;
  columns?: 2 | 3;
}

export function ChoiceButtonGrid({ choices, onSelect, columns = 3 }: ChoiceButtonGridProps) {
  return (
    <div className={cn(
      "grid gap-2 animate-in fade-in duration-200",
      columns === 2 ? "grid-cols-2" : "grid-cols-3"
    )}>
      {choices.map((choice, i) => (
        <button
          key={i}
          onClick={() => onSelect(choice)}
          className={cn(
            "min-h-[48px] px-3 py-2 rounded-xl text-sm font-medium capitalize",
            "bg-muted/50 hover:bg-muted border border-border/50",
            "text-foreground transition-all duration-150 active:scale-[0.97]"
          )}
        >
          {choice}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Skip Link — unobtrusive skip option
// ============================================================================

interface SkipButtonProps {
  onSkip: () => void;
  label?: string;
}

export function SkipButton({ onSkip, label = "Skip" }: SkipButtonProps) {
  return (
    <button
      onClick={onSkip}
      className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
    >
      {label}
    </button>
  );
}

// ============================================================================
// Feature Icons — semantic scaffolding
// ============================================================================

interface FeatureIconProps {
  type: 'location' | 'use' | 'appearance' | 'category';
  onClick?: () => void;
  isActive?: boolean;
}

export function FeatureIcon({ type, onClick, isActive }: FeatureIconProps) {
  const configs = {
    location: { icon: '📍', label: 'Where', prompt: 'Where do you find it?' },
    use: { icon: '🔧', label: 'Use', prompt: 'What do you do with it?' },
    appearance: { icon: '🎨', label: 'Look', prompt: 'What does it look like?' },
    category: { icon: '📦', label: 'Type', prompt: 'What kind of thing is it?' },
  };

  const config = configs[type];

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all",
        "min-w-[52px] min-h-[52px]",
        isActive 
          ? "bg-primary/15 border border-primary/30" 
          : "bg-muted/30 hover:bg-muted/60 border border-transparent"
      )}
    >
      <span className="text-lg">{config.icon}</span>
      <span className="text-[10px] font-medium text-muted-foreground">{config.label}</span>
    </button>
  );
}

// ============================================================================
// Word Count Progress
// ============================================================================

interface WordCountProgressProps {
  current: number;
  goal: number;
  label?: string;
}

export function WordCountProgress({ current, goal, label }: WordCountProgressProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {label && <span>{label}</span>}
      <div className="flex gap-0.5">
        {Array.from({ length: goal }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-1.5 h-1.5 rounded-full transition-colors",
              i < current ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Sentence Builder
// ============================================================================

interface SentenceBuilderProps {
  starter: string;
  continuation: string;
}

export function SentenceBuilder({ starter, continuation }: SentenceBuilderProps) {
  return (
    <div className="bg-muted/20 rounded-xl p-3 space-y-1">
      <div className="text-xs text-muted-foreground">
        {starter}
      </div>
      <div className={cn(
        "text-sm font-medium border-l-2 border-primary/40 pl-2.5",
        continuation ? "text-foreground" : "text-muted-foreground/40"
      )}>
        {continuation || "(continue speaking...)"}
      </div>
    </div>
  );
}
