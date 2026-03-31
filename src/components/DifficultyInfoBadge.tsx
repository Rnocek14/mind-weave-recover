import React from "react";

type Props = {
  level: number;
  floor: number;
  ceiling: number;
};

export const DifficultyInfoBadge: React.FC<Props> = ({
  level,
  floor,
  ceiling,
}) => {
  const isClampedLow = level === floor;
  const isClampedHigh = level === ceiling;

  const rangeLabel = floor === 1 && ceiling === 10 ? "1–10" : `${floor}–${ceiling}`;

  const tooltip =
    floor === 1 && ceiling === 10
      ? "Difficulty adjusts automatically based on your performance."
      : "Difficulty stays within a safe range based on your current abilities.";

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <div className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
        <span className="text-foreground font-medium">Lv {level}</span>
        <span className="hidden sm:inline opacity-70">/ {rangeLabel}</span>
      </div>

      {(isClampedLow || isClampedHigh) && (
        <span className="hidden sm:inline rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
          {isClampedLow && "At easiest"}
          {isClampedHigh && !isClampedLow && "At max"}
        </span>
      )}

      <span className="sr-only">{tooltip}</span>
    </div>
  );
};
