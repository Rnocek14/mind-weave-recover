/**
 * Kids Mode session reward strip: one slot per trial, filling with stars as
 * answers land correct. Accumulating visible rewards sustains kid engagement
 * better than per-trial feedback alone. Render only when kidsMode is on.
 */
interface KidsStarMeterProps {
  /** Correct answers so far. */
  earned: number;
  /** Total trials in the session. */
  total: number;
}

export function KidsStarMeter({ earned, total }: KidsStarMeterProps) {
  if (total <= 0) return null;
  const slots = Array.from({ length: total }, (_, i) => i < earned);
  return (
    <div
      className="flex items-center justify-center gap-0.5 flex-wrap"
      role="img"
      aria-label={`${earned} of ${total} stars earned`}
    >
      {slots.map((filled, i) => (
        <span
          key={i}
          aria-hidden
          className={
            filled
              ? "text-base sm:text-lg" + (i === earned - 1 ? " kids-star-pop" : "")
              : "text-base sm:text-lg opacity-30 grayscale"
          }
        >
          ⭐
        </span>
      ))}
    </div>
  );
}
