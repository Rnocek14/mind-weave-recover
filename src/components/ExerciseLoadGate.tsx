/**
 * ExerciseLoadGate — shared dead-state guard for exercise load gates.
 *
 * Renders the standard "loading" spinner, but if the gate has not resolved
 * after `timeoutMs` (default 8s) it surfaces an escape hatch (Try again /
 * Go back) instead of an infinite spinner. This satisfies the Core clinical
 * safety rule: never leave users in dead states.
 *
 * Presentation only. Does NOT touch progression, scoring, or any clinical
 * logic — pages still own their own gating condition and simply early-return
 * this component while gating.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface ExerciseLoadGateProps {
  /** Message shown under the spinner while still loading. */
  loadingLabel?: string;
  /** Where "Go back" navigates. Defaults to /today. */
  backTo?: string;
  /** Milliseconds before the escape hatch appears. */
  timeoutMs?: number;
}

export function ExerciseLoadGate({
  loadingLabel = 'Loading your progress...',
  backTo = '/today',
  timeoutMs = 8000,
}: ExerciseLoadGateProps) {
  const navigate = useNavigate();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(t);
  }, [timeoutMs]);

  if (timedOut) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm space-y-4">
          <p className="text-lg font-medium text-foreground">
            We couldn't load your practice
          </p>
          <p className="text-sm text-muted-foreground">
            This sometimes happens if your connection drops or your profile
            isn't ready yet. You can try again or head back.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Button onClick={() => window.location.reload()}>Try again</Button>
            <Button variant="outline" onClick={() => navigate(backTo)}>
              Go back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">{loadingLabel}</p>
      </div>
    </div>
  );
}
