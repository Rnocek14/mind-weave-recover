import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gauge, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useMemo } from "react";

interface SuccessBandIndicatorProps {
  /** Day-level accuracy data: each entry has accuracy (0-100) and trial count */
  dayData: Array<{ accuracy: number | null; trials: number }>;
}

/**
 * Success-band indicator for clinicians.
 * Shows whether the patient is in the 70–85% optimal challenge zone.
 */
export function SuccessBandIndicator({ dayData }: SuccessBandIndicatorProps) {
  const analysis = useMemo(() => {
    const withData = dayData.filter((d) => d.accuracy !== null && d.trials >= 3);
    if (withData.length === 0) return null;

    const totalTrials = withData.reduce((s, d) => s + d.trials, 0);
    const weightedAcc = withData.reduce((s, d) => s + (d.accuracy || 0) * d.trials, 0) / totalTrials;
    const recentAcc = withData.slice(-3).reduce((s, d) => s + (d.accuracy || 0), 0) / Math.min(withData.length, 3);

    let zone: "under" | "optimal" | "over" = "optimal";
    if (weightedAcc < 70) zone = "under";
    else if (weightedAcc > 85) zone = "over";

    let trend: "improving" | "stable" | "declining" = "stable";
    if (withData.length >= 3) {
      const first = withData.slice(0, Math.ceil(withData.length / 2));
      const second = withData.slice(Math.ceil(withData.length / 2));
      const firstAvg = first.reduce((s, d) => s + (d.accuracy || 0), 0) / first.length;
      const secondAvg = second.reduce((s, d) => s + (d.accuracy || 0), 0) / second.length;
      if (secondAvg - firstAvg > 5) trend = "improving";
      else if (firstAvg - secondAvg > 5) trend = "declining";
    }

    return { weightedAcc: Math.round(weightedAcc), recentAcc: Math.round(recentAcc), zone, trend, totalTrials };
  }, [dayData]);

  if (!analysis) return null;

  const zoneConfig = {
    under: {
      label: "Below Target",
      sublabel: "Challenge may be too high — consider reducing difficulty",
      color: "text-amber-600",
      bg: "bg-amber-500/10 border-amber-500/30",
      badge: "destructive" as const,
    },
    optimal: {
      label: "Optimal Zone",
      sublabel: "Challenge level is appropriate for growth",
      color: "text-emerald-600",
      bg: "bg-emerald-500/10 border-emerald-500/30",
      badge: "secondary" as const,
    },
    over: {
      label: "Above Target",
      sublabel: "Tasks may be too easy — consider increasing difficulty",
      color: "text-blue-600",
      bg: "bg-blue-500/10 border-blue-500/30",
      badge: "secondary" as const,
    },
  };

  const config = zoneConfig[analysis.zone];
  const TrendIcon = analysis.trend === "improving" ? TrendingUp : analysis.trend === "declining" ? TrendingDown : Minus;

  return (
    <Card className={`border ${config.bg}`}>
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            Challenge Level
          </span>
          <Badge variant={config.badge} className="text-xs">
            {config.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="space-y-2">
          {/* Accuracy gauge */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                {/* Band markers */}
                <div className="absolute left-[70%] top-0 h-full w-px bg-border z-10" />
                <div className="absolute left-[85%] top-0 h-full w-px bg-border z-10" />
                {/* Optimal zone highlight */}
                <div className="absolute left-[70%] top-0 h-full bg-emerald-500/20" style={{ width: "15%" }} />
                {/* Current accuracy marker */}
                <div
                  className={`h-full rounded-full transition-all ${
                    analysis.zone === "optimal" ? "bg-emerald-500" : analysis.zone === "under" ? "bg-amber-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${Math.min(analysis.weightedAcc, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>0%</span>
                <span>70%</span>
                <span>85%</span>
                <span>100%</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-xl font-bold ${config.color}`}>{analysis.weightedAcc}%</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendIcon className="w-3 h-3" />
                {analysis.trend}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{config.sublabel}</p>
          <div className="text-[10px] text-muted-foreground">
            Based on {analysis.totalTrials} trials · Target: 70–85%
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
