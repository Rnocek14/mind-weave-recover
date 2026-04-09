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
            Plateau / Regression Analysis
          </CardTitle>
          <CardDescription className="text-xs">Which groups plateau earliest?</CardDescription>
        </CardHeader>
        <CardContent className="pb-3">
          <p className="text-xs text-muted-foreground">Need ≥3 sessions per profile to detect plateaus.</p>
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
          Plateau / Regression Analysis
        </CardTitle>
        <CardDescription className="text-xs">Plateau rate by aphasia type. Plateau = last 3 sessions within 5% range with no improvement.</CardDescription>
      </CardHeader>
      <CardContent className="pb-3 space-y-3">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="group" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Bar dataKey="plateauRate" fill="hsl(var(--chart-4))" name="Plateau Rate %" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {data.filter(r => r.predictors.length > 0).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Plateau Predictors Detected</p>
            <div className="flex flex-wrap gap-1.5">
              {data.filter(r => r.predictors.length > 0).flatMap((r, i) =>
                r.predictors.map((pred, j) => (
                  <Badge key={`${i}-${j}`} variant="destructive" className="text-xs">
                    {r.phenotypeValue}: {pred}
                  </Badge>
                ))
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
