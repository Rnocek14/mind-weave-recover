/**
 * ScenarioCard — Inline chat card for Maya to suggest real-world scenarios
 * 
 * Appears naturally in the conversation feed. Tapping "Start" opens the ScenarioOverlay.
 * Designed to feel like a chat artifact, not a game launcher.
 */

import React from 'react';
import { Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ScenarioDefinition } from '@/lib/scenarioEngine';
import { cn } from '@/lib/utils';

interface ScenarioCardProps {
  scenario: ScenarioDefinition;
  onStart: (scenarioId: string) => void;
  completed?: boolean;
  score?: number;
}

export function ScenarioCard({ scenario, onStart, completed, score }: ScenarioCardProps) {
  return (
    <div className={cn(
      "rounded-2xl p-4 max-w-[340px] space-y-3",
      "bg-card/80 backdrop-blur-sm border border-border/40",
      "animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
      completed && "opacity-75"
    )}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{scenario.icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground leading-tight">
            {scenario.title}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {scenario.subtitle}
          </p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          ~{scenario.estimatedMinutes} min
        </span>
      </div>

      {/* Action */}
      {completed ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-success">✓</span>
          <span>Completed{score !== undefined ? ` · Readiness: ${score}%` : ''}</span>
        </div>
      ) : (
        <Button
          size="sm"
          className="w-full gap-2 text-sm"
          onClick={() => onStart(scenario.id)}
        >
          Let's practice
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}
