import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Footprints, Timer, Moon, Plus, Pencil } from "lucide-react";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { usePhysicalMetrics } from "@/hooks/usePhysicalMetrics";
import { useProfile } from "@/hooks/useProfile";
import { localYYYYMMDD } from "@/lib/localDate";
import { PhysicalEntryDialog } from "@/components/PhysicalEntryDialog";

export function TodaysActivityCard() {
  const { activeProfile } = useProfile();
  const today = localYYYYMMDD(new Date());
  const { physicalRows, isLoading, refetch } = usePhysicalMetrics(activeProfile?.id, today, today);
  const [showEntry, setShowEntry] = useState(false);

  const todayRow = physicalRows[0] ?? null;
  const hasData = !!todayRow;

  // Build minimal physicalMeta for provenance badge
  const physicalMeta = {
    coverageDays: hasData ? 1 : 0,
    sourcesSeen: hasData ? [todayRow.source] : [],
    lastSyncAtMax: todayRow?.last_sync_at ?? null,
  };

  const metrics = [
    {
      icon: Footprints,
      label: "Steps",
      value: todayRow?.steps ?? "—",
      color: "text-primary",
    },
    {
      icon: Timer,
      label: "Active Min",
      value: todayRow?.active_minutes != null ? Math.round(Number(todayRow.active_minutes)) : "—",
      color: "text-secondary",
    },
    {
      icon: Moon,
      label: "Sleep",
      value: todayRow?.sleep_minutes != null
        ? `${Math.round(Number(todayRow.sleep_minutes) / 60 * 10) / 10}h`
        : "—",
      color: "text-accent",
    },
  ];

  if (isLoading) {
    return (
      <Card className="p-5 animate-pulse">
        <div className="h-5 bg-muted rounded w-1/3 mb-4" />
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-muted rounded" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Today's Activity</h3>
          <div className="flex items-center gap-2">
            <ProvenanceBadge physicalMeta={physicalMeta} />
            <Button
              variant="ghost"
              size="icon"
              aria-label={hasData ? "Edit today's activity" : "Add today's activity"}
              className="h-8 w-8"
              onClick={() => setShowEntry(true)}
            >
              {hasData ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {metrics.map((m) => (
            <div key={m.label} className="text-center space-y-1">
              <m.icon className={`w-5 h-5 mx-auto ${m.color}`} />
              <div className="text-xl font-bold">{m.value}</div>
              <div className="text-xs text-muted-foreground">{m.label}</div>
            </div>
          ))}
        </div>

        {!hasData && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-4"
            onClick={() => setShowEntry(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Log today's activity
          </Button>
        )}
      </Card>

      <PhysicalEntryDialog
        open={showEntry}
        onOpenChange={setShowEntry}
        existingRow={todayRow}
        onSaved={refetch}
      />
    </>
  );
}
