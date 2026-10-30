import { Button } from '@/components/ui/button';
import type { ExerciseSaveState } from '@/hooks/useVerifiedExerciseCompletion';

interface ExerciseSaveFeedbackProps {
  state: ExerciseSaveState;
  onRetry: () => void;
  onExit: () => void;
}

/**
 * A single patient-facing recovery surface for exercise finish failures.
 * The normal game result is kept by the caller; leaving is an explicit choice.
 */
export function ExerciseSaveFeedback({ state, onRetry, onExit }: ExerciseSaveFeedbackProps) {
  if (state === 'saving') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="mx-auto my-auto max-w-md px-4 py-12 text-center text-xl font-medium"
      >
        Saving your answers...
      </div>
    );
  }

  if (state !== 'error') return null;

  return (
    <div role="alert" className="mx-auto my-auto max-w-md space-y-6 px-4 py-10 text-center">
      <h2 className="text-2xl font-bold">Practice not saved</h2>
      <p className="text-lg">
        We couldn't confirm all your answers were saved.
      </p>
      <Button
        size="lg"
        className="min-h-14 w-full text-lg"
        onClick={onRetry}
      >
        Try saving again
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="min-h-14 w-full text-lg"
        onClick={onExit}
      >
        Go to Today
      </Button>
      <p className="text-sm text-muted-foreground">
        Your completed answers stay on this screen while you retry.
      </p>
    </div>
  );
}
