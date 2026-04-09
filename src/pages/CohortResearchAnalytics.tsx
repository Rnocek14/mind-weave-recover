/**
 * Cohort Research Analytics — Admin-only page for cross-patient analysis.
 * Uses phenotype columns, retention snapshots, and functional check-ins.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCohortAnalytics } from "@/hooks/useCohortAnalytics";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { Download, Users, Brain, TrendingUp, ClipboardCheck, Loader2, RefreshCw } from "lucide-react";

const FIELD_LABELS: Record<string, string> = {
  aphasia_type: "Aphasia Type",
  stroke_mechanism_tag: "Stroke Mechanism",
  laterality: "Laterality",
  primary_territory: "Vascular Territory",
  chronicity_tag: "Chronicity",
};

export default function CohortResearchAnalytics() {
  const { phenotypeDistributions, retentionByPhenotype, functionalTrends, isLoading, error, refetch, generateExport } = useCohortAnalytics();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await generateExport();
      if (!rows.length) return;

      const headers = ["Profile ID", "Name", "Aphasia Type", "Laterality", "Chronicity", "Stroke Mechanism", "Sessions", "Trials", "Avg Accuracy %", "Retention Rate %", "Adaptations", "Functional Score %"];
      const csvRows = rows.map((r) =>
        [r.profileId, r.profileName, r.aphasiaType || "", r.laterality || "", r.chronicity || "", r.strokeMechanism || "", r.sessionCount, r.trialCount, r.avgAccuracy ?? "", r.retentionRate ?? "", r.adaptationCount, r.latestFunctionalScore ?? ""].join(",")
      );
      const csv = [headers.join(","), ...csvRows].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cohort-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="container mx-auto max-w-6xl space-y-4">
          <Skeleton className="h-10 w-64" />
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cohort Research Analytics</h1>
            <p className="text-sm text-muted-foreground">Cross-patient analysis powered by structured phenotype data</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refetch} className="gap-1">
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>
            <Button size="sm" onClick={handleExport} disabled={exporting} className="gap-1">
              {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              Export CSV
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        {/* Phenotype Distributions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {phenotypeDistributions.map((dist) => (
            <Card key={dist.field}>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  {FIELD_LABELS[dist.field] || dist.field}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                {dist.counts.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={dist.counts} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="value" tick={{ fontSize: 11 }} width={75} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-muted-foreground">No data yet</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Retention by Phenotype */}
        {retentionByPhenotype.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />
                Retention Rate by Aphasia Type
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={retentionByPhenotype}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="phenotypeValue" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="avgRetentionRate" fill="hsl(var(--primary))" name="Retention %" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2">
                {retentionByPhenotype.map((r) => (
                  <Badge key={r.phenotypeValue} variant="outline" className="text-[10px]">
                    {r.phenotypeValue}: {r.patientCount} patients, {r.wordCount} words
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Functional Outcomes Trend */}
        {functionalTrends.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-primary" />
                Functional Communication Outcomes Over Time
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={functionalTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="checkinDate" tick={{ fontSize: 10 }} />
                  <YAxis domain={[1, 5]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="avgCommunication" stroke="hsl(var(--primary))" name="Needs" dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="avgParticipation" stroke="hsl(var(--chart-2))" name="Participation" dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="avgIndependence" stroke="hsl(var(--chart-3))" name="Independence" dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="avgBurden" stroke="hsl(var(--chart-4))" name="Caregiver Burden" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Data Summary */}
        <Card className="border-border/30">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              Data Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 text-xs text-muted-foreground space-y-1">
            <p>Phenotype fields: {phenotypeDistributions.filter(d => d.counts.some(c => c.value !== "unknown")).length}/5 populated</p>
            <p>Retention records: {retentionByPhenotype.reduce((s, r) => s + r.wordCount, 0)} words tracked</p>
            <p>Functional check-ins: {functionalTrends.reduce((s, f) => s + f.count, 0)} total</p>
            <p className="pt-1 text-[10px]">
              This page queries structured phenotype columns, retention snapshots, and functional check-in data.
              Data accumulates as patients use the system and clinicians record functional assessments.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
