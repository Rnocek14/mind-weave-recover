import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { deriveMicroFluency, aggregateMicroFluency } from "@/lib/microFluencyAnalyzer";
import { InsightEvidenceBadge } from "@/components/InsightEvidenceBadge";

type Row = {
  alignment_data: any;
  gop_data: any;
  transcript: string | null;
  created_at: string;
};

export function MicroFluencyCard({ userId, daysBack = 7 }: { userId: string; daysBack?: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        const { data, error } = await supabase
          .from("utterance_analyses")
          .select("alignment_data, gop_data, transcript, created_at")
          .eq("user_id", userId)
          .gte("created_at", startDate.toISOString())
          .order("created_at", { ascending: false })
          .limit(200);

        if (error) throw error;
        setRows((data ?? []) as Row[]);
      } catch (e) {
        console.error("MicroFluency fetch failed", e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    if (userId) run();
  }, [userId, daysBack]);

  // Check if we have Azure data (pronunciation assessment) vs MFA alignment data
  const { aggregate, sampleCount, validCount, notesPreview, hasAzureData, azureOnlyCount } = useMemo(() => {
    const analyses = rows.map((r) => deriveMicroFluency(r.alignment_data, r.transcript));
    const agg = aggregateMicroFluency(analyses);

    const notes = analyses
      .flatMap((a) => a.notes ?? [])
      .filter(Boolean)
      .slice(0, 3);

    // Count rows with Azure data but no MFA alignment
    const azureOnly = rows.filter(r => r.gop_data?.source === 'azure' && !r.alignment_data?.word_segments?.length);

    return {
      aggregate: agg,
      sampleCount: analyses.length,
      validCount: agg.validSampleCount,
      notesPreview: notes,
      hasAzureData: rows.some(r => r.gop_data?.source === 'azure'),
      azureOnlyCount: azureOnly.length,
    };
  }, [rows]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Micro-Fluency Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const validRatePct = Math.round((aggregate.validRate ?? 0) * 100);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Micro-Fluency Analysis</CardTitle>
        <InsightEvidenceBadge
          windowLabel={`Last ${daysBack} days`}
          n={validCount}
          confidence={validCount >= 20 ? "high" : validCount >= 10 ? "medium" : "low"}
          evidencePoints={[
            `${validCount}/${sampleCount} aligned samples valid (${validRatePct}%)`,
            "Derived from MFA word/phone segmentation + transcript tokens",
          ]}
        />
      </CardHeader>

      <CardContent>
        {validCount === 0 ? (
          <div className="text-sm text-muted-foreground">
            {hasAzureData ? (
              <>
                <p className="mb-2">
                  <strong>Azure Pronunciation Assessment active</strong> — {azureOnlyCount} utterances analyzed for pronunciation scores.
                </p>
                <p>
                  Micro-fluency analysis (silent/filled pauses, intra-word timing) requires MFA word/phone alignment data, 
                  which Azure does not provide. This card will populate if MFA alignment is enabled alongside Azure.
                </p>
              </>
            ) : (
              <>
                No valid alignment data yet. Once MFA produces alignment_data, this card will populate with 
                silent/filled pause topology and intra-word silence signals.
              </>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="Avg silent pauses" value={`${aggregate.avgSilentPauseCount}`} />
              <Metric label="Avg pause length" value={`${aggregate.avgSilentPauseMs} ms`} />
              <Metric label="Avg pre-word pause" value={`${aggregate.avgPreWordPauseMs} ms`} />
              <Metric label="Avg longest pause" value={`${aggregate.avgLongestPauseMs} ms`} />
              <Metric label="Burst count" value={`${aggregate.avgBurstCount}`} />
              <Metric label="Filled pauses" value={`${aggregate.totalFilledPauses}`} />
              <Metric label="Intra-word pauses" value={`${aggregate.totalIntraWordPauses}`} />
              <Metric label="Valid rate" value={`${validRatePct}%`} />
            </div>

            {notesPreview.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-muted-foreground mb-2">Clinician notes (auto)</div>
                <div className="flex flex-wrap gap-2">
                  {notesPreview.map((n, idx) => (
                    <Badge key={idx} variant="secondary">{n}</Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
