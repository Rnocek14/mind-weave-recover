import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Check, Circle, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LessonBlock {
  exerciseId: string;
  exerciseTitle: string;
  duration: number;
  focus?: string;
}

export function SessionSidePanel() {
  const [isOpen, setIsOpen] = useState(false);
  
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
  
  // Don't render if no lesson blocks
  if (blocks.length === 0) {
    return null;
  }
  
  return (
    <>
      {/* Toggle button - always visible */}
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
              
              return (
                <div
                  key={`${block.exerciseId}-${index}`}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-colors",
                    isCurrent && "bg-primary/10 border border-primary/30",
                    isCompleted && "opacity-70",
                    isUpcoming && "opacity-50"
                  )}
                >
                  {/* Status icon */}
                  <div className={cn(
                    "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
                    isCompleted && "bg-green-500/20 text-green-600",
                    isCurrent && "bg-primary/20 text-primary",
                    isUpcoming && "bg-muted text-muted-foreground"
                  )}>
                    {isCompleted && <Check className="h-3.5 w-3.5" />}
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
                    <p className="text-xs text-muted-foreground">
                      {block.duration} min
                      {block.focus && ` • ${block.focus}`}
                    </p>
                  </div>
                  
                  {/* Step number */}
                  <span className="text-xs text-muted-foreground font-mono">
                    {index + 1}
                  </span>
                </div>
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
    </>
  );
}
