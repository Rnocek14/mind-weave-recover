import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Brain } from "lucide-react";
import type { RetentionCohortRow, RetentionByExercise } from "@/hooks/useCohortAnalytics";

interface Props {
  byCohort: RetentionCohortRow[];
  byExercise: RetentionByExercise[];
}

export function RetentionCarryoverSection({ byCohort, byExercise }: Props) {
  const hasData = byCohort.length > 0 || byExercise.length > 0;

  if (!hasData) {
    return (
      <Card>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            Retention / Carryover by Cohort
          </CardTitle>
          <CardDescription className="text-xs">What actually sticks?</CardDescription>
        </CardHeader>
        <CardContent className="pb-3">
          <p className="text-xs text-muted-foreground">No retention snapshot data yet. Data populates as sessions complete.</p>
        </CardContent>
      </Card>
    );
  }

  const cohortChart = byCohort.map(r => ({
    group: r.phenotypeValue,
    retained: r.retainedWords,
    weak: r.weakWords,
    lost: r.lostWords,
    rate: r.retentionRate,
  }));

  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          Retention / Carryover by Cohort
        </CardTitle>
        <CardDescription className="text-xs">Retained (score ≥4) vs. weak (2-3) vs. lost (&lt;2) words by aphasia type.</CardDescription>
      </CardHeader>
      <CardContent className="pb-3 space-y-4">
        {cohortChart.length > 0 && (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cohortChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="group" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="retained" stackId="a" fill="hsl(var(--chart-2))" name="Retained" />
              <Bar dataKey="weak" stackId="a" fill="hsl(var(--chart-4))" name="Weak" />
              <Bar dataKey="lost" stackId="a" fill="hsl(var(--destructive))" name="Lost" />
            </BarChart>
          </ResponsiveContainer>
        )}

        {byExercise.length > 0 && (
          <>
            <p className="text-xs font-medium text-muted-foreground">Retention by Topic/Category</p>
            <div className="flex flex-wrap gap-1.5">
              {byExercise.map((r, i) => (
                <Badge key={i} variant={r.retentionRate >= 50 ? "default" : "outline"} className="text-xs">
                  {r.exerciseSlug}: {r.retentionRate}% ({r.retainedWords}/{r.totalWords})
                </Badge>
              ))}
            </div>
          </>
        )}

        <div className="flex flex-wrap gap-1.5">
          {byCohort.map((r, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {r.phenotypeValue}: {r.retentionRate}% retention ({r.patientCount} patients, {r.totalWords} words)
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
