/**
 * WeeklyPlanNarrativeCard — role-aware "Why This Week's Plan" block.
 *
 * Derived from the canonical useSessionPlanReasoning layer.
 * Shows the treatment reasoning chain at the right density for each role.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Compass, ArrowRight, TrendingUp } from "lucide-react";
import type { WeeklyPlanNarrative } from "@/hooks/useSessionPlanReasoning";
import type { UiRole } from "@/lib/roleVocabulary";
import { getFieldLabel, getOutcomeLabel } from "@/lib/roleVocabulary";

interface WeeklyPlanNarrativeCardProps {
  narrative: WeeklyPlanNarrative;
  targetedOutcomes: string[];
  confidence: "high" | "moderate" | "low";
  role: UiRole;
}

export function WeeklyPlanNarrativeCard({
  narrative,
  targetedOutcomes,
  confidence,
  role,
}: WeeklyPlanNarrativeCardProps) {
  // Patient: simple, motivational
  if (role === "patient") {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 pb-3 space-y-2">
          <p className="text-sm font-medium text-foreground">
            {narrative.patientVersion}
          </p>
          {targetedOutcomes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {targetedOutcomes.map((o) => {
                const label = getOutcomeLabel(o, "patient");
                return (
                  <Badge key={o} variant="secondary" className="text-[11px]">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {label.short}
                  </Badge>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Caregiver: explanatory, plain language
  if (role === "caregiver") {
    return (
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Compass className="w-4 h-4 text-primary" />
            Why This Week's Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3 space-y-2">
          <p className="text-sm text-foreground">{narrative.caregiverVersion}</p>
          {narrative.adaptationSummary !== "Default settings active" && (
            <p className="text-xs text-muted-foreground">
              {narrative.adaptationSummary}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Clinician: structured, decision-support density
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Compass className="w-4 h-4 text-primary" />
          Why This Week's Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3 space-y-3">
        {/* Emphasis */}
        <div className="flex items-start gap-2">
          <span className="text-xs font-medium text-muted-foreground w-28 shrink-0 pt-0.5">
            Weekly emphasis
          </span>
          <span className="text-sm font-medium text-foreground">{narrative.emphasis}</span>
        </div>

        {/* Why */}
        <div className="flex items-start gap-2">
          <span className="text-xs font-medium text-muted-foreground w-28 shrink-0 pt-0.5">
            Why it changed
          </span>
          <span className="text-sm text-muted-foreground">{narrative.whyThisWeek}</span>
        </div>

        {/* Adaptations */}
        <div className="flex items-start gap-2">
          <span className="text-xs font-medium text-muted-foreground w-28 shrink-0 pt-0.5">
            Adaptations
          </span>
          <span className="text-sm text-muted-foreground">{narrative.adaptationSummary}</span>
        </div>

        {/* Intended outcomes */}
        <div className="flex items-start gap-2">
          <span className="text-xs font-medium text-muted-foreground w-28 shrink-0 pt-0.5">
            Intended outcomes
          </span>
          <div className="flex flex-wrap gap-1">
            {targetedOutcomes.map((o) => {
              const label = getOutcomeLabel(o, "clinician");
              return (
                <Badge key={o} variant="outline" className="text-[10px]">
                  {label.short}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Confidence */}
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <span className="text-[10px] text-muted-foreground">
            Confidence: {confidence}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
