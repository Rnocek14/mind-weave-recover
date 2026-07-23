/**
 * RoundDoneAutoAdvance — Shows round results with an auto-advance countdown.
 * User can tap "Next" immediately, tap "Pause" to hold the screen (bathroom
 * break, thinking time, caregiver check-in), or wait for auto-advance.
 *
 * Default cadence bumped from 3s → 5s for aphasia-friendly pacing.
 */
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Pause, Play } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const AUTO_ADVANCE_MS = 5000;

interface RoundDoneAutoAdvanceProps {
  onAdvance: () => void;
  children: React.ReactNode;
  /** Label for the advance button */
  buttonLabel?: string;
  /** Auto-advance delay in ms (default 5000) */
  delayMs?: number;
}

export function RoundDoneAutoAdvance({
  onAdvance,
  children,
  buttonLabel = 'Next Round',
  delayMs = AUTO_ADVANCE_MS,
}: RoundDoneAutoAdvanceProps) {
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const advancedRef = useRef(false);
  const elapsedRef = useRef(0);

  useEffect(() => {
    if (paused || advancedRef.current) return;
    let last = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      elapsedRef.current += now - last;
      last = now;
      const pct = Math.min((elapsedRef.current / delayMs) * 100, 100);
      setProgress(pct);
      if (elapsedRef.current >= delayMs && !advancedRef.current) {
        advancedRef.current = true;
        clearInterval(interval);
        onAdvance();
      }
    }, 50);
    return () => clearInterval(interval);
  }, [delayMs, onAdvance, paused]);

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
        <div className="flex items-center gap-2">
          <Progress value={progress} className="h-1 flex-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Resume auto-advance' : 'Pause auto-advance'}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {paused ? (
              <>
                <Play className="w-3.5 h-3.5 mr-1" /> Resume
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 mr-1" /> Pause
              </>
            )}
          </Button>
        </div>
        {paused && (
          <p className="text-xs text-muted-foreground">Paused — take your time.</p>
        )}
      </div>
    </div>
  );
}
