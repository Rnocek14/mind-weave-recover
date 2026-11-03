/**
 * ExerciseModalHost — Renders full exercises inside a modal/sheet
 * 
 * Wraps reusable game components in a Dialog (mobile) or Sheet (desktop).
 * Normalizes results and passes them back to the coach session.
 */

import React, { useCallback, useState } from 'react';
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
import { SemanticFeatureGame } from '@/components/SemanticFeatureGame';
import { SentenceConstructionGame } from '@/components/SentenceConstructionGame';
import { YesNoComprehensionProbe } from './YesNoComprehensionProbe';
import { StoryRetellProbe } from './StoryRetellProbe';
import { FollowDirectionsProbe } from './FollowDirectionsProbe';
import { CategoryFluencyProbe } from './CategoryFluencyProbe';
import { SequenceBuilderProbe } from './SequenceBuilderProbe';
import { DIRECTION_PRACTICE_STAGES, type DirectionPracticeLevel } from '@/lib/coach/followDirectionsPractice';
import { SEQUENCE_PRACTICE_STAGES, type SequencePracticeLevel } from '@/lib/coach/sequenceBuilderPractice';

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
  'semantic-features': 'Semantic Features',
  'sentence-construction': 'Sentence Building',
  'yes-no-comprehension': 'Quick Comprehension',
  'story-retell': 'Story Retell',
  'follow-directions': 'Follow Directions',
  'category-fluency': 'Category Fluency',
  'sequence-builder': 'Sequence Builder',
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
  // Key by the actual launch and patient/session. A previous patient's stage
  // selection cannot leak into the next modal or mutate persisted progression.
  const launchScope = [
    activeExercise?.slug ?? '', activeExercise?.launchedAt ?? '',
    userId ?? '', sessionId ?? '',
  ].join(':');
  const [stageLaunch, setStageLaunch] = useState<{
    scope:string; level:number|null; started:boolean;
  }|null>(null);
  const isStagedProbe = activeExercise?.slug === 'follow-directions'
    || activeExercise?.slug === 'sequence-builder';
  const selectedStage = stageLaunch?.scope === launchScope ? stageLaunch.level : null;
  const stageStarted = stageLaunch?.scope === launchScope && stageLaunch.started;
  const startStage = () => setStageLaunch({
    scope:launchScope,level:selectedStage,started:true,
  });

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
    if (isStagedProbe && !stageStarted) {
      const stages = activeExercise.slug === 'follow-directions'
        ? DIRECTION_PRACTICE_STAGES : SEQUENCE_PRACTICE_STAGES;
      return (
        <div className="mx-auto max-w-lg space-y-4 p-2">
          <h2 className="text-xl font-semibold text-center">Practice with Maya</h2>
          <p className="text-center text-sm text-muted-foreground">
            Listen, think and take your time. This is practice, not a clinical recovery score.
          </p>
          <details className="rounded-xl border p-3">
            <summary className="min-h-10 cursor-pointer font-semibold">
              Care partner: choose a practice stage
            </summary>
            <p className="text-sm mt-2 text-muted-foreground">
              Eight different activities. Stage choice affects only this practice
              and does not overwrite the patient's saved recovery level.
            </p>
            <div className="grid grid-cols-1 gap-2 mt-3">
              {stages.map(stage => (
                <Button key={stage.level} variant={selectedStage === stage.level ? 'default':'outline'}
                  className="w-full h-auto min-h-12 whitespace-normal text-left justify-start p-3"
                  aria-pressed={selectedStage === stage.level}
                  onClick={()=>setStageLaunch({
                    scope:launchScope,level:stage.level,started:false,
                  })}>
                  Stage {stage.level}: {'name' in stage ? stage.name : stage.label}
                </Button>
              ))}
            </div>
            {selectedStage != null && <p role="status" className="mt-3 text-sm p-2 rounded-lg bg-muted">
              {stages[selectedStage-1]?.instruction
                ?? ('instructions' in stages[selectedStage-1]
                  ? stages[selectedStage-1].instructions : '')}
            </p>}
            {selectedStage != null && <Button variant="ghost"
              className="w-full mt-2" onClick={()=>setStageLaunch({
                scope:launchScope,level:null,started:false,
              })}>Use regular quick practice instead</Button>}
          </details>
          <Button size="lg" className="w-full min-h-16 text-lg"
            onClick={startStage}>Start practice</Button>
        </div>
      );
    }
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
            sessionId={sessionId}
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

      case 'semantic-features':
        return (
          <SemanticFeatureGame
            totalTrials={config.totalTrials ?? 5}
            config={{ startDifficulty: config.difficultyTier ?? 1, cueLevel: config.cueLevel ?? 2 }}
            bounds={{ floor: 1, ceiling: 5, suggestedStart: config.difficultyTier ?? 1 }}
            onGameComplete={(finalScore, totalTrials) => {
              handleGameComplete('semantic-features', { correct: finalScore, total: totalTrials });
            }}
            userId={userId}
            sessionId={sessionId ?? undefined}
          />
        );

      case 'sentence-construction':
        return (
          <SentenceConstructionGame
            config={{ startDifficulty: config.difficultyTier ?? 1, cueLevel: config.cueLevel ?? 2 }}
            bounds={{ floor: 1, ceiling: 5, suggestedStart: config.difficultyTier ?? 1 }}
            difficultyLevel={config.difficultyTier ?? 1}
            onGameComplete={(finalScore, totalTrials) => {
              handleGameComplete('sentence-construction', { correct: finalScore, total: totalTrials });
            }}
          />
        );

      case 'yes-no-comprehension':
        return (
          <YesNoComprehensionProbe
            totalTrials={config.totalTrials ?? 5}
            onComplete={(results) => {
              handleGameComplete('yes-no-comprehension', results);
            }}
          />
        );

      case 'story-retell':
        return (
          <StoryRetellProbe
            difficultyTier={(config.difficultyTier as 1 | 2 | 3) ?? undefined}
            onComplete={(results) => {
              handleGameComplete('story-retell', results);
            }}
          />
        );

      case 'follow-directions':
        return (
          <FollowDirectionsProbe
            key={launchScope}
            practiceLevel={selectedStage as DirectionPracticeLevel | null}
            totalTrials={config.totalTrials ?? 5}
            difficultyLevel={config.difficultyTier ?? 2}
            onComplete={(results) => {
              handleGameComplete('follow-directions', results);
            }}
          />
        );

      case 'category-fluency':
        return (
          <CategoryFluencyProbe
            onComplete={(results) => {
              handleGameComplete('category-fluency', results);
            }}
          />
        );

      case 'sequence-builder':
        return (
          <SequenceBuilderProbe
            key={launchScope}
            practiceLevel={selectedStage as SequencePracticeLevel | null}
            totalTrials={config.totalTrials ?? 3}
            onComplete={(results) => {
              handleGameComplete('sequence-builder', results);
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
        <Button variant="ghost" size="icon" aria-label="Close" onClick={handleCancel} className="h-8 w-8">
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
