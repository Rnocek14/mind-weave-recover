import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Check, Circle, Play, Star, RotateCcw, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
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
  exerciseTitle: string;
  duration: number;
  focus?: string;
}

const ROUTE_MAP: Record<string, string> = {
  "photo-naming": "/exercise/photo-naming",
  "phonological": "/exercise/phonological-awareness",
  "phonological-awareness": "/exercise/phonological-awareness",
  "semantic-features": "/exercise/semantic-features",
  "sentence-construction": "/exercise/sentence-construction",
  "phrase-practice": "/exercise/word-practice",
  "reach-tap": "/exercise/reach-tap",
  "pattern-match": "/exercise/pattern-match",
  "minimal-pairs": "/exercise/minimal-pairs",
  "conversation-partner": "/exercise/conversation-partner",
  "conversation-coach": "/exercise/conversation-coach",
  "two-clues": "/exercise/two-clues",
  "fix-sentence": "/exercise/fix-sentence",
  "describe-guess": "/exercise/describe-guess",
  "detective-mind": "/exercise/detective-mind",
  "meaning-match": "/exercise/meaning-match",
  "narrative-retell": "/exercise/narrative-retell",
  "abstract-compare": "/exercise/abstract-compare",
  "multi-step-plan": "/exercise/multi-step-plan",
  "dual-load-naming": "/exercise/dual-load-naming",
  "left-side-hunt": "/exercise/left-side-hunt",
  "thought-continuation": "/exercise/thought-continuation",
  "category-fluency": "/exercise/category-fluency",
  "synonym-generator": "/exercise/synonym-generator",
};

function ScoreStars({ score }: { score: number }) {
  // score is 0-100, map to 1-3 stars
  const stars = score >= 80 ? 3 : score >= 50 ? 2 : 1;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3].map((s) => (
        <Star
          key={s}
          className={cn(
            "h-3 w-3",
            s <= stars ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
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
    
    // Update sessionStorage with new block index
    const saved = sessionStorage.getItem('lessonFlowState');
    if (!saved) return;
    
    try {
      const parsed = JSON.parse(saved);
      parsed.currentBlockIndex = index;
      const stateJson = JSON.stringify(parsed);
      sessionStorage.setItem('lessonFlowState', stateJson);
      localStorage.setItem('lessonFlowState_resume', stateJson);
      
      const route = ROUTE_MAP[block.exerciseId];
      if (route) {
        setIsOpen(false);
        navigate(route, {
          state: {
            sessionId,
            fromLesson: true,
            blockIndex: index,
          },
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
    
    if (isCurrent) return; // Already playing this one
    
    if (isCompleted) {
      // Replay directly — no confirmation needed
      navigateToBlock(index, block);
    } else if (isUpcoming) {
      // Show skip confirmation
      setSkipTarget({ index, block });
    }
  }, [currentIndex, navigateToBlock]);
  
  const confirmSkip = useCallback(() => {
    if (skipTarget) {
      navigateToBlock(skipTarget.index, skipTarget.block);
      setSkipTarget(null);
    }
  }, [skipTarget, navigateToBlock]);
  
  // Don't render if no lesson blocks
  if (blocks.length === 0) {
    return null;
  }
  
  return (
    <>
      {/* Toggle button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed left-0 top-1/2 -translate-y-1/2 z-40 rounded-l-none border-l-0",
          "h-12 w-8 bg-background/95 backdrop-blur-sm shadow-lg",
          "hover:bg-accent transition-all duration-200",
          isOpen && "left-64"
        )}
        aria-label={isOpen ? "Close exercise list" : "Open exercise list"}
      >
        {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>
      
      {/* Side panel */}
      <div
        className={cn(
          "fixed left-0 top-0 h-full z-30 bg-background/95 backdrop-blur-sm border-r shadow-xl",
          "transition-transform duration-300 ease-in-out w-64",
          isOpen ? "translate-x-0" : "-translate-x-full"
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
              const isClickable = !isCurrent;
              
              return (
                <button
                  key={`${block.exerciseId}-${index}`}
                  onClick={() => handleBlockClick(index, block)}
                  disabled={isCurrent}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                    isCurrent && "bg-primary/10 border border-primary/30",
                    isCompleted && "hover:bg-muted/80 cursor-pointer",
                    isUpcoming && "hover:bg-muted/50 cursor-pointer opacity-70",
                    isCurrent && "cursor-default"
                  )}
                >
                  {/* Status icon */}
                  <div className={cn(
                    "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
                    isCompleted && !isLowScore && "bg-green-500/20 text-green-600",
                    isCompleted && isLowScore && "bg-orange-500/20 text-orange-600",
                    isCurrent && "bg-primary/20 text-primary",
                    isUpcoming && "bg-muted text-muted-foreground"
                  )}>
                    {isCompleted && !isLowScore && <Check className="h-3.5 w-3.5" />}
                    {isCompleted && isLowScore && <RotateCcw className="h-3.5 w-3.5" />}
                    {isCurrent && <Play className="h-3 w-3 fill-current" />}
                    {isUpcoming && <Circle className="h-3 w-3" />}
                  </div>
                  
                  {/* Exercise info */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium truncate",
                      isCurrent && "text-primary"
                    )}>
                      {block.exerciseTitle}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {block.duration} min
                        {block.focus && ` • ${block.focus}`}
                      </p>
                      {hasScore && <ScoreStars score={score} />}
                    </div>
                    {isCompleted && isLowScore && (
                      <p className="text-[10px] text-orange-600 font-medium mt-0.5">
                        Try again
                      </p>
                    )}
                  </div>
                  
                  {/* Action hint */}
                  <div className="flex-shrink-0">
                    {isCompleted && (
                      <RotateCcw className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    )}
                    {isUpcoming && (
                      <SkipForward className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    )}
                    {!isCompleted && !isUpcoming && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {index + 1}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-20 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Skip confirmation dialog */}
      <AlertDialog open={!!skipTarget} onOpenChange={(open) => !open && setSkipTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skip to this exercise?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll jump ahead to <strong>{skipTarget?.block.exerciseTitle}</strong>, 
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
