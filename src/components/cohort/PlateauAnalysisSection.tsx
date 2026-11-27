import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingDown } from "lucide-react";
import type { PlateauRow } from "@/hooks/useCohortAnalytics";

interface Props {
  data: PlateauRow[];
}

export function PlateauAnalysisSection({ data }: Props) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-primary" />
            Recent sessions with similar scores
          </CardTitle>
          <CardDescription className="text-xs">Practice scores across three completed observations.</CardDescription>
        </CardHeader>
        <CardContent className="pb-3">
          <p className="text-xs text-muted-foreground">At least three scored sessions are needed.</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map(r => ({
    group: r.phenotypeValue,
    plateauRate: r.plateauRate,
    patients: r.patientCount,
  })).sort((a, b) => b.plateauRate - a.plateauRate);

  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-primary" />
          Recent sessions with similar scores
        </CardTitle>
        <CardDescription className="text-xs">Share of eligible profiles whose last three session credit rates stayed within five percentage points and ended at or below the first.</CardDescription>
      </CardHeader>
      <CardContent className="pb-3 space-y-3">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="group" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Bar dataKey="plateauRate" fill="hsl(var(--chart-4))" name="Similar scores (%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

      </CardContent>
    </Card>
  );
}
