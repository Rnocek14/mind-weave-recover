/**
 * Strengths & Focus Areas Map — role-aware explainability component.
 * 
 * Shows: what's strong, what needs work, and why the plan targets each area.
 * Designed for 5-second scan speed per card.
 */

import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Target,
  User,
  Bot,
  Sparkles,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { StrengthAreaCard, FocusAreaCard, PlanSummaryStatement } from "@/hooks/useStrengthsAndFocusAreas";

interface StrengthsAndFocusAreasMapProps {
  strengths: StrengthAreaCard[];
  focusAreas: FocusAreaCard[];
  planSummary: PlanSummaryStatement;
  /** 'patient' | 'caregiver' | 'clinician' */
  viewMode?: "patient" | "caregiver" | "clinician";
}

const OUTCOME_SHORT: Record<string, string> = {
  word_mastery: "Words",
  cue_independence: "Independence",
  error_quality: "Accuracy",
};

const ProvenanceIcon = memo(function ProvenanceIcon({
  provenance,
}: {
  provenance: "system" | "clinician" | "mixed" | "default";
}) {
  if (provenance === "default") return null;
  const config = {
    clinician: { Icon: User, label: "Adjusted by your therapist", cls: "text-primary" },
    system: { Icon: Bot, label: "Adjusted automatically based on practice", cls: "text-muted-foreground" },
    mixed: { Icon: Sparkles, label: "Adjusted by therapist and system", cls: "text-primary" },
  };
  const c = config[provenance];
  if (!c) return null;
  const { Icon, label, cls } = c;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger>
          <Icon className={`w-3 h-3 ${cls}`} />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

const StrengthCard = memo(function StrengthCard({
  card,
  viewMode,
}: {
  card: StrengthAreaCard;
  viewMode: string;
}) {
  const isPatient = viewMode === "patient";
  const title = isPatient ? card.patientTitle : card.title;
  const reason = isPatient ? card.patientReason : card.reason;

  return (
    <div className="rounded-md border border-success/30 bg-success/5 p-2.5 space-y-1">
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
        <span className="text-xs font-semibold text-foreground">{title}</span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-tight pl-5">
        {reason}
      </p>
      {viewMode === "clinician" && card.exercises.length > 0 && (
        <p className="text-[11px] text-foreground/70 leading-tight pl-5">
          <span className="text-muted-foreground font-medium">Plan: </span>
          {card.systemPlan}
        </p>
      )}
      {viewMode !== "patient" && (
        <p className="text-[11px] text-foreground/70 leading-tight pl-5">
          <span className="text-muted-foreground font-medium">Supports: </span>
          {card.functionalMeaning}
        </p>
      )}
    </div>
  );
});

const FocusCard = memo(function FocusCard({
  card,
  viewMode,
}: {
  card: FocusAreaCard;
  viewMode: string;
}) {
  const isPatient = viewMode === "patient";
  const isClinician = viewMode === "clinician";
  const title = isPatient ? card.patientTitle : card.title;
  const why = isPatient ? card.patientWhyNeeded : card.whyNeeded;

  return (
    <div className="rounded-md border bg-card p-2.5 space-y-1">
      {/* Row 1: Title + provenance */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Target className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground truncate">{title}</span>
        </div>
        <ProvenanceIcon provenance={card.provenance} />
      </div>

      {/* Row 2: Why needed */}
      <p className="text-[11px] text-muted-foreground leading-tight pl-5">
        {why}
      </p>

      {/* Row 3: Exercises (if any) */}
      {card.exercises.length > 0 && (
        <div className="flex items-start gap-1 pl-5 flex-wrap">
          <span className="text-[11px] text-muted-foreground font-medium shrink-0">
            {isPatient ? "Games:" : "Exercises:"}
          </span>
          {card.exercises.slice(0, 4).map(name => (
            <Badge key={name} variant="secondary" className="text-[9px] h-4 px-1.5">
              {name}
            </Badge>
          ))}
          {card.exercises.length > 4 && (
            <Badge variant="outline" className="text-[9px] h-4 px-1.5">
              +{card.exercises.length - 4}
            </Badge>
          )}
        </div>
      )}

      {/* Row 4: Adaptation (clinician only) */}
      {isClinician && card.activeAdaptation !== "Default settings" && (
        <p className="text-[11px] text-muted-foreground leading-tight pl-5">
          <span className="font-medium">Adaptation: </span>
          {card.activeAdaptation}
        </p>
      )}

      {/* Row 5: Expected gain + outcomes */}
      <div className="flex items-center gap-1.5 pl-5 flex-wrap">
        <TrendingUp className="w-2.5 h-2.5 text-primary/60 shrink-0" />
        <span className="text-[11px] text-foreground/80">
          {isPatient ? "Goal: " : "Expected: "}
          {card.expectedGain}
        </span>
        {isClinician && card.linkedOutcomes.map(o => (
          <Badge key={o} variant="secondary" className="text-[7px] h-3 px-1">
            {OUTCOME_SHORT[o] || o.replace(/_/g, " ")}
          </Badge>
        ))}
      </div>

      {/* Uncovered warning */}
      {card.exercises.length === 0 && (
        <div className="flex items-center gap-1 pl-5">
          <AlertCircle className="w-3 h-3 text-amber-500" />
          <span className="text-[10px] text-amber-600">
            {isPatient ? "Not actively practiced yet" : "No active exercises cover this area"}
          </span>
        </div>
      )}
    </div>
  );
});

export const StrengthsAndFocusAreasMap = memo(function StrengthsAndFocusAreasMap({
  strengths,
  focusAreas,
  planSummary,
  viewMode = "clinician",
}: StrengthsAndFocusAreasMapProps) {
  const isPatient = viewMode === "patient";

  if (strengths.length === 0 && focusAreas.length === 0) {
    return (
      <div className="rounded-md bg-muted/30 p-3 text-center">
        <p className="text-xs text-muted-foreground">
          {isPatient
            ? "Complete a few sessions to see your strengths and focus areas."
            : "Insufficient data to classify strengths and focus areas."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Plan Summary */}
      <div className="rounded-md bg-primary/5 border border-primary/10 p-2.5">
        <p className="text-[12px] text-foreground leading-snug">
          {isPatient ? planSummary.patientVersion : planSummary.emphasis}
        </p>
        {viewMode === "clinician" && planSummary.reasoning && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {planSummary.reasoning}
          </p>
        )}
      </div>

      {/* Focus Areas — shown first because they're the active treatment story */}
      {focusAreas.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Target className="w-3 h-3" />
            {isPatient ? "Working On" : "Focus Areas"} ({focusAreas.length})
          </p>
          <div className="grid gap-1.5">
            {focusAreas.map(card => (
              <FocusCard key={card.id} card={card} viewMode={viewMode} />
            ))}
          </div>
        </div>
      )}

      {/* Strengths */}
      {strengths.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-success" />
            {isPatient ? "Doing Well" : "Strengths"} ({strengths.length})
          </p>
          <div className="grid gap-1.5">
            {strengths.map(card => (
              <StrengthCard key={card.id} card={card} viewMode={viewMode} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
