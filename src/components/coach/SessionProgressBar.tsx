/**
 * SessionProgressBar - Visual phase indicator
 * 
 * Shows progress through session phases:
 * Warmup → Build → Conversation → Wrapup
 * 
 * Helps user understand session structure and see their progress.
 */

import React from 'react';
import { Flame, Brain, MessageCircle, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SessionPhase = 'warmup' | 'build' | 'conversation' | 'wrapup';

interface SessionProgressBarProps {
  currentPhase: SessionPhase;
  warmupProgress?: number; // 0-2 cards completed
  className?: string;
}

const PHASES: { id: SessionPhase; label: string; icon: React.ReactNode }[] = [
  { id: 'warmup', label: 'Warm Up', icon: <Flame className="w-4 h-4" /> },
  { id: 'build', label: 'Build', icon: <Brain className="w-4 h-4" /> },
  { id: 'conversation', label: 'Chat', icon: <MessageCircle className="w-4 h-4" /> },
  { id: 'wrapup', label: 'Done', icon: <Trophy className="w-4 h-4" /> },
];

export function SessionProgressBar({
  currentPhase,
  warmupProgress = 0,
  className,
}: SessionProgressBarProps) {
  const currentIndex = PHASES.findIndex(p => p.id === currentPhase);

  return (
    <div className={cn('w-full', className)}>
      {/* Phase dots */}
      <div className="flex items-center justify-between gap-1">
        {PHASES.map((phase, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFuture = index > currentIndex;
          
          return (
            <React.Fragment key={phase.id}>
              {/* Phase indicator */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300',
                    isComplete && 'bg-success text-success-foreground',
                    isCurrent && 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2',
                    isFuture && 'bg-muted text-muted-foreground'
                  )}
                >
                  {phase.icon}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium transition-colors',
                    isComplete && 'text-success',
                    isCurrent && 'text-primary',
                    isFuture && 'text-muted-foreground'
                  )}
                >
                  {phase.label}
                </span>
              </div>
              
              {/* Connector line */}
              {index < PHASES.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 rounded-full transition-colors duration-300',
                    index < currentIndex ? 'bg-success' : 'bg-muted'
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      
      {/* Warmup progress sub-indicator */}
      {currentPhase === 'warmup' && (
        <div className="flex justify-start mt-2 pl-2">
          <div className="flex gap-1">
            {[0, 1].map((i) => (
              <div
                key={i}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  i < warmupProgress ? 'bg-primary' : 'bg-muted'
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Compact version for header
export function SessionPhaseIndicator({
  currentPhase,
  className,
}: {
  currentPhase: SessionPhase;
  className?: string;
}) {
  const phase = PHASES.find(p => p.id === currentPhase);
  if (!phase) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        currentPhase === 'warmup' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        currentPhase === 'build' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        currentPhase === 'conversation' && 'bg-primary/10 text-primary',
        currentPhase === 'wrapup' && 'bg-success/10 text-success',
        className
      )}
    >
      {phase.icon}
      {phase.label}
    </div>
  );
}
