import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts";
import { ClipboardCheck } from "lucide-react";
import type { FunctionalTrend, FunctionalImpactRow } from "@/hooks/useCohortAnalytics";

interface Props {
  trends: FunctionalTrend[];
  impact: FunctionalImpactRow[];
}

export function FunctionalImpactSection({ trends, impact }: Props) {
  const hasData = trends.length > 0 || impact.length > 0;

  if (!hasData) {
    return (
      <Card>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            Functional Impact Analysis
          </CardTitle>
          <CardDescription className="text-xs">Are real-life communication outcomes improving?</CardDescription>
        </CardHeader>
        <CardContent className="pb-3">
          <p className="text-xs text-muted-foreground">No functional check-in data yet. Add check-ins from the Patient Hub.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-primary" />
          Functional Impact Analysis
        </CardTitle>
        <CardDescription className="text-xs">Functional communication outcomes over time + in-app vs. real-life comparison.</CardDescription>
      </CardHeader>
      <CardContent className="pb-3 space-y-4">
        {trends.length > 0 && (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="checkinDate" tick={{ fontSize: 10 }} />
              <YAxis domain={[1, 5]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="avgCommunication" stroke="hsl(var(--primary))" name="Communication" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="avgParticipation" stroke="hsl(var(--chart-2))" name="Participation" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="avgIndependence" stroke="hsl(var(--chart-3))" name="Independence" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="avgBurden" stroke="hsl(var(--chart-4))" name="Caregiver Burden" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}

        {impact.length > 0 && (
          <>
            <p className="text-xs font-medium text-muted-foreground">In-App Accuracy vs. Functional Score by Profile</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={impact}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="phenotypeValue" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="avgInAppAccuracy" fill="hsl(var(--primary))" name="In-App %" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgFunctionalScore" fill="hsl(var(--chart-3))" name="Functional %" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-1.5">
              {impact.map((r, i) => (
                <Badge key={i} variant={r.gap > 20 ? "destructive" : "outline"} className="text-xs">
                  {r.phenotypeValue}: gap {r.gap > 0 ? "+" : ""}{r.gap}% ({r.patientCount} patients)
                  {r.gap > 20 && " ⚠️ improving in-app but not functionally"}
                </Badge>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
