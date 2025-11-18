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
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <div className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
        <span className="font-medium">Difficulty</span>
        <span className="text-foreground">Lv {level}</span>
      </div>

      <div className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
        <span className="opacity-70">Safe range:</span>
        <span className="font-medium">{rangeLabel}</span>
      </div>

      {(isClampedLow || isClampedHigh) && (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
          {isClampedLow && "At easiest level for now"}
          {isClampedHigh && !isClampedLow && "At top of your safe range"}
        </span>
      )}

      <span className="sr-only">{tooltip}</span>
    </div>
  );
};
