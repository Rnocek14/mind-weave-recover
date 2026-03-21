import { memo, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, HelpCircle } from "lucide-react";
import { HelpLabel } from "@/components/HelpTooltip";
import { useCognitiveState } from "@/hooks/useCognitiveState";
import { useProfile } from "@/hooks/useProfile";
import { useDashboardContext } from "@/hooks/useDashboardContext";

/**
 * Data sufficiency strip: "Domains scored: X/Y, depth-trial sufficiency: ✅/⚠️"
 */
export const DomainConfidenceSummary = memo(function DomainConfidenceSummary() {
  const { userId } = useDashboardContext();
  const { activeProfile } = useProfile();
  const { snapshot, isLoading } = useCognitiveState({
    userId,
    profileId: activeProfile?.id,
  });

  const stats = useMemo(() => {
    if (!snapshot) return null;
    const total = snapshot.domains.length;
    const scored = snapshot.domains.filter((d) => d.trialCount >= 3).length;
    const highConf = snapshot.domains.filter((d) => d.confidence === "high").length;
    const depthDomains = snapshot.domains.filter(
      (d) => d.scoreComponents?.depthTrialCount != null && d.scoreComponents.depthTrialCount >= 2
    ).length;
    const depthTotal = snapshot.domains.filter(
      (d) => d.scoreComponents?.depthTrialCount != null
    ).length;
    return { total, scored, highConf, depthDomains, depthTotal };
  }, [snapshot]);

  if (isLoading || !stats) return null;

  return (
    <Card className="p-3 flex flex-wrap items-center gap-3 text-sm">
      <div className="flex items-center gap-1.5">
        {stats.scored === stats.total ? (
          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
        ) : stats.scored > 0 ? (
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        ) : (
          <HelpCircle className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="text-muted-foreground">Domains scored:</span>
        <Badge variant="outline" className="text-xs tabular-nums">
          {stats.scored}/{stats.total}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">High confidence:</span>
        <Badge
          variant={stats.highConf >= 3 ? "default" : "secondary"}
          className="text-xs tabular-nums"
        >
          {stats.highConf}
        </Badge>
      </div>

      {stats.depthTotal > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Depth data:</span>
          <Badge
            variant={stats.depthDomains >= stats.depthTotal ? "default" : "secondary"}
            className="text-xs tabular-nums"
          >
            {stats.depthDomains}/{stats.depthTotal}
          </Badge>
        </div>
      )}
    </Card>
  );
});
