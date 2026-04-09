import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Gamepad2 } from "lucide-react";
import type { GameEffectivenessRow } from "@/hooks/useCohortAnalytics";

interface Props {
  data: GameEffectivenessRow[];
}

export function GameEffectivenessSection({ data }: Props) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-primary" />
            Game Effectiveness by Cohort
          </CardTitle>
          <CardDescription className="text-xs">Which exercises help which patient profiles most?</CardDescription>
        </CardHeader>
        <CardContent className="pb-3">
          <p className="text-xs text-muted-foreground">Not enough trial data yet. Needs ≥3 trials per exercise per phenotype.</p>
        </CardContent>
      </Card>
    );
  }

  // Group by exercise, show top 10
  const exerciseMap = new Map<string, GameEffectivenessRow[]>();
  for (const row of data) {
    if (!exerciseMap.has(row.exerciseSlug)) exerciseMap.set(row.exerciseSlug, []);
    exerciseMap.get(row.exerciseSlug)!.push(row);
  }

  const chartData = Array.from(exerciseMap.entries())
    .slice(0, 10)
    .map(([slug, rows]) => ({
      exercise: slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      avgScore: Math.round(rows.reduce((s, r) => s + r.avgScore, 0) / rows.length * 10) / 10,
      improvement: Math.round(rows.reduce((s, r) => s + (r.improvementSlope ?? 0), 0) / rows.length * 10) / 10,
      trials: rows.reduce((s, r) => s + r.trialCount, 0),
      patients: new Set(rows.flatMap(r => Array(r.patientCount).fill(0))).size || rows.reduce((s, r) => s + r.patientCount, 0),
    }))
    .sort((a, b) => b.improvement - a.improvement);

  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-primary" />
          Game Effectiveness by Cohort
        </CardTitle>
        <CardDescription className="text-xs">Which exercises show the best improvement? Sorted by improvement slope.</CardDescription>
      </CardHeader>
      <CardContent className="pb-3 space-y-3">
        <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 35)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="exercise" tick={{ fontSize: 10 }} width={95} />
            <Tooltip formatter={(v: number, name: string) => [name === "improvement" ? `${v > 0 ? "+" : ""}${v}` : v, name === "improvement" ? "Improvement" : "Avg Score"]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="avgScore" fill="hsl(var(--primary))" name="Avg Score" radius={[0, 4, 4, 0]} />
            <Bar dataKey="improvement" fill="hsl(var(--chart-2))" name="Improvement" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* By phenotype detail */}
        <div className="flex flex-wrap gap-1.5">
          {data.slice(0, 12).map((r, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {r.exerciseSlug}: {r.phenotypeValue} → {r.improvementSlope != null && r.improvementSlope > 0 ? "+" : ""}{r.improvementSlope ?? "?"} ({r.trialCount} trials)
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
