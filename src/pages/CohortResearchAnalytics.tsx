/**
 * Cohort Research Analytics — question-answering analytics page for cross-patient research.
 * 6 analytics sections + Data Readiness accordion.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCohortAnalytics } from "@/hooks/useCohortAnalytics";
import { ArrowLeft, Download, Loader2, RefreshCw } from "lucide-react";
import { GameEffectivenessSection } from "@/components/cohort/GameEffectivenessSection";
import { CueEffectivenessSection } from "@/components/cohort/CueEffectivenessSection";
import { RetentionCarryoverSection } from "@/components/cohort/RetentionCarryoverSection";
import { PlateauAnalysisSection } from "@/components/cohort/PlateauAnalysisSection";
import { FunctionalImpactSection } from "@/components/cohort/FunctionalImpactSection";
import { AdaptationEffectivenessSection } from "@/components/cohort/AdaptationEffectivenessSection";
import { DataReadinessAccordion } from "@/components/cohort/DataReadinessAccordion";
import { DataSufficiencyBar } from "@/components/cohort/DataSufficiencyBar";

export default function CohortResearchAnalytics() {
  const navigate = useNavigate();
  const {
    phenotypeDistributions,
    gameEffectiveness,
    cueEffectiveness,
    retentionByCohort,
    retentionByExercise,
    plateauData,
    functionalTrends,
    functionalImpact,
    adaptationEffectiveness,
    isLoading,
    error,
    refetch,
    generateExport,
  } = useCohortAnalytics();

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await generateExport();
      if (!rows.length) return;
      // De-identify: research exports must NOT carry patient names or the raw
      // profile UUID (a stable, re-identifiable key). Emit a deterministic
      // pseudonymous subject code instead.
      const pseudonym = (id: string) => {
        let h = 0;
        for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
        return "S" + Math.abs(h).toString(36).toUpperCase().padStart(6, "0");
      };
      const headers = ["Subject", "Aphasia Type", "Laterality", "Chronicity", "Stroke Mechanism", "Sessions", "Trials", "Avg Accuracy %", "Retention Rate %", "Adaptations", "Functional Score %"];
      const csvRows = rows.map((r) =>
        [pseudonym(r.profileId), r.aphasiaType || "", r.laterality || "", r.chronicity || "", r.strokeMechanism || "", r.sessionCount, r.trialCount, r.avgAccuracy ?? "", r.retentionRate ?? "", r.adaptationCount, r.latestFunctionalScore ?? ""].join(",")
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
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Go back" onClick={() => navigate(-1)} className="shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Cohort Research Analytics</h1>
              <p className="text-sm text-muted-foreground">Discover what works for whom — cross-patient clinical intelligence</p>
            </div>
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

        {/* Data Sufficiency Indicator */}
        <DataSufficiencyBar
          patientCount={phenotypeDistributions[0]?.counts.reduce((s, c) => s + c.count, 0) || 0}
          sessionCount={gameEffectiveness.reduce((s, r) => s + r.trialCount, 0)}
          trialCount={gameEffectiveness.reduce((s, r) => s + r.trialCount, 0)}
          retentionWordCount={retentionByCohort.reduce((s, r) => s + r.totalWords, 0)}
          functionalCheckinCount={functionalTrends.reduce((s, f) => s + f.count, 0)}
        />

        {/* 1. Game Effectiveness */}
        <GameEffectivenessSection data={gameEffectiveness} />

        {/* 2. Cue Effectiveness */}
        <CueEffectivenessSection data={cueEffectiveness} />

        {/* 3. Retention / Carryover */}
        <RetentionCarryoverSection byCohort={retentionByCohort} byExercise={retentionByExercise} />

        {/* 4. Plateau / Regression */}
        <PlateauAnalysisSection data={plateauData} />

        {/* 5. Functional Impact */}
        <FunctionalImpactSection trends={functionalTrends} impact={functionalImpact} />

        {/* 6. Adaptation Effectiveness */}
        <AdaptationEffectivenessSection data={adaptationEffectiveness} />

        {/* Data Readiness (collapsed) */}
        <DataReadinessAccordion
          phenotypeDistributions={phenotypeDistributions}
          retentionByCohort={retentionByCohort}
          functionalTrends={functionalTrends}
        />
      </div>
    </div>
  );
}
