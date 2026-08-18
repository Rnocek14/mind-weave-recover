/**
 * ExercisePurposeBanner — Reusable purpose framing for all exercises.
 * 
 * Shows a clinically grounded one-liner explaining what skill the exercise trains
 * and why it matters. Designed for aphasia users: clear, adult, non-patronizing.
 * 
 * Part of the system foundation (Phase 1).
 *
 * Phase 2C-ii: profile-aware chrome. Larger type in simplified variants;
 * suppressed entirely in `minimal` to cut reading load. Layout-only — no
 * change to what exercise runs or how it scores.
 */

import React from 'react';
import { getExercisePurpose } from '@/lib/exercisePurposeMap';
import { useUiProfile } from '@/hooks/useUiProfile';
import { variantClass, isMinimal } from '@/lib/ui/variantClass';

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
  const { profile } = useUiProfile();
  const { variant } = profile;
  const text = adaptiveMessage || getExercisePurpose(exerciseSlug);
  if (!text) return null;

  // Minimal variant suppresses the "why" framing to reduce reading load.
  if (isMinimal(variant)) return null;

  return (
    <div
      className={variantClass(variant, {
        // Compact unless the screen is tall — this banner shares the
        // first-trial fold with the actual task, and vertical budget belongs
        // to the task. (`tall:` is height-based; laptops are wide but short.)
        base: `bg-primary/5 border border-primary/20 rounded-lg px-4 py-2 tall:py-3 text-sm text-foreground/80 ${className}`,
        simplified: 'px-4 py-2.5 text-sm tall:px-5 tall:py-4 tall:text-base leading-relaxed',
      })}
    >
      <span className="font-medium text-primary/90">Why this matters:</span>{' '}
      {text}
    </div>
  );
}
