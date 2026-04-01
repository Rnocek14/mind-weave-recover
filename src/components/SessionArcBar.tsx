/**
 * Session Arc Progress Bar
 * 
 * Shows the user where they are in their therapy session:
 * Warm-up → Core → Stretch → Summary
 * 
 * Maps exercise block priorities to arc phases.
 */

import { cn } from "@/lib/utils";
import { humanizeSlug } from "@/lib/performanceAwareFeedback";
import type { ExerciseBlock } from "@/lib/dailyLessonEngine";

interface SessionArcBarProps {
  blocks: ExerciseBlock[];
  currentIndex: number;
  className?: string;
}

type ArcPhase = 'warm-up' | 'core' | 'stretch' | 'summary';

const PHASE_CONFIG: Record<ArcPhase, { label: string; emoji: string }> = {
  'warm-up': { label: 'Warm-up', emoji: '🌱' },
  'core': { label: 'Core', emoji: '🧠' },
  'stretch': { label: 'Stretch', emoji: '🚀' },
  'summary': { label: 'Summary', emoji: '✨' },
};

function blockToPhase(priority: ExerciseBlock['priority']): ArcPhase {
  switch (priority) {
    case 'warmup': return 'warm-up';
    case 'primary': return 'core';
    case 'secondary': return 'stretch';
    case 'consolidation': return 'stretch';
    default: return 'core';
  }
}

export function SessionArcBar({ blocks, currentIndex, className }: SessionArcBarProps) {
  // Derive phases from blocks
  const phases: { phase: ArcPhase; startIndex: number; endIndex: number }[] = [];
  let lastPhase: ArcPhase | null = null;

  blocks.forEach((block, i) => {
    const phase = blockToPhase(block.priority);
    if (phase !== lastPhase) {
      phases.push({ phase, startIndex: i, endIndex: i });
      lastPhase = phase;
    } else {
      phases[phases.length - 1].endIndex = i;
    }
  });

  // If no distinct phases, create a simple core phase
  if (phases.length === 0) {
    phases.push({ phase: 'core', startIndex: 0, endIndex: blocks.length - 1 });
  }

  const isSummary = currentIndex >= blocks.length;

  return (
    <div className={cn("flex items-center gap-1 w-full max-w-sm mx-auto", className)}>
      {phases.map((p, i) => {
        const config = PHASE_CONFIG[p.phase];
        const isActive = !isSummary && currentIndex >= p.startIndex && currentIndex <= p.endIndex;
        const isComplete = isSummary || currentIndex > p.endIndex;

        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            {/* Phase segment */}
            <div
              className={cn(
                "h-1.5 w-full rounded-full transition-all duration-500",
                isComplete
                  ? "bg-primary"
                  : isActive
                  ? "bg-primary/60"
                  : "bg-muted"
              )}
            />
            {/* Label — only show for active or if small number of phases */}
            {(isActive || phases.length <= 3) && (
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors",
                  isActive ? "text-primary" : isComplete ? "text-muted-foreground" : "text-muted-foreground/50"
                )}
              >
                {config.label}
              </span>
            )}
          </div>
        );
      })}
      {/* Summary dot */}
      <div className="flex flex-col items-center gap-1">
        <div
          className={cn(
            "h-1.5 w-8 rounded-full transition-all duration-500",
            isSummary ? "bg-primary" : "bg-muted"
          )}
        />
        {isSummary && (
          <span className="text-[10px] font-medium text-primary">Done</span>
        )}
      </div>
    </div>
  );
}

/** Visible adaptivity message based on recent performance */
export function getAdaptivityMessage(
  recentScores: number[],
  currentPhase: ArcPhase
): string | null {
  if (recentScores.length < 2) return null;

  const avg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
  const lastTwo = recentScores.slice(-2);
  const lastAvg = lastTwo.reduce((a, b) => a + b, 0) / lastTwo.length;

  // Streak of success
  if (lastAvg >= 0.85 && recentScores.length >= 3) {
    return "You're doing great — let's try something a little harder 🚀";
  }

  // Improving
  if (recentScores.length >= 3 && lastAvg > avg + 0.1) {
    return "Getting stronger with each one 📈";
  }

  // Struggling
  if (lastAvg < 0.4) {
    return "Let's slow this down a bit — no rush 💛";
  }

  // Moderate difficulty
  if (lastAvg < 0.6 && currentPhase === 'stretch') {
    return "This one's meant to stretch you — you're doing well";
  }

  return null;
}
