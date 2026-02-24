import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Plus, Check, MessageSquare, Dumbbell, Hand, Brain, Activity } from "lucide-react";
import { toast } from "sonner";
import type { RecoveryDomain } from "@/hooks/useDoseLogs";
import type { DoseLog } from "@/hooks/useDoseLogs";

interface DoseLogEntryProps {
  domains: RecoveryDomain[];
  todayLogs: DoseLog[];
  onSubmit: (data: {
    domain_slug: string;
    dose_value: number;
    intensity_score?: number | null;
    notes?: string | null;
  }) => Promise<any>;
  isSaving?: boolean;
}

const domainIcons: Record<string, React.ElementType> = {
  MessageSquare,
  Dumbbell,
  Hand,
  Brain,
  Activity,
};

// Only show domains relevant for manual logging (not speech — that's auto)
const MANUAL_DOMAINS = ["pt", "ot", "cognitive", "activity"];

export const DoseLogEntry = ({ domains, todayLogs, onSubmit, isSaving }: DoseLogEntryProps) => {
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [minutes, setMinutes] = useState("");
  const [intensity, setIntensity] = useState<number | null>(null);

  const manualDomains = domains.filter((d) => MANUAL_DOMAINS.includes(d.slug));

  const handleSubmit = async () => {
    if (!selectedDomain || !minutes || Number(minutes) <= 0) return;
    
    const result = await onSubmit({
      domain_slug: selectedDomain,
      dose_value: Number(minutes),
      intensity_score: intensity,
    });

    if (result) {
      toast.success("Therapy logged!");
      setSelectedDomain(null);
      setMinutes("");
      setIntensity(null);
    }
  };

  // Get today's total per domain
  const getTodayTotal = (slug: string) =>
    todayLogs
      .filter((l) => l.domain_slug === slug)
      .reduce((sum, l) => sum + Number(l.dose_value), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" />
          Log Today's Therapy
        </CardTitle>
        <CardDescription>
          Track PT, OT, or other exercise. Speech is logged automatically.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Domain chips */}
        <div className="flex flex-wrap gap-2">
          {manualDomains.map((domain) => {
            const Icon = domainIcons[domain.icon_name || "Activity"] || Activity;
            const todayTotal = getTodayTotal(domain.slug);
            const isSelected = selectedDomain === domain.slug;

            return (
              <Button
                key={domain.slug}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDomain(isSelected ? null : domain.slug)}
                className={cn("gap-2", isSelected && "ring-2 ring-primary/30")}
              >
                <Icon className="w-4 h-4" />
                {domain.display_name}
                {todayTotal > 0 && (
                  <Badge variant="secondary" className="text-xs ml-1">
                    {todayTotal}m
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>

        {/* Entry form — shown when domain selected */}
        {selectedDomain && (
          <div className="space-y-3 p-3 rounded-lg border bg-muted/30 animate-fade-in">
            <div className="space-y-1.5">
              <Label htmlFor="dose-minutes" className="text-sm">Minutes</Label>
              <Input
                id="dose-minutes"
                type="number"
                min={1}
                max={240}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="e.g. 30"
                className="max-w-[120px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Intensity (optional)</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((v) => (
                  <Button
                    key={v}
                    variant={intensity === v ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIntensity(v)}
                    className="w-9 h-9 p-0"
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isSaving || !minutes || Number(minutes) <= 0}
              size="sm"
              className="gap-2"
            >
              <Check className="w-4 h-4" />
              {isSaving ? "Saving..." : "Log"}
            </Button>
          </div>
        )}

        {/* Today's summary */}
        {todayLogs.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Today's log</p>
            <div className="flex flex-wrap gap-2">
              {manualDomains.map((d) => {
                const total = getTodayTotal(d.slug);
                if (total === 0) return null;
                return (
                  <Badge key={d.slug} variant="outline" className="text-xs">
                    {d.display_name}: {total} {d.dose_unit}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
