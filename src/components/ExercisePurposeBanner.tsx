/**
 * ExercisePurposeBanner — Reusable purpose framing for all exercises.
 * 
 * Shows a clinically grounded one-liner explaining what skill the exercise trains
 * and why it matters. Designed for aphasia users: clear, adult, non-patronizing.
 * 
 * Part of the system foundation (Phase 1).
 */

import React from 'react';
import { getExercisePurpose } from '@/lib/exercisePurposeMap';

interface ExercisePurposeBannerProps {
  exerciseSlug: string;
  /** Override default purpose text (e.g., adaptive messaging based on performance) */
  adaptiveMessage?: string;
  /** Show even after first trial (default: only on first trial via parent control) */
  alwaysShow?: boolean;
  className?: string;
}

export function ExercisePurposeBanner({
  exerciseSlug,
  adaptiveMessage,
  className = '',
}: ExercisePurposeBannerProps) {
  const text = adaptiveMessage || getExercisePurpose(exerciseSlug);
  if (!text) return null;

  return (
    <div className={`bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 text-sm text-foreground/80 ${className}`}>
      <span className="font-medium text-primary/90">Why this matters:</span>{' '}
      {text}
    </div>
  );
}
