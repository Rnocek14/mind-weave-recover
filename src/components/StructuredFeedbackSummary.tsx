/**
 * StructuredFeedbackSummary — Reusable post-exercise feedback component.
 * 
 * Replaces generic stats-only summaries with clinically meaningful feedback:
 * - What was strong
 * - What needs work
 * - Next step
 * - Optional Maya reflection + real-life connection
 * 
 * Part of the system foundation (Phase 1).
 */

import React from 'react';
import { CheckCircle, AlertTriangle, Target, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StructuredFeedbackSummaryProps {
  strengths: string[];
  weaknesses: string[];
  nextStep: string;
  mayaReflection?: string;
  realLifeLine?: string;
  className?: string;
}

export function StructuredFeedbackSummary({
  strengths,
  weaknesses,
  nextStep,
  mayaReflection,
  realLifeLine,
  className = '',
}: StructuredFeedbackSummaryProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Strengths */}
      {strengths.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <CheckCircle className="h-4 w-4" />
              What went well
            </div>
            <ul className="text-sm text-foreground/80 space-y-0.5">
              {strengths.map((s, i) => (
                <li key={i}>• {s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Weaknesses */}
      {weaknesses.length > 0 && (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="pt-4 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-accent-foreground/70">
              <AlertTriangle className="h-4 w-4" />
              To work on
            </div>
            <ul className="text-sm text-foreground/80 space-y-0.5">
              {weaknesses.map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Next step */}
      <Card className="border-border/50">
        <CardContent className="pt-4 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground/70">
            <Target className="h-4 w-4" />
            Next step
          </div>
          <p className="text-sm text-foreground/80">{nextStep}</p>
        </CardContent>
      </Card>

      {/* Maya reflection */}
      {mayaReflection && (
        <Card className="border-primary/10 bg-primary/[0.03]">
          <CardContent className="pt-4 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-primary/80">
              <MessageCircle className="h-4 w-4" />
              Maya
            </div>
            <p className="text-sm text-foreground/70 italic">{mayaReflection}</p>
            {realLifeLine && (
              <p className="text-xs text-muted-foreground mt-1">
                🌍 {realLifeLine}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
