import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Volume2 } from "lucide-react";
import type { CueEffectivenessRow } from "@/hooks/useCohortAnalytics";

interface Props {
  data: CueEffectivenessRow[];
}

export function CueEffectivenessSection({ data }: Props) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-primary" />
            Cue Effectiveness by Cohort
          </CardTitle>
          <CardDescription className="text-xs">Which cue type works best for which profile?</CardDescription>
        </CardHeader>
        <CardContent className="pb-3">
          <p className="text-xs text-muted-foreground">Not enough cue data yet. Needs ≥3 cued trials per type per phenotype.</p>
        </CardContent>
      </Card>
    );
  }

  // Aggregate by cue type across phenotypes
  const byCue = new Map<string, { successes: number; total: number }>();
  for (const r of data) {
    if (!byCue.has(r.cueType)) byCue.set(r.cueType, { successes: 0, total: 0 });
    const c = byCue.get(r.cueType)!;
    c.successes += Math.round(r.immediateSuccessRate * r.trialCount / 100);
    c.total += r.trialCount;
  }

  const chartData = Array.from(byCue.entries()).map(([cueType, c]) => ({
    cueType: cueType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    successRate: c.total > 0 ? Math.round((c.successes / c.total) * 100) : 0,
    trials: c.total,
  })).sort((a, b) => b.successRate - a.successRate);

  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-primary" />
          Cue Effectiveness by Cohort
        </CardTitle>
        <CardDescription className="text-xs">Immediate success rate by cue type. Higher = more effective.</CardDescription>
      </CardHeader>
      <CardContent className="pb-3 space-y-3">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="cueType" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Bar dataKey="successRate" fill="hsl(var(--primary))" name="Success Rate %" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        <div className="flex flex-wrap gap-1.5">
          {data.slice(0, 12).map((r, i) => (
            <Badge key={i} variant="outline" className="text-[10px]">
              {r.cueType} × {r.phenotypeValue}: {r.immediateSuccessRate}% ({r.trialCount} trials)
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
