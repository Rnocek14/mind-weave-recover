import { useState, useEffect, useRef } from 'react';
import { Wind, Clock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { trackTransitionAction } from '@/lib/sessionFlowAnalytics';
import { getTransitionEncouragement } from '@/lib/performanceAwareFeedback';

export const ExerciseTransitionOverlay = ({
  type,
  durationOverride,
  completedCount,
  totalCount,
  nextExerciseName,
  sessionId,
  onContinue,
  onEnd,
}: ExerciseTransitionOverlayProps) => {
  const defaultDuration = type === 'encouragement' ? 3 : 8;
  const duration = durationOverride ?? defaultDuration;
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef(Date.now());
  const [encouragement] = useState(() => 
    encouragements[Math.floor(Math.random() * encouragements.length)]
  );

  useEffect(() => {
    if (isPaused) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          trackTransitionAction(
            sessionId ?? null, completedCount, totalCount,
            type, 'auto_advance', Date.now() - startTimeRef.current
          );
          onContinue();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onContinue, isPaused, sessionId, completedCount, totalCount, type]);

  const handleSkipContinue = () => {
    trackTransitionAction(
      sessionId ?? null, completedCount, totalCount,
      type, 'skip', Date.now() - startTimeRef.current
    );
    onContinue();
  };

  const handleEnd = () => {
    trackTransitionAction(
      sessionId ?? null, completedCount, totalCount,
      type, 'end_session', Date.now() - startTimeRef.current
    );
    onEnd();
  };

  const handleNeedMoreTime = () => {
    trackTransitionAction(
      sessionId ?? null, completedCount, totalCount,
      type, 'need_more_time', Date.now() - startTimeRef.current
    );
    setIsPaused(true);
  };

  if (type === 'micro-pause') {
    return (
      <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-6 animate-in fade-in duration-500">
          {/* Progress dots */}
          <div className="flex justify-center gap-2">
            {Array.from({ length: totalCount }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-3 h-3 rounded-full transition-all duration-300",
                  i < completedCount
                    ? "bg-primary scale-100"
                    : "bg-muted scale-75"
                )}
              />
            ))}
          </div>

          {/* Breathing icon */}
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Wind className="w-10 h-10 text-primary animate-pulse" />
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-1">Take a breath</h2>
            <p className="text-muted-foreground text-lg">
              You're doing great — {completedCount} of {totalCount} done
            </p>
          </div>

          {/* Auto-advance indicator (hidden when paused) */}
          {!isPaused && (
            <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
              <div 
                className="h-full bg-primary/40 transition-all duration-1000 ease-linear"
                style={{ width: `${((duration - timeLeft) / duration) * 100}%` }}
              />
            </div>
          )}

          {isPaused && (
            <p className="text-sm text-muted-foreground">Take as long as you need</p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-3">
              <Button 
                variant="ghost" 
                size="lg" 
                className="flex-1 text-muted-foreground"
                onClick={handleEnd}
              >
                End session
              </Button>
              <Button 
                size="lg" 
                className="flex-1"
                onClick={handleSkipContinue}
              >
                Continue
              </Button>
            </div>
            {!isPaused && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground mx-auto"
                onClick={handleNeedMoreTime}
              >
                <Clock className="w-4 h-4 mr-1.5" />
                Need more time
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Encouragement overlay — brief, auto-advancing
  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
        {/* Progress */}
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalCount }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-300",
                i < completedCount
                  ? "bg-primary scale-100"
                  : "bg-muted scale-75"
              )}
            />
          ))}
        </div>

        {/* Encouragement */}
        <div className="space-y-1">
          <p className="text-4xl">{encouragement.emoji}</p>
          <h2 className="text-2xl font-bold">{encouragement.text}</h2>
          <p className="text-muted-foreground">
            Next up: <span className="font-medium capitalize">{nextExerciseName.replace(/-/g, ' ')}</span>
          </p>
        </div>

        {/* Auto-advance bar */}
        <div className="w-24 mx-auto bg-muted rounded-full h-1 overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${((duration - timeLeft) / duration) * 100}%` }}
          />
        </div>

        {/* Tap anywhere hint */}
        <button
          onClick={handleSkipContinue}
          className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          Tap to skip
        </button>
      </div>
    </div>
  );
};
