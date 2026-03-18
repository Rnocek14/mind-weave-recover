import { useState, useEffect } from 'react';
import { CheckCircle2, Wind } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ExerciseTransitionOverlayProps {
  /** 'encouragement' = quick 3s auto-advance, 'micro-pause' = 8s breathing reset */
  type: 'encouragement' | 'micro-pause';
  completedCount: number;
  totalCount: number;
  nextExerciseName: string;
  onContinue: () => void;
  onEnd: () => void;
}

const encouragements = [
  { text: "Nice work!", emoji: "💪" },
  { text: "Great job!", emoji: "🌟" },
  { text: "Keep going!", emoji: "🔥" },
  { text: "You're doing great!", emoji: "✨" },
  { text: "Wonderful!", emoji: "🎯" },
  { text: "Well done!", emoji: "👏" },
];

export const ExerciseTransitionOverlay = ({
  type,
  completedCount,
  totalCount,
  nextExerciseName,
  onContinue,
  onEnd,
}: ExerciseTransitionOverlayProps) => {
  const duration = type === 'encouragement' ? 3 : 8;
  const [timeLeft, setTimeLeft] = useState(duration);
  const [encouragement] = useState(() => 
    encouragements[Math.floor(Math.random() * encouragements.length)]
  );

  const progress = (completedCount / totalCount) * 100;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onContinue();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onContinue]);

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

          {/* Subtle auto-advance indicator */}
          <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
            <div 
              className="h-full bg-primary/40 transition-all duration-1000 ease-linear"
              style={{ width: `${((duration - timeLeft) / duration) * 100}%` }}
            />
          </div>

          {/* Skip / End options */}
          <div className="flex gap-3">
            <Button 
              variant="ghost" 
              size="lg" 
              className="flex-1 text-muted-foreground"
              onClick={onEnd}
            >
              End session
            </Button>
            <Button 
              size="lg" 
              className="flex-1"
              onClick={onContinue}
            >
              Continue
            </Button>
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
      </div>
    </div>
  );
};
