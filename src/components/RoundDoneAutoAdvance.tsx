/**
 * RoundDoneAutoAdvance — Shows round results with a 3-second auto-advance.
 * User can tap "Next" immediately or wait for auto-advance.
 * Keeps rhythm between rounds.
 */
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const AUTO_ADVANCE_MS = 3000;

interface RoundDoneAutoAdvanceProps {
  onAdvance: () => void;
  children: React.ReactNode;
  /** Label for the advance button */
  buttonLabel?: string;
  /** Auto-advance delay in ms (default 3000) */
  delayMs?: number;
}

export function RoundDoneAutoAdvance({
  onAdvance,
  children,
  buttonLabel = 'Next Round',
  delayMs = AUTO_ADVANCE_MS,
}: RoundDoneAutoAdvanceProps) {
  const [progress, setProgress] = useState(0);
  const advancedRef = useRef(false);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / delayMs) * 100, 100);
      setProgress(pct);
      if (elapsed >= delayMs && !advancedRef.current) {
        advancedRef.current = true;
        clearInterval(interval);
        onAdvance();
      }
    }, 50);
    return () => clearInterval(interval);
  }, [delayMs, onAdvance]);

  const handleManualAdvance = () => {
    if (!advancedRef.current) {
      advancedRef.current = true;
      onAdvance();
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 py-8 max-w-sm mx-auto text-center">
      {children}
      <div className="w-full space-y-2">
        <Button onClick={handleManualAdvance} className="min-h-[48px] w-full">
          <RotateCcw className="w-4 h-4 mr-2" />
          {buttonLabel}
        </Button>
        <Progress value={progress} className="h-1" />
      </div>
    </div>
  );
}
