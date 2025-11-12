import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Clock } from 'lucide-react';

interface TrialTimerProps {
  duration: number; // seconds
  onTimeout: () => void;
  isActive: boolean;
}

export const TrialTimer = ({ duration, onTimeout, isActive }: TrialTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    if (!isActive) return;

    setTimeLeft(duration);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0.1) {
          clearInterval(interval);
          onTimeout();
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [duration, onTimeout, isActive]);

  const progress = (timeLeft / duration) * 100;
  const isUrgent = timeLeft < duration * 0.3; // Last 30% is urgent

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Clock className={`w-4 h-4 ${isUrgent ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
          <span className={isUrgent ? 'text-destructive font-bold' : 'text-muted-foreground'}>
            Time Limit
          </span>
        </div>
        <span className={`font-mono ${isUrgent ? 'text-destructive font-bold' : 'text-foreground'}`}>
          {timeLeft.toFixed(1)}s
        </span>
      </div>
      <Progress
        value={progress}
        className={`h-2 transition-colors ${isUrgent ? 'bg-destructive/20' : ''}`}
      />
    </div>
  );
};
