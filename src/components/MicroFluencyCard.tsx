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
  const { aggregate, sampleCount, validCount, notesPreview, hasAzureData, azureWithAlignment, isSingleWordContext, debugInfo } = useMemo(() => {
    // Debug: Log each row's alignment data
    const debugRows: Array<{ target: string; words: number; phones: number; alignmentOk: boolean; reason?: string }> = [];
    
    const analyses = rows.map((r) => {
      const analysis = deriveMicroFluency(r.alignment_data, r.transcript);
      
      // Collect debug info
      const wordCount = r.alignment_data?.word_segments?.length ?? 0;
      const phoneCount = r.alignment_data?.phone_segments?.length ?? 0;
      debugRows.push({
        target: r.transcript ?? 'unknown',
        words: wordCount,
        phones: phoneCount,
        alignmentOk: analysis.quality.alignmentOk,
        reason: analysis.quality.reason,
      });
      
      return analysis;
    });
    
    // Log debug info
    console.log('[MicroFluency] Analysis results:', debugRows);
    console.log('[MicroFluency] Summary:', {
      total: debugRows.length,
      passing: debugRows.filter(d => d.alignmentOk).length,
      failing: debugRows.filter(d => !d.alignmentOk).map(d => ({ target: d.target, reason: d.reason })),
    });
    
    const agg = aggregateMicroFluency(analyses);

    const notes = analyses
      .flatMap((a) => a.notes ?? [])
      .filter(Boolean)
      .slice(0, 3);

    // Count rows with Azure data that have alignment
    const withAlignment = rows.filter(r => 
      r.gop_data?.source === 'azure' && 
      r.alignment_data?.word_segments?.length > 0
    );
    
    // Count rows with sufficient phonemes (2+ for single word)
    const withSufficientPhonemes = rows.filter(r => 
      (r.alignment_data?.phone_segments?.length ?? 0) >= 2
    );
    
    // Check if most utterances are single-word (Photo Naming context)
    const singleWordCount = rows.filter(r => 
      r.alignment_data?.word_segments?.length === 1
    ).length;

    return {
      aggregate: agg,
      sampleCount: analyses.length,
      validCount: agg.validSampleCount,
      notesPreview: notes,
      hasAzureData: rows.some(r => r.gop_data?.source === 'azure'),
      azureWithAlignment: withAlignment.length,
      isSingleWordContext: singleWordCount > rows.length / 2,
      debugInfo: {
        withAlignment: withAlignment.length,
        withSufficientPhonemes: withSufficientPhonemes.length,
        singleWordCount,
        failingRows: debugRows.filter(d => !d.alignmentOk),
      },
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
          <div className="text-sm text-muted-foreground space-y-3">
            {/* Debug info panel */}
            <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
              <div className="font-semibold text-foreground">Debug Info:</div>
              <div>Total utterances: {sampleCount}</div>
              <div>With Azure alignment: {debugInfo.withAlignment}</div>
              <div>With 2+ phonemes: {debugInfo.withSufficientPhonemes}</div>
              <div>Single-word: {debugInfo.singleWordCount}</div>
              <div>Passing quality gate: {validCount}</div>
              {debugInfo.failingRows.length > 0 && (
                <div className="mt-2">
                  <div className="font-semibold">Failing rows:</div>
                  {debugInfo.failingRows.slice(0, 5).map((r, i) => (
                    <div key={i} className="ml-2">• "{r.target}": {r.words}w/{r.phones}ph - {r.reason}</div>
                  ))}
                </div>
              )}
            </div>
            
            {hasAzureData && azureWithAlignment > 0 ? (
              <>
                <p>
                  <strong>Azure alignment data available</strong> — {azureWithAlignment} utterances have phoneme timing.
                </p>
                <p>
                  {isSingleWordContext 
                    ? "Single-word exercises (Photo Naming) have limited inter-word pause data. Intra-word and phoneme timing metrics will show once enough samples accumulate."
                    : "Micro-fluency metrics will populate once quality checks pass (minimum phoneme count, speech ratio)."}
                </p>
              </>
            ) : hasAzureData ? (
              <>
                <p>
                  <strong>Azure Pronunciation Assessment active</strong> — collecting phoneme timing data.
                </p>
                <p>
                  Complete a few more voice trials to accumulate alignment data for micro-fluency analysis.
                </p>
              </>
            ) : (
              <>
                No alignment data yet. Complete voice trials with pronunciation assessment enabled 
                to populate micro-fluency metrics.
              </>
            )}
          </div>
        ) : (
          <>
            {isSingleWordContext ? (
              // Single-word context: Focus on intra-word metrics
              <div className="grid gap-3 md:grid-cols-3">
                <Metric label="Intra-word pauses" value={`${aggregate.totalIntraWordPauses}`} hint="Silence within word (apraxia signal)" />
                <Metric label="Filled pauses" value={`${aggregate.totalFilledPauses}`} hint="um, uh, etc." />
                <Metric label="Valid samples" value={`${validCount}/${sampleCount}`} hint={`${validRatePct}% pass quality check`} />
              </div>
            ) : (
              // Multi-word context: Full micro-fluency metrics
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
            )}

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

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground/70 mt-0.5">{hint}</div>}
    </div>
  );
}
