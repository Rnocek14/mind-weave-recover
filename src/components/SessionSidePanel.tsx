import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Check, Circle, Play, Star, RotateCcw, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { getCanonicalExercise } from '@/data/canonicalExerciseRegistry';
import { humanizeSlug } from '@/lib/performanceAwareFeedback';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface LessonBlock {
  exerciseId: string;
  duration: number;
  focus?: string;
}

const ROUTE_MAP: Record<string, string> = {
  'photo-naming': '/exercise/photo-naming',
  phonological: '/exercise/phonological-awareness',
  'phonological-awareness': '/exercise/phonological-awareness',
  'semantic-features': '/exercise/semantic-features',
  'sentence-construction': '/exercise/sentence-construction',
  'phrase-practice': '/exercise/word-practice',
  'reach-tap': '/exercise/reach-tap',
  'pattern-match': '/exercise/pattern-match',
  'minimal-pairs': '/exercise/minimal-pairs',
  'conversation-partner': '/exercise/conversation-partner',
  'conversation-coach': '/exercise/conversation-coach',
  'two-clues': '/exercise/two-clues',
  'fix-sentence': '/exercise/fix-sentence',
  'describe-guess': '/exercise/describe-guess',
  'detective-mind': '/exercise/detective-mind',
  'meaning-match': '/exercise/meaning-match',
  'narrative-retell': '/exercise/narrative-retell',
  'abstract-compare': '/exercise/abstract-compare',
  'multi-step-plan': '/exercise/multi-step-plan',
  'dual-load-naming': '/exercise/dual-load-naming',
  'left-side-hunt': '/exercise/left-side-hunt',
  'thought-continuation': '/exercise/thought-continuation',
  'category-fluency': '/exercise/category-fluency',
  'synonym-generator': '/exercise/synonym-generator',
};

function ScoreStars({ score }: { score: number }) {
  const stars = score >= 80 ? 3 : score >= 50 ? 2 : 1;
  return (
    <div className="flex gap-0.5" aria-label={`${stars} star score`}>
      {[1, 2, 3].map((s) => (
        <Star
          key={s}
          className={cn(
            'h-3 w-3',
            s <= stars ? 'fill-primary text-primary' : 'text-muted-foreground/30'
          )}
        />
      ))}
    </div>
  );
}

function getBlockTitle(block: LessonBlock) {
  return getCanonicalExercise(block.exerciseId)?.title ?? humanizeSlug(block.exerciseId);
}

export function SessionSidePanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [skipTarget, setSkipTarget] = useState<{ index: number; block: LessonBlock } | null>(null);
  const navigate = useNavigate();

  const lessonState = useMemo(() => {
    try {
      const saved = sessionStorage.getItem('lessonFlowState');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, []);

  const blocks: LessonBlock[] = lessonState?.lesson?.blocks || [];
  const currentIndex = lessonState?.currentBlockIndex || 0;
  const blockScores: Record<number, number> = lessonState?.blockScores || {};
  const sessionId = lessonState?.sessionId;

  const navigateToBlock = useCallback((index: number, block: LessonBlock) => {
    if (!sessionId) return;

    const saved = sessionStorage.getItem('lessonFlowState');
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      parsed.currentBlockIndex = index;
      parsed.phase = 'exercise';
      const stateJson = JSON.stringify(parsed);
      sessionStorage.setItem('lessonFlowState', stateJson);
      localStorage.setItem('lessonFlowState_resume', stateJson);

      const route = ROUTE_MAP[block.exerciseId];
      if (route) {
        setIsOpen(false);
        navigate('/lesson', {
          state: {
            resuming: true,
            directJump: index,
          },
          replace: true,
        });
      }
    } catch (e) {
      console.error('[SessionSidePanel] Failed to navigate:', e);
    }
  }, [sessionId, navigate]);

  const handleBlockClick = useCallback((index: number, block: LessonBlock) => {
    const isCompleted = index < currentIndex;
    const isCurrent = index === currentIndex;
    const isUpcoming = index > currentIndex;

    if (isCurrent) return;

    if (isCompleted) {
      navigateToBlock(index, block);
    } else if (isUpcoming) {
      setSkipTarget({ index, block });
    }
  }, [currentIndex, navigateToBlock]);

  const confirmSkip = useCallback(() => {
    if (skipTarget) {
      navigateToBlock(skipTarget.index, skipTarget.block);
      setSkipTarget(null);
    }
  }, [skipTarget, navigateToBlock]);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label="Toggle panel"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'fixed left-0 top-1/2 -translate-y-1/2 z-40 rounded-l-none border-l-0',
          'h-12 w-8 bg-background/95 backdrop-blur-sm shadow-lg',
          'hover:bg-accent transition-all duration-200',
          isOpen && 'left-64'
        )}
        aria-label={isOpen ? 'Close exercise list' : 'Open exercise list'}
      >
        {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>

      <div
        className={cn(
          'fixed left-0 top-0 h-full z-30 bg-background/95 backdrop-blur-sm border-r shadow-xl',
          'transition-transform duration-300 ease-in-out w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg">Today's Session</h2>
          <p className="text-sm text-muted-foreground">
            {currentIndex} of {blocks.length} complete
          </p>
        </div>

        <div className="p-2 overflow-y-auto max-h-[calc(100vh-100px)]">
          <div className="space-y-1">
            {blocks.map((block, index) => {
              const isCompleted = index < currentIndex;
              const isCurrent = index === currentIndex;
              const isUpcoming = index > currentIndex;
              const score = blockScores[index];
              const hasScore = score !== undefined;
              const isLowScore = hasScore && score < 50;
              const blockTitle = getBlockTitle(block);

              return (
                <button
                  key={`${block.exerciseId}-${index}`}
                  onClick={() => handleBlockClick(index, block)}
                  disabled={isCurrent}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
                    isCurrent && 'bg-primary/10 border border-primary/30',
                    isCompleted && 'hover:bg-muted/80 cursor-pointer',
                    isUpcoming && 'hover:bg-muted/50 cursor-pointer opacity-70',
                    isCurrent && 'cursor-default'
                  )}
                >
                  <div className={cn(
                    'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
                    isCompleted && !isLowScore && 'bg-primary/15 text-primary',
                    isCompleted && isLowScore && 'bg-secondary text-secondary-foreground',
                    isCurrent && 'bg-primary/20 text-primary',
                    isUpcoming && 'bg-muted text-muted-foreground'
                  )}>
                    {isCompleted && !isLowScore && <Check className="h-3.5 w-3.5" />}
                    {isCompleted && isLowScore && <RotateCcw className="h-3.5 w-3.5" />}
                    {isCurrent && <Play className="h-3 w-3 fill-current" />}
                    {isUpcoming && <Circle className="h-3 w-3" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium truncate', isCurrent && 'text-primary')}>
                      {blockTitle}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {block.duration} min
                        {block.focus && ` • ${block.focus}`}
                      </p>
                      {hasScore && <ScoreStars score={score} />}
                    </div>
                    {isCompleted && isLowScore && (
                      <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                        Try again
                      </p>
                    )}
                  </div>

                  <div className="flex-shrink-0">
                    {isCompleted && <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />}
                    {isUpcoming && <SkipForward className="h-3.5 w-3.5 text-muted-foreground" />}
                    {!isCompleted && !isUpcoming && (
                      <span className="text-xs text-muted-foreground font-mono">{index + 1}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 z-20 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <AlertDialog open={!!skipTarget} onOpenChange={(open) => !open && setSkipTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skip to this exercise?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll jump ahead to <strong>{skipTarget ? getBlockTitle(skipTarget.block) : 'this exercise'}</strong>,
              skipping {skipTarget ? skipTarget.index - currentIndex : 0} exercise{skipTarget && skipTarget.index - currentIndex > 1 ? 's' : ''}.
              You can always come back to skipped exercises later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSkip}>
              <SkipForward className="h-4 w-4 mr-2" />
              Skip ahead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

