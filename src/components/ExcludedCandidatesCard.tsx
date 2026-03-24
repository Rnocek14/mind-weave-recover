/**
 * ExcludedCandidatesCard — Shows exercises considered but not selected.
 * Clinician-only. Proves the engine is making deliberate prioritization choices.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, FilterX } from "lucide-react";
import type { ExcludedCandidate } from "@/lib/sessionPlanReasoningV2";

interface ExcludedCandidatesCardProps {
  candidates: ExcludedCandidate[];
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  clinical_override: { label: "Clinician excluded", color: "border-primary/40 text-primary" },
  lower_priority: { label: "Lower priority", color: "border-amber-300 text-amber-600" },
  coverage_limit: { label: "Already covered", color: "border-blue-300 text-blue-600" },
  already_strong: { label: "Area strong", color: "border-emerald-300 text-emerald-600" },
  fatigue_risk: { label: "Fatigue risk", color: "border-red-300 text-red-600" },
  not_needed: { label: "Not aligned", color: "border-muted text-muted-foreground" },
  insufficient_readiness: { label: "Not ready", color: "border-muted text-muted-foreground" },
};

export function ExcludedCandidatesCard({ candidates }: ExcludedCandidatesCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Only show relevant exclusions (not "not_needed")
  const relevant = candidates.filter((c) => c.category !== "not_needed");
  if (relevant.length === 0) return null;

  const shown = expanded ? relevant : relevant.slice(0, 4);

  return (
    <Card className="border-border">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FilterX className="w-4 h-4 text-muted-foreground" />
          Not Selected This Period
          <Badge variant="secondary" className="text-[10px] ml-1">
            {relevant.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3 space-y-1.5">
        {shown.map((c) => {
          const cat = CATEGORY_LABELS[c.category] || CATEGORY_LABELS.not_needed;
          return (
            <div key={c.slug} className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className={`text-[9px] h-4 shrink-0 ${cat.color}`}>
                {cat.label}
              </Badge>
              <span className="font-medium text-foreground shrink-0">{c.displayName}</span>
              <span className="text-muted-foreground truncate">{c.reason}</span>
            </div>
          );
        })}

        {relevant.length > 4 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-6 px-2 text-muted-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3 h-3 mr-1" /> Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 mr-1" /> {relevant.length - 4} more
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
