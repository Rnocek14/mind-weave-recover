/**
 * MayaSessionOverlay — Renders the Maya help bubble during active sessions
 * 
 * Reads session state from sessionStorage and coaching mode from context.
 * Only visible in Guided (light) and Full modes, hidden in Games Only (off).
 * Provides on-demand help: repeat instructions, progressive hints, exercise purpose.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useCoachingMode } from '@/contexts/CoachingModeContext';
import { getExerciseInstruction, getExerciseHint } from '@/lib/exerciseMicroGuidance';
import { getExercisePurpose } from '@/lib/exercisePurposeMap';
import { MayaAssistantBubble, type MayaHelpAction } from './MayaAssistantBubble';
import { useToast } from '@/hooks/use-toast';

/** Check if current route is an exercise route */
function isExerciseRoute(pathname: string): boolean {
  return pathname.startsWith('/exercise/');
}

/** Extract exercise slug from sessionStorage lesson state */
function getActiveExerciseSlug(): string | null {
  try {
    const saved = sessionStorage.getItem('lessonFlowState');
    if (!saved) return null;
    const state = JSON.parse(saved);
    if (state.phase !== 'exercise' || !state.lesson?.blocks) return null;
    const block = state.lesson.blocks[state.currentBlockIndex];
    return block?.exerciseId || null;
  } catch {
    return null;
  }
}

export function MayaSessionOverlay() {
  const { mode } = useCoachingMode();
  const location = useLocation();
  const { toast } = useToast();
  const [hintLevel, setHintLevel] = useState(0);
  const [lastExerciseSlug, setLastExerciseSlug] = useState<string | null>(null);

  // Determine if we should show the bubble
  const onExerciseRoute = isExerciseRoute(location.pathname);
  const exerciseSlug = useMemo(() => {
    if (!onExerciseRoute) return null;
    return getActiveExerciseSlug();
  }, [onExerciseRoute, location.pathname]);

  // Reset hint level when exercise changes
  useEffect(() => {
    if (exerciseSlug && exerciseSlug !== lastExerciseSlug) {
      setHintLevel(0);
      setLastExerciseSlug(exerciseSlug);
    }
  }, [exerciseSlug, lastExerciseSlug]);

  const handleAction = useCallback((action: MayaHelpAction) => {
    if (!exerciseSlug) return;

    let message = '';

    switch (action) {
      case 'repeat_instructions': {
        const instruction = getExerciseInstruction(exerciseSlug);
        message = instruction || 'Try your best with this exercise.';
        break;
      }
      case 'give_hint': {
        message = getExerciseHint(exerciseSlug, hintLevel);
        setHintLevel(prev => Math.min(prev + 1, 2));
        break;
      }
      case 'what_are_we_doing': {
        const purpose = getExercisePurpose(exerciseSlug);
        message = purpose || 'Practicing to strengthen your communication.';
        break;
      }
      default:
        return;
    }

    toast({
      description: message,
      duration: 4000,
    });
  }, [exerciseSlug, hintLevel, toast]);

  const bubbleVisible = mode !== 'off' && onExerciseRoute && !!exerciseSlug;

  // While the floating bubble is shown, give the page bottom clearance so the
  // last interactive element (answer choices, "I'm done") can always scroll
  // clear of it. Without this the fixed bubble sits ON TOP of the bottom-most
  // tap target on short screens — a mis-tap trap for motor-impaired users.
  useEffect(() => {
    if (!bubbleVisible) return;
    const prev = document.body.style.paddingBottom;
    document.body.style.paddingBottom = '96px';
    return () => {
      document.body.style.paddingBottom = prev;
    };
  }, [bubbleVisible]);

  // Don't render if: Games Only mode, not on exercise route, or no active exercise
  if (!bubbleVisible) {
    return null;
  }

  return (
    <MayaAssistantBubble
      visible={true}
      onAction={handleAction}
      hintLevel={hintLevel}
    />
  );
}
