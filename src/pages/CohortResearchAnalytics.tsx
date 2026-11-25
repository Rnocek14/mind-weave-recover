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
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import { GameEffectivenessSection } from "@/components/cohort/GameEffectivenessSection";
import { CueEffectivenessSection } from "@/components/cohort/CueEffectivenessSection";
import { RetentionCarryoverSection } from "@/components/cohort/RetentionCarryoverSection";
import { PlateauAnalysisSection } from "@/components/cohort/PlateauAnalysisSection";
import { FunctionalImpactSection } from "@/components/cohort/FunctionalImpactSection";
import { AdaptationEffectivenessSection } from "@/components/cohort/AdaptationEffectivenessSection";
import { DataReadinessAccordion } from "@/components/cohort/DataReadinessAccordion";
import type { CohortDimension } from "@/lib/clinical/pairedGamePractice";
import { DataSufficiencyBar, coverageFields } from "@/components/cohort/DataSufficiencyBar";

export default function CohortResearchAnalytics() {
  const navigate = useNavigate();
  const [dimension, setDimension] = useState<CohortDimension>("stroke_mechanism_tag");
  const {
    phenotypeDistributions,
    gamePractice,
    cueEffectiveness,
    retentionByCohort,
    retentionByExercise,
    plateauData,
    functionalTrends,
    adaptationEffectiveness,
    isLoading,
    error,
    refetch,
    coverage,
  } = useCohortAnalytics(dimension);

  const totals = coverage && {
    ...coverage,
    retentionWordCount: retentionByCohort.reduce((n, row) => n + row.totalWords, 0),
    functionalCheckinCount: functionalTrends.reduce((n, day) => n + day.count, 0),
  };

  const handleExport = () => {
    if (!totals || error) return;
    const fields = coverageFields(totals);
    const csv = [fields.map(([name]) => name).join(","), fields.map(([,n]) => n).join(",")].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `cohort-coverage-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background py-8 px-4">
        <div className="container mx-auto max-w-6xl space-y-4">
          <Skeleton className="h-10 w-64" />
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background py-8 px-4">
      <div className="container mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Go back" onClick={() => navigate(-1)} className="shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Cohort Research Analytics</h1>
              <p className="text-sm text-muted-foreground">Review recorded practice across patient profiles.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refetch} className="gap-1">
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>
            <Button size="sm" onClick={handleExport} disabled={!!error || !totals} className="gap-1">
              <Download className="w-3 h-3" />
              Export coverage CSV
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        {/* Data Sufficiency Indicator */}
        {totals && !error && <>
        <DataSufficiencyBar {...totals} />
        <p className="text-xs text-muted-foreground">The coverage CSV contains program totals. For subject-level study extracts, <a className="underline" href="/admin/research-export">open Research Export</a>.</p>
        <GameEffectivenessSection rows={gamePractice} dimension={dimension} onDimension={setDimension} />
        <FunctionalImpactSection trends={functionalTrends} />
        <details className="space-y-4 rounded-lg border p-4"><summary className="cursor-pointer font-medium">Supporting practice measures</summary>

        {/* 2. Cue Effectiveness */}
        <CueEffectivenessSection data={cueEffectiveness} />

        {/* 3. Retention / Carryover */}
        <RetentionCarryoverSection byCohort={retentionByCohort} byExercise={retentionByExercise} />

        {/* 4. Plateau / Regression */}
        <PlateauAnalysisSection data={plateauData} />

        {/* 6. Adaptation Effectiveness */}
        <AdaptationEffectivenessSection data={adaptationEffectiveness} />

        {/* Data Readiness (collapsed) */}
        <DataReadinessAccordion
          phenotypeDistributions={phenotypeDistributions}
          retentionByCohort={retentionByCohort}
          functionalTrends={functionalTrends}
        />
        </details>
        </>}
      </div>
    </div>
  );
}
