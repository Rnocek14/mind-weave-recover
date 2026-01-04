/**
 * Shared UI components for in-chat exercise cards
 * 
 * Provides consistent, accessible, beautiful components for all card types.
 */

import React from 'react';
import { Volume2, VolumeX, Check, Lightbulb, Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================================================
// Card Container - Unified wrapper for all cards
// ============================================================================

interface CardContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContainer({ children, className }: CardContainerProps) {
  return (
    <div className={cn(
      "rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-card to-accent/5",
      "shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-300",
      className
    )}>
      {children}
    </div>
  );
}

// ============================================================================
// Speech Status Bar - Animated listening indicator with word count
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
    <div className="flex items-center justify-center gap-3 py-2">
      {/* Animated waveform dots */}
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-3 bg-primary rounded-full animate-[pulse_1s_ease-in-out_infinite]" />
        <span className="w-1.5 h-4 bg-primary rounded-full animate-[pulse_1s_ease-in-out_0.15s_infinite]" />
        <span className="w-1.5 h-2.5 bg-primary rounded-full animate-[pulse_1s_ease-in-out_0.3s_infinite]" />
        <span className="w-1.5 h-3.5 bg-primary rounded-full animate-[pulse_1s_ease-in-out_0.45s_infinite]" />
      </div>
      
      <span className="text-sm text-muted-foreground">
        {showWordCount && wordCount > 0 
          ? `${wordCount} word${wordCount === 1 ? '' : 's'}...`
          : message
        }
      </span>
    </div>
  );
}

// ============================================================================
// Audio Button - "Hear it" TTS button with 44px touch target
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
  variant = 'outline'
}: AudioButtonProps) {
  const sizeClasses = {
    sm: 'h-10 px-3 text-sm',
    md: 'h-12 px-4',
    lg: 'h-14 px-6 text-lg',
  };

  return (
    <Button
      variant={variant}
      onClick={onPlay}
      disabled={isPlaying || isLoading}
      className={cn(
        "min-w-[44px] gap-2 transition-all",
        sizeClasses[size],
        isPlaying && "bg-primary/10"
      )}
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : isPlaying ? (
        <VolumeX className="w-5 h-5" />
      ) : (
        <Volume2 className="w-5 h-5" />
      )}
      {label && <span>{label}</span>}
    </Button>
  );
}

// ============================================================================
// Success Animation - Celebratory completion indicator
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
    <div className="flex flex-col items-center gap-2 py-4 animate-in zoom-in-95 fade-in duration-300">
      <div className="relative">
        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
          <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
        {/* Subtle sparkle effect */}
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping opacity-75" />
      </div>
      <span className="text-lg font-medium text-green-600 dark:text-green-400">
        {message}
      </span>
      {subMessage && (
        <span className="text-sm text-muted-foreground">{subMessage}</span>
      )}
    </div>
  );
}

// ============================================================================
// Hint Chip - Cue/hint display with icon
// ============================================================================

interface HintChipProps {
  hint: string;
  type?: 'semantic' | 'phonemic' | 'general';
  className?: string;
}

export function HintChip({ hint, type = 'general', className }: HintChipProps) {
  const typeStyles = {
    semantic: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
    phonemic: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
    general: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  };

  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-4 py-2 rounded-full border",
      "animate-in slide-in-from-bottom-2 fade-in duration-300",
      typeStyles[type],
      className
    )}>
      <Lightbulb className="w-4 h-4" />
      <span className="text-sm font-medium">{hint}</span>
    </div>
  );
}

// ============================================================================
// Progress Timer - Non-alarming elapsed time indicator
// ============================================================================

interface ProgressTimerProps {
  startTime: number;
  maxTime?: number; // seconds
  showEncouragement?: boolean;
}

export function ProgressTimer({ 
  startTime, 
  maxTime = 30, 
  showEncouragement = true 
}: ProgressTimerProps) {
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const progress = Math.min(elapsed / maxTime, 1);
  const showMessage = showEncouragement && progress > 0.5;

  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Clock className="w-4 h-4" />
      {showMessage ? (
        <span className="text-xs">Take your time, no rush</span>
      ) : (
        <span className="text-xs">{elapsed}s</span>
      )}
    </div>
  );
}

// ============================================================================
// Transcript Display - Styled live transcript area
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
  minHeight = "min-h-[56px]",
  className 
}: TranscriptDisplayProps) {
  return (
    <div className={cn(
      "text-lg font-medium text-center max-w-xs mx-auto px-2",
      minHeight,
      transcript ? "text-foreground" : "text-muted-foreground/50",
      className
    )}>
      {transcript || placeholder}
    </div>
  );
}

// ============================================================================
// Large Touch Button - Accessible 44px+ touch target button
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
    success: 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600',
    outline: 'border-2 border-primary/30 bg-transparent hover:bg-primary/10',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-h-[48px] min-w-[44px] px-6 py-3 rounded-xl font-medium",
        "flex items-center justify-center gap-2",
        "transition-all duration-200 active:scale-95",
        "disabled:opacity-50 disabled:cursor-not-allowed",
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
// Choice Button Grid - For fallback word choices
// ============================================================================

interface ChoiceButtonGridProps {
  choices: string[];
  onSelect: (choice: string) => void;
  columns?: 2 | 3;
}

export function ChoiceButtonGrid({ choices, onSelect, columns = 3 }: ChoiceButtonGridProps) {
  return (
    <div className={cn(
      "grid gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300",
      columns === 2 ? "grid-cols-2" : "grid-cols-3"
    )}>
      {choices.map((choice, i) => (
        <Button
          key={i}
          variant="outline"
          onClick={() => onSelect(choice)}
          className="min-h-[48px] text-base font-medium capitalize"
        >
          {choice}
        </Button>
      ))}
    </div>
  );
}

// ============================================================================
// Skip Button - For skipping personal/uncomfortable questions
// ============================================================================

interface SkipButtonProps {
  onSkip: () => void;
  label?: string;
}

export function SkipButton({ onSkip, label = "Skip this one" }: SkipButtonProps) {
  return (
    <button
      onClick={onSkip}
      className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
    >
      {label}
    </button>
  );
}

// ============================================================================
// Feature Icons - Semantic feature category icons for scaffolding
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
        "flex flex-col items-center gap-1 p-3 rounded-xl transition-all",
        "min-w-[60px] min-h-[60px]",
        isActive 
          ? "bg-primary/20 border-2 border-primary" 
          : "bg-muted/50 hover:bg-muted border-2 border-transparent"
      )}
    >
      <span className="text-xl">{config.icon}</span>
      <span className="text-xs font-medium">{config.label}</span>
    </button>
  );
}

// ============================================================================
// Word Count Progress - Visual goal indicator with dots
// ============================================================================

interface WordCountProgressProps {
  current: number;
  goal: number;
  label?: string;
}

export function WordCountProgress({ current, goal, label }: WordCountProgressProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {label && <span>{label}</span>}
      <div className="flex gap-1">
        {Array.from({ length: goal }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full transition-colors",
              i < current ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Sentence Builder - Visual display of starter + continuation
// ============================================================================

interface SentenceBuilderProps {
  starter: string;
  continuation: string;
}

export function SentenceBuilder({ starter, continuation }: SentenceBuilderProps) {
  return (
    <div className="bg-muted/30 rounded-xl p-4 space-y-2">
      <div className="text-sm text-muted-foreground font-medium">
        {starter}
      </div>
      <div className={cn(
        "text-lg font-medium border-l-2 border-primary pl-3",
        continuation ? "text-foreground" : "text-muted-foreground/50"
      )}>
        {continuation || "(continue speaking...)"}
      </div>
    </div>
  );
}
