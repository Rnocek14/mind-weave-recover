import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Coffee, Droplet, ActivitySquare, Clock, Brain } from 'lucide-react';
import { useState, useEffect } from 'react';

interface BreakPromptProps {
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
  onEndSession?: () => void;
  suggestedDurationMinutes?: number;
}

export const BreakPrompt = ({
  open,
  onClose,
  onContinue,
  onEndSession,
  suggestedDurationMinutes = 2
}: BreakPromptProps) => {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  useEffect(() => {
    if (!isTimerRunning || timeLeft === null) return;

    if (timeLeft <= 0) {
      setIsTimerRunning(false);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev! - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isTimerRunning, timeLeft]);

  const startBreak = () => {
    setTimeLeft(suggestedDurationMinutes * 60);
    setIsTimerRunning(true);
  };

  const skipBreak = () => {
    onContinue();
    onClose();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Coffee className="h-6 w-6 text-primary" />
            Time for a Break
          </DialogTitle>
          <DialogDescription>
            You've been working hard. A short break can help you stay focused.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Why Take a Break */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Brain className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium mb-1">Your Brain Needs Rest</h4>
                  <p className="text-sm text-muted-foreground">
                    Research shows that short breaks improve learning and reduce fatigue.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Break Activities */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-4 flex flex-col items-center text-center gap-2">
                <Droplet className="h-5 w-5 text-blue-500" />
                <span className="text-xs text-muted-foreground">Hydrate</span>
              </CardContent>
            </Card>
            
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-4 flex flex-col items-center text-center gap-2">
                <ActivitySquare className="h-5 w-5 text-success" />
                <span className="text-xs text-muted-foreground">Stretch</span>
              </CardContent>
            </Card>
            
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-4 flex flex-col items-center text-center gap-2">
                <Coffee className="h-5 w-5 text-warning" />
                <span className="text-xs text-muted-foreground">Relax</span>
              </CardContent>
            </Card>
          </div>

          {/* Timer */}
          {isTimerRunning && timeLeft !== null ? (
            <Card className="border-success/20 bg-success/5">
              <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center gap-3">
                <Clock className="h-6 w-6 text-success" />
                <div className="text-4xl font-bold text-success">
                  {formatTime(timeLeft)}
                </div>
                <p className="text-sm text-muted-foreground">
                  Break time remaining
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50">
              <CardContent className="pt-6 pb-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Suggested break: <span className="font-medium">{suggestedDurationMinutes} minutes</span>
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          {!isTimerRunning ? (
            <>
              <Button 
                onClick={startBreak}
                size="lg"
                className="w-full"
              >
                Start {suggestedDurationMinutes}-Minute Break
              </Button>
              
              <Button 
                onClick={skipBreak}
                variant="outline"
                size="lg"
                className="w-full"
              >
                I'm Ready to Continue
              </Button>
              
              {onEndSession && (
                <Button 
                  onClick={() => {
                    onEndSession();
                    onClose();
                  }}
                  variant="ghost"
                  size="sm"
                  className="w-full"
                >
                  End Session
                </Button>
              )}
            </>
          ) : (
            <>
              <Button 
                onClick={skipBreak}
                size="lg"
                className="w-full"
                disabled={timeLeft! > 30}
              >
                {timeLeft! > 30 ? `Continue in ${formatTime(timeLeft!)}` : 'Continue Now'}
              </Button>
              
              <Button 
                onClick={() => setIsTimerRunning(false)}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Stop Timer
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
