/**
 * Pending Suggestions Panel — shows system-suggested overrides awaiting clinician approval.
 * Implements the human-AI collaboration model: system suggests → clinician approves/rejects.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Check, X } from "lucide-react";
import { approveOverride, rejectOverride } from "@/lib/clinicianQuickActions";
import type { ClinicianOverride } from "@/hooks/useClinicianOverrides";
import { useState } from "react";
import { toast } from "sonner";

interface PendingSuggestionsProps {
  suggestions: ClinicianOverride[];
  userId: string;
  profileId: string;
  clinicianId: string;
  onActionComplete?: () => void;
}

export function PendingSuggestions({
  suggestions,
  userId,
  profileId,
  clinicianId,
  onActionComplete,
}: PendingSuggestionsProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (suggestions.length === 0) return null;

  const ctx = { userId, profileId, clinicianId };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const result = await approveOverride(ctx, id);
      if (result.success) {
        toast.success("Suggestion approved and applied");
        onActionComplete?.();
      } else {
        toast.error(result.message);
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      const result = await rejectOverride(ctx, id);
      if (result.success) {
        toast.info("Suggestion declined");
        onActionComplete?.();
      } else {
        toast.error(result.message);
      }
    } finally {
      setProcessingId(null);
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "difficulty": return "Difficulty";
      case "cue_level": return "Cue Level";
      case "dose_reduction": return "Dose";
      case "practice_assignment": return "Practice";
      default: return type;
    }
  };

  return (
    <Card className="border-amber-500/30 bg-amber-50/5">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Pending Suggestions ({suggestions.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3 space-y-2">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="rounded-lg border border-amber-500/20 bg-background p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs h-5 text-amber-600 border-amber-500/30">
                  {typeLabel(s.overrideType)}
                </Badge>
                {s.targetSlug && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {s.targetSlug}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {s.suggestedBy || "system"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{s.reason}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs gap-1"
                disabled={processingId === s.id}
                onClick={() => handleApprove(s.id)}
              >
                <Check className="h-3 w-3" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                disabled={processingId === s.id}
                onClick={() => handleReject(s.id)}
              >
                <X className="h-3 w-3" />
                Decline
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
