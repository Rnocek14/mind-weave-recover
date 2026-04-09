/**
 * Visual week-over-week comparison cards showing current vs prior period deltas.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, HelpCircle, ArrowUpDown } from "lucide-react";
import { HelpLabel } from "@/components/HelpTooltip";
import type { WeekOverWeekDelta } from "@/hooks/useWeekOverWeek";

interface WeekComparisonRowProps {
  deltas: WeekOverWeekDelta[];
  windowSize: number;
  hasPriorData: boolean;
}

export function WeekComparisonRow({ deltas, windowSize, hasPriorData }: WeekComparisonRowProps) {
  if (!hasPriorData) {
    return (
      <Card className="border-dashed border-muted-foreground/20">
        <CardContent className="py-4 text-center">
          <p className="text-xs text-muted-foreground">
            No prior-period data available for comparison. Data from the previous {windowSize} days will appear here automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-primary" />
          <HelpLabel term="Week-over-Week Comparison">
            This Period vs. Prior {windowSize}d
          </HelpLabel>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {deltas.map((d) => (
            <DeltaCard key={d.metric} delta={d} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DeltaCard({ delta }: { delta: WeekOverWeekDelta }) {
  const DeltaIcon =
    delta.delta === null || delta.delta === 0
      ? Minus
      : delta.direction === "positive"
        ? TrendingUp
        : TrendingDown;

  const colorClass =
    delta.delta === null || delta.delta === 0
      ? "text-muted-foreground"
      : delta.direction === "positive"
        ? "text-green-600 dark:text-green-400"
        : "text-red-500 dark:text-red-400";

  const bgClass =
    delta.delta === null || delta.delta === 0
      ? "bg-muted/30"
      : delta.direction === "positive"
        ? "bg-green-500/5"
        : "bg-red-500/5";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`rounded-lg p-2.5 ${bgClass} space-y-1 cursor-help`}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {delta.label}
              </span>
              <HelpCircle className="w-3 h-3 text-muted-foreground/50" />
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold tabular-nums">
                {delta.current !== null ? delta.current : "—"}
              </span>
              <span className="text-xs text-muted-foreground">{delta.unit}</span>
            </div>

            {delta.delta !== null && (
              <div className={`flex items-center gap-1 text-xs font-medium ${colorClass}`}>
                <DeltaIcon className="w-3 h-3" />
                <span>
                  {delta.delta > 0 ? "+" : ""}
                  {delta.metric === "avgFatigue" ? delta.delta.toFixed(1) : delta.delta}
                  {delta.unit}
                </span>
                <span className="text-xs text-muted-foreground font-normal">
                  vs prior
                </span>
              </div>
            )}

            {delta.delta === null && delta.prior === null && (
              <p className="text-xs text-muted-foreground">No prior data</p>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          <p>{delta.tooltip}</p>
          {delta.prior !== null && (
            <p className="mt-1 text-muted-foreground">
              Prior period: {delta.prior}{delta.unit}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
