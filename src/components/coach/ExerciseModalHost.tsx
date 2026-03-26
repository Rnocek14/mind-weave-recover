/**
 * ExerciseModalHost — Renders full exercises inside a modal/sheet
 * 
 * Wraps reusable game components in a Dialog (mobile) or Sheet (desktop).
 * Normalizes results and passes them back to the coach session.
 */

import React, { useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { X, Sparkles } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { normalizeExerciseResult, type NormalizedExerciseResult } from '@/lib/normalizedExerciseResult';
import type { ActiveModalExercise } from '@/hooks/useExerciseModal';

// Import game components
import { PhotoNamingGame } from '@/components/PhotoNamingGame';
import { MinimalPairsGame } from '@/components/MinimalPairsGame';
import { MeaningMatchGame } from '@/components/MeaningMatchGame';

interface ExerciseModalHostProps {
  activeExercise: ActiveModalExercise | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (result: NormalizedExerciseResult) => void;
  userId: string;
  sessionId: string | null;
}

// Registry of modal-capable exercises
const MODAL_EXERCISE_TITLES: Record<string, string> = {
  'photo-naming': 'Photo Naming',
  'minimal-pairs': 'Sound Pairs',
  'meaning-match': 'Meaning Match',
};

export function ExerciseModalHost({
  activeExercise,
  isOpen,
  onClose,
  onComplete,
  userId,
  sessionId,
}: ExerciseModalHostProps) {
  const isMobile = useIsMobile();

  const handleGameComplete = useCallback((slug: string, rawResult: unknown) => {
    const normalized = normalizeExerciseResult(slug, rawResult);
    onComplete(normalized);
    onClose();
  }, [onComplete, onClose]);

  const handleCancel = useCallback(() => {
    if (activeExercise) {
      onComplete(normalizeExerciseResult(activeExercise.slug, {
        completed: false,
        score: 0,
        cancelled: true,
      }));
    }
    onClose();
  }, [activeExercise, onComplete, onClose]);

  if (!activeExercise) return null;

  const title = MODAL_EXERCISE_TITLES[activeExercise.slug] || 'Quick Practice';
  const config = activeExercise.config;

  const renderExercise = () => {
    switch (activeExercise.slug) {
      case 'photo-naming':
        return (
          <PhotoNamingGame
            totalTrials={config.totalTrials ?? 5}
            initialDifficulty={config.difficultyTier ?? 1}
            sessionId={sessionId}
            onGameComplete={(finalScore) => {
              handleGameComplete('photo-naming', {
                correct: finalScore,
                total: config.totalTrials ?? 5,
                cueLevel: config.cueLevel ?? 0,
              });
            }}
          />
        );

      case 'minimal-pairs':
        return (
          <MinimalPairsGame
            difficulty={config.difficultyTier ?? 1}
            totalTrials={config.totalTrials ?? 5}
            focusPhonemes={config.targetPhonemes}
            onComplete={(results) => {
              handleGameComplete('minimal-pairs', results);
            }}
          />
        );

      case 'meaning-match':
        return (
          <MeaningMatchGame
            roundCount={config.totalTrials ?? 5}
            difficultyLevel={config.difficultyTier ?? 1}
            onTrialComplete={() => {}}
            onGameComplete={(results) => {
              handleGameComplete('meaning-match', results);
            }}
          />
        );

      default:
        return (
          <div className="p-6 text-center text-muted-foreground">
            Exercise "{activeExercise.slug}" is not yet available in modal mode.
          </div>
        );
    }
  };

  const content = (
    <div className="flex flex-col h-full max-h-[80vh] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{title} with Maya</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleCancel} className="h-8 w-8">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Exercise content */}
      <div className="flex-1 overflow-y-auto p-4">
        {renderExercise()}
      </div>
    </div>
  );

  // Mobile: full dialog, Desktop: right-side sheet
  if (isMobile) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-lg p-0 gap-0 max-h-[90vh] overflow-hidden">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <SheetContent side="right" className="w-[480px] sm:max-w-lg p-0 gap-0">
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {content}
      </SheetContent>
    </Sheet>
  );
}
