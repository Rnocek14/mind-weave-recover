import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { localYYYYMMDD } from "@/lib/localDate";
import { toast } from "sonner";
import type { PhysicalRow } from "@/lib/buildSnapshotTimeline";

interface PhysicalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingRow: PhysicalRow | null;
  onSaved: () => void;
}

export function PhysicalEntryDialog({ open, onOpenChange, existingRow, onSaved }: PhysicalEntryDialogProps) {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const [saving, setSaving] = useState(false);

  const [steps, setSteps] = useState("");
  const [activeMinutes, setActiveMinutes] = useState("");
  const [sleepHours, setSleepHours] = useState("");

  useEffect(() => {
    if (open) {
      setSteps(existingRow?.steps?.toString() ?? "");
      setActiveMinutes(existingRow?.active_minutes?.toString() ?? "");
      setSleepHours(
        existingRow?.sleep_minutes != null
          ? (Number(existingRow.sleep_minutes) / 60).toFixed(1)
          : ""
      );
    }
  }, [open, existingRow]);

  const handleSave = async () => {
    if (!user?.id || !activeProfile?.id) return;
    setSaving(true);

    const today = localYYYYMMDD(new Date());
    const payload = {
      user_id: user.id,
      profile_id: activeProfile.id,
      metric_date: today,
      source: "manual" as const,
      steps: steps ? parseInt(steps, 10) : null,
      active_minutes: activeMinutes ? parseFloat(activeMinutes) : null,
      sleep_minutes: sleepHours ? Math.round(parseFloat(sleepHours) * 60) : null,
      workout_minutes: null as number | null,
    };

    const { error } = await (supabase as any)
      .from("physical_daily_metrics")
      .upsert(payload, { onConflict: "profile_id,metric_date,source" });

    setSaving(false);

    if (error) {
      console.error("[PhysicalEntryDialog] save error:", error);
      toast.error("Failed to save activity data");
    } else {
      toast.success("Activity logged!");
      onSaved();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Log Today's Activity</DialogTitle>
          <DialogDescription>
            Quick daily entry — takes 30 seconds
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="steps">Steps</Label>
            <Input
              id="steps"
              type="number"
              min={0}
              max={100000}
              placeholder="e.g. 3200"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="active-min">Active minutes</Label>
            <Input
              id="active-min"
              type="number"
              min={0}
              max={1440}
              placeholder="e.g. 25"
              value={activeMinutes}
              onChange={(e) => setActiveMinutes(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sleep">Sleep (hours)</Label>
            <Input
              id="sleep"
              type="number"
              min={0}
              max={24}
              step={0.5}
              placeholder="e.g. 7.5"
              value={sleepHours}
              onChange={(e) => setSleepHours(e.target.value)}
            />
          </div>

          <Button
            className="w-full bg-gradient-healing hover:opacity-90"
            onClick={handleSave}
            disabled={saving || (!steps && !activeMinutes && !sleepHours)}
          >
            {saving ? "Saving…" : existingRow ? "Update" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
