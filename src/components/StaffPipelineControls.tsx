import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  pipelineOpsStats,
  pipelineOpsRequeueStuck,
  pipelineOpsResetFailed,
  pipelineOpsBumpPriority,
  pipelineOpsProcessPending,
} from "@/lib/pipelineOpsClient";
import { RefreshCw, AlertTriangle, Zap, RotateCcw, Play } from "lucide-react";

interface StaffPipelineControlsProps {
  userId: string;
  onRefresh?: () => void;
}

export function StaffPipelineControls({ userId, onRefresh }: StaffPipelineControlsProps) {
  const [busy, setBusy] = useState<null | string>(null);
  const [stuckMin, setStuckMin] = useState(10);
  const [priority, setPriority] = useState(10);
  const [batchSize, setBatchSize] = useState(20);

  const run = async (label: string, fn: () => Promise<any>) => {
    try {
      setBusy(label);
      const res = await fn();
      toast.success(`${label} completed`, { description: JSON.stringify(res) });
      onRefresh?.();
    } catch (e: any) {
      console.error(e);
      toast.error(`${label} failed`, { description: e?.message ?? "Unknown error" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-border/50 bg-muted/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Pipeline Admin Controls
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!!busy}
          onClick={() => run("Refresh stats", () => pipelineOpsStats())}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${busy === "Refresh stats" ? "animate-spin" : ""}`} />
          Refresh stats
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {/* Process via Azure */}
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            className="h-9 w-16"
            min={1}
            max={100}
          />
          <Button
            className="h-9 flex-1"
            variant="default"
            disabled={!!busy}
            onClick={() => run("Process via Azure", () => pipelineOpsProcessPending(batchSize))}
          >
            <Play className={`h-4 w-4 mr-1 ${busy === "Process via Azure" ? "animate-spin" : ""}`} />
            Process via Azure
          </Button>
        </div>

        {/* Requeue stuck */}
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={stuckMin}
            onChange={(e) => setStuckMin(Number(e.target.value))}
            className="h-9 w-16"
            min={1}
            max={60}
          />
          <span className="text-xs text-muted-foreground">min</span>
          <Button
            className="h-9 flex-1"
            variant="secondary"
            disabled={!!busy}
            onClick={() => run("Requeue stuck", () => pipelineOpsRequeueStuck(stuckMin))}
          >
            <RotateCcw className={`h-4 w-4 mr-1 ${busy === "Requeue stuck" ? "animate-spin" : ""}`} />
            Requeue
          </Button>
        </div>

        {/* Bump priority */}
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="h-9 w-16"
            min={1}
            max={100}
          />
          <span className="text-xs text-muted-foreground">prio</span>
          <Button
            className="h-9 flex-1"
            variant="secondary"
            disabled={!!busy}
            onClick={() => run("Bump priority", () => pipelineOpsBumpPriority({ userId, priority }))}
          >
            <Zap className={`h-4 w-4 mr-1 ${busy === "Bump priority" ? "animate-spin" : ""}`} />
            Bump
          </Button>
        </div>

        {/* Reset failed */}
        <Button
          variant="destructive"
          className="h-9"
          disabled={!!busy}
          onClick={() => run("Reset failed", () => pipelineOpsResetFailed())}
        >
          Reset failed
        </Button>
      </div>

      {busy && (
        <div className="mt-2 text-xs text-muted-foreground animate-pulse">
          Running: {busy}…
        </div>
      )}
    </div>
  );
}
