/**
 * EmptyResponseRepair — Reusable card shown when the patient produced no usable
 * response in a timed/speech round. Replaces silent auto-advance with an
 * acknowledged, supportive moment + manual "Next" + 6s timeout.
 *
 * Clinical safety: NEVER praises. Always offers a clear next step.
 */
import { RoundDoneAutoAdvance } from './RoundDoneAutoAdvance';
import { Heart } from 'lucide-react';
import { EMPTY_REPAIR_LINE } from '@/lib/feedbackPolicy';

interface EmptyResponseRepairProps {
  onAdvance: () => void;
  /** Optional override message */
  message?: string;
  /** Button label (default: "Next") */
  buttonLabel?: string;
  /** Auto-advance delay (default 6s — slower than normal so it doesn't feel abrupt) */
  delayMs?: number;
}

export function EmptyResponseRepair({
  onAdvance,
  message = EMPTY_REPAIR_LINE,
  buttonLabel = 'Next',
  delayMs = 6000,
}: EmptyResponseRepairProps) {
  return (
    <RoundDoneAutoAdvance onAdvance={onAdvance} buttonLabel={buttonLabel} delayMs={delayMs}>
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-full bg-muted p-3">
          <Heart className="w-6 h-6 text-muted-foreground" aria-hidden />
        </div>
        <p className="text-base text-foreground" role="status">
          {message}
        </p>
      </div>
    </RoundDoneAutoAdvance>
  );
}
