import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Info } from "lucide-react";
import { useProbeResults } from "@/hooks/useProbeResults";
import { probeErrorLabel } from "@/lib/probeLabels";

interface ProbeResultsCardProps {
  userId: string | undefined;
  profileId?: string | null;
}

/**
 * Session-summary view of the untrained-word generalization probe.
 *
 * Shows the REAL measured signal we collect (independent accuracy, cues needed,
 * reaction time, error type) and is explicitly labelled as a generalization
 * signal — not a validated clinical assessment.
 */
export function ProbeResultsCard({ userId, profileId }: ProbeResultsCardProps) {
  const { loading, hasData, summary } = useProbeResults({
    userId,
    profileId,
    recentLimit: 10,
  });

  if (loading || !hasData) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Untrained-word probe
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-2xl font-bold text-foreground">
              {summary.independentAccuracyPct ?? 0}%
            </p>
            <p className="text-xs text-muted-foreground">Said on your own</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-2xl font-bold text-foreground">
              {summary.avgCuesNeeded ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Avg. hints</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-2xl font-bold text-foreground">
              {summary.avgReactionTimeMs
                ? `${(summary.avgReactionTimeMs / 1000).toFixed(1)}s`
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Avg. time</p>
          </div>
        </div>

        {summary.topErrorType && (
          <p className="text-xs text-muted-foreground">
            Most common slip:{" "}
            <span className="font-medium text-foreground">
              {probeErrorLabel(summary.topErrorType)}
            </span>
          </p>
        )}

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          These are brand-new words you haven't practiced — a check on whether
          progress is carrying over. It's a generalization signal, not a full
          clinical assessment.
        </p>
      </CardContent>
    </Card>
  );
}
