import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coffee, Play } from 'lucide-react';

interface RestPromptProps {
  onContinue: () => void;
  onEnd: () => void;
}

export const RestPrompt = ({ onContinue, onEnd }: RestPromptProps) => {
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          onContinue();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onContinue]);

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-glow">
        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-healing flex items-center justify-center">
          <Coffee className="w-10 h-10 text-white" />
        </div>
        
        <div>
          <h2 className="text-2xl font-bold mb-2">Time for a Break</h2>
          <p className="text-muted-foreground">
            You've been practicing for 10 minutes. Take a moment to rest.
          </p>
        </div>

        <div className="text-5xl font-bold text-primary">
          {countdown}s
        </div>

        <div className="space-y-3">
          <Button 
            className="w-full bg-gradient-healing" 
            size="lg"
            onClick={onContinue}
          >
            <Play className="w-5 h-5 mr-2" />
            Continue Now
          </Button>
          <Button 
            variant="outline" 
            className="w-full" 
            size="lg"
            onClick={onEnd}
          >
            End Session
          </Button>
        </div>
      </Card>
    </div>
  );
};
