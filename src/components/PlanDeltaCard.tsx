/**
 * PlanDeltaCard — Shows what changed from the previous plan period.
 *
 * Renders: added exercises, removed exercises, changed adjustments,
 * focus shifts, new/resolved coverage gaps — each with provenance.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUp, ArrowDown, Plus, Minus, RefreshCw, AlertTriangle,
  CheckCircle2, User, Bot, GitCompare,
} from "lucide-react";
import type { PlanDelta } from "@/lib/sessionPlanReasoningV2";
import type { UiRole } from "@/lib/roleVocabulary";

interface PlanDeltaCardProps {
  delta: PlanDelta;
  role: UiRole;
}

function ProvenanceBadge({ provenance }: { provenance: "system" | "clinician" }) {
  return provenance === "clinician" ? (
    <Badge variant="outline" className="text-[9px] h-4 border-primary/30 text-primary shrink-0">
      <User className="w-2 h-2 mr-0.5" />
      Clinician
    </Badge>
  ) : (
    <Badge variant="outline" className="text-[9px] h-4 border-muted-foreground/30 text-muted-foreground shrink-0">
      <Bot className="w-2 h-2 mr-0.5" />
      System
    </Badge>
  );
}

export function PlanDeltaCard({ delta, role }: PlanDeltaCardProps) {
  if (!delta.hasChanges) return null;

  // Patient: very minimal
  if (role === "patient") {
    const hasAdded = delta.addedExercises.length > 0;
    const hasRemoved = delta.removedExercises.length > 0;
    if (!hasAdded && !hasRemoved && delta.changedAdjustments.length === 0) return null;

    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-3 pb-3">
          <p className="text-sm text-foreground">
            {hasAdded && `New exercises added this week: ${delta.addedExercises.map((e) => e.displayName).join(", ")}. `}
            {hasRemoved && `Some exercises rotated out. `}
            {delta.changedAdjustments.length > 0 && "Settings adjusted based on your progress."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const isClinician = role === "clinician";

  return (
    <Card className="border-border">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-primary" />
          {isClinician ? "Plan Changes This Period" : "What Changed This Week"}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3 space-y-3">
        {/* Added exercises */}
        {delta.addedExercises.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide flex items-center gap-1">
              <Plus className="w-3 h-3" /> Added
            </p>
            {delta.addedExercises.map((ex) => (
              <div key={ex.slug} className="flex items-center gap-2 text-xs pl-4">
                <span className="font-medium text-foreground">{ex.displayName}</span>
                <span className="text-muted-foreground">— {ex.reason}</span>
              </div>
            ))}
          </div>
        )}

        {/* Removed exercises */}
        {delta.removedExercises.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-amber-600 uppercase tracking-wide flex items-center gap-1">
              <Minus className="w-3 h-3" /> Removed
            </p>
            {delta.removedExercises.map((ex) => (
              <div key={ex.slug} className="flex items-center gap-2 text-xs pl-4">
                <span className="font-medium text-foreground">{ex.displayName}</span>
                <span className="text-muted-foreground">— {ex.reason}</span>
              </div>
            ))}
          </div>
        )}

        {/* Changed adjustments */}
        {delta.changedAdjustments.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wide flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Adjusted
            </p>
            {delta.changedAdjustments.map((adj, i) => (
              <div key={i} className="flex items-center gap-2 text-xs pl-4">
                <span className="font-medium text-foreground">{adj.type}</span>
                <span className="text-muted-foreground">
                  {adj.before} → {adj.after}
                </span>
                {isClinician && <ProvenanceBadge provenance={adj.provenance} />}
                {isClinician && (
                  <span className="text-muted-foreground/70 text-[10px]">
                    {adj.reason}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Focus shifts */}
        {isClinician && delta.focusShifts.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              Focus Shifts
            </p>
            {delta.focusShifts.map((shift) => (
              <div key={shift.area} className="flex items-center gap-2 text-xs pl-4">
                {shift.direction === "up" ? (
                  <ArrowUp className="w-3 h-3 text-emerald-500" />
                ) : (
                  <ArrowDown className="w-3 h-3 text-amber-500" />
                )}
                <span className="font-medium text-foreground">{shift.areaLabel}</span>
                <span className="text-muted-foreground">{shift.reason}</span>
              </div>
            ))}
          </div>
        )}

        {/* Coverage gaps */}
        {delta.newCoverageGaps.length > 0 && (
          <div className="flex items-start gap-2 text-xs pl-4">
            <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
            <span className="text-muted-foreground">
              New coverage gap{delta.newCoverageGaps.length > 1 ? "s" : ""}:{" "}
              <span className="text-foreground font-medium">
                {delta.newCoverageGaps.join(", ")}
              </span>
            </span>
          </div>
        )}

        {delta.resolvedCoverageGaps.length > 0 && (
          <div className="flex items-start gap-2 text-xs pl-4">
            <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
            <span className="text-muted-foreground">
              Resolved:{" "}
              <span className="text-foreground font-medium">
                {delta.resolvedCoverageGaps.join(", ")}
              </span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
