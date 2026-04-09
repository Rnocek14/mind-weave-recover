import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Settings2 } from "lucide-react";
import type { AdaptationEffectivenessRow } from "@/hooks/useCohortAnalytics";

interface Props {
  data: AdaptationEffectivenessRow[];
}

export function AdaptationEffectivenessSection({ data }: Props) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            Adaptation Effectiveness
          </CardTitle>
          <CardDescription className="text-xs">Which adaptations help most by cohort?</CardDescription>
        </CardHeader>
        <CardContent className="pb-3">
          <p className="text-xs text-muted-foreground">Not enough adaptation event data yet.</p>
        </CardContent>
      </Card>
    );
  }

  // Group by adaptation type
  const byType = new Map<string, { fires: number; patients: Set<string> }>();
  for (const r of data) {
    if (!byType.has(r.adaptationType)) byType.set(r.adaptationType, { fires: 0, patients: new Set() });
    const g = byType.get(r.adaptationType)!;
    g.fires += r.fireCount;
    // approximate unique patients
  }

  const chartData = Array.from(byType.entries())
    .map(([type, g]) => ({
      type: type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      fires: g.fires,
    }))
    .sort((a, b) => b.fires - a.fires)
    .slice(0, 10);

  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          Adaptation Effectiveness
        </CardTitle>
        <CardDescription className="text-xs">Most fired adaptation strategies and their cohort distribution.</CardDescription>
      </CardHeader>
      <CardContent className="pb-3 space-y-3">
        <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 30)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 120 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="type" tick={{ fontSize: 10 }} width={115} />
            <Tooltip />
            <Bar dataKey="fires" fill="hsl(var(--primary))" name="Times Fired" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>

        <div className="flex flex-wrap gap-1.5">
          {data.slice(0, 15).map((r, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {r.adaptationType} × {r.phenotypeValue}: {r.fireCount}× ({r.avgConfidence} confidence)
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
