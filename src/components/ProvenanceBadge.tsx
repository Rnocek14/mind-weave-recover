import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Pencil, Smartphone } from "lucide-react";
import { isSyncStale } from "@/lib/isSyncStale";
import type { PhysicalMeta } from "@/lib/buildSnapshotTimeline";

interface ProvenanceBadgeProps {
  physicalMeta: PhysicalMeta;
  /** Injectable for deterministic tests */
  nowMs?: number;
}

/**
 * Shows "Objective" (device-synced) or "Manual" badge with tooltip.
 * Displays stale warning when last sync > 72h.
 */
export const ProvenanceBadge = memo(function ProvenanceBadge({
  physicalMeta,
  nowMs,
}: ProvenanceBadgeProps) {
  if (physicalMeta.coverageDays === 0) {
    return (
      <div className="flex items-center gap-2 pl-7">
        <Badge variant="outline" className="text-xs gap-1 opacity-50">
          <Pencil className="w-3 h-3" />
          Manual
        </Badge>
        <span className="text-xs text-muted-foreground italic">
          No device connected
        </span>
      </div>
    );
  }

  const stale = isSyncStale(physicalMeta.lastSyncAtMax, nowMs);

  return (
    <div className="flex items-center gap-2 pl-7">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`text-xs gap-1 cursor-help ${stale ? "border-chart-4/60" : ""}`}
            >
              <Smartphone className="w-3 h-3" />
              Objective
              {stale && <AlertCircle className="w-3 h-3 text-chart-4" />}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-64">
            <p>
              Device-synced data (
              {physicalMeta.sourcesSeen.join(", ") || "unknown"})
            </p>
            <p>{physicalMeta.coverageDays}/14 days synced</p>
            {physicalMeta.lastSyncAtMax && (
              <p>
                Last sync:{" "}
                {new Date(physicalMeta.lastSyncAtMax).toLocaleDateString()}
                {stale ? " (stale)" : ""}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <span className="text-xs text-muted-foreground">
        {physicalMeta.coverageDays}/14 days
        {physicalMeta.sourcesSeen.length > 0 &&
          ` · ${physicalMeta.sourcesSeen.join(", ")}`}
        {physicalMeta.lastSyncAtMax &&
          ` · Last sync: ${new Date(physicalMeta.lastSyncAtMax).toLocaleDateString()}${stale ? " (stale)" : ""}`}
      </span>
    </div>
  );
});
