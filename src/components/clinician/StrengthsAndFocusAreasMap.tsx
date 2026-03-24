/**
 * Strengths & Focus Areas Map — role-aware explainability component.
 * 
 * Three-tier classification:
 * - Strengths (evidence-backed positive areas)
 * - Maintained (not a problem, but not proven strong)
 * - Focus Areas (actively targeted needs)
 * - Uncovered (deficit without exercise coverage)
 * 
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
  Eye,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  StrengthAreaCard,
  FocusAreaCard,
  PlanSummaryStatement,
  EvidenceTag,
} from "@/hooks/useStrengthsAndFocusAreas";

interface StrengthsAndFocusAreasMapProps {
  strengths: StrengthAreaCard[];
  focusAreas: FocusAreaCard[];
  planSummary: PlanSummaryStatement;
  viewMode?: "patient" | "caregiver" | "clinician";
}

const OUTCOME_LABELS: Record<string, { short: string; full: string }> = {
  word_mastery: { short: "Words", full: "Word Mastery" },
  cue_independence: { short: "Independence", full: "Cue Independence" },
  error_quality: { short: "Accuracy", full: "Error Quality" },
};

const EvidenceTags = memo(function EvidenceTags({ tags }: { tags: EvidenceTag[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex items-center gap-1 pl-5">
      <Info className="w-2.5 h-2.5 text-muted-foreground/50 shrink-0" />
      <span className="text-[10px] text-muted-foreground/70">
        Based on: {tags.map(t => t.label).join(" + ")}
      </span>
    </div>
  );
});

const ProvenanceIcon = memo(function ProvenanceIcon({
  provenance,
  viewMode,
}: {
  provenance: "system" | "clinician" | "mixed" | "default";
  viewMode: string;
}) {
  if (provenance === "default") return null;
  const isPatient = viewMode === "patient" || viewMode === "caregiver";
  
  const config = {
    clinician: {
      Icon: User,
      label: isPatient ? "Adjusted by your therapist" : "Clinician override",
      cls: "text-primary",
    },
    system: {
      Icon: Bot,
      label: isPatient ? "Adjusted automatically based on practice" : "System adaptation",
      cls: "text-muted-foreground",
    },
    mixed: {
      Icon: Sparkles,
      label: isPatient ? "Adjusted by therapist and system" : "Clinician + system",
      cls: "text-primary",
    },
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

const OutcomeChips = memo(function OutcomeChips({
  outcomes,
  viewMode,
}: {
  outcomes: string[];
  viewMode: string;
}) {
  if (outcomes.length === 0) return null;
  const isPatient = viewMode === "patient";
  
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {outcomes.map(o => {
        const labels = OUTCOME_LABELS[o];
        if (!labels) return null;
        return (
          <TooltipProvider key={o} delayDuration={200}>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="secondary" className="text-[7px] h-3 px-1 cursor-help">
                  {isPatient ? labels.short : labels.full}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[200px]">
                {o === "word_mastery" && "Words reliably retrieved without help"}
                {o === "cue_independence" && "Less support needed over time"}
                {o === "error_quality" && "Responses getting closer to correct"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
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
  const isClinician = viewMode === "clinician";
  const title = isPatient ? card.patientTitle : card.title;
  const reason = isPatient ? card.patientReason : card.reason;
  const isMaintained = card.classification === "maintained";

  const borderClass = isMaintained
    ? "border-muted-foreground/20 bg-muted/5"
    : "border-success/30 bg-success/5";
  const IconComponent = isMaintained ? Eye : CheckCircle2;
  const iconClass = isMaintained ? "text-muted-foreground" : "text-success";

  return (
    <div className={`rounded-md border ${borderClass} p-2.5 space-y-1`}>
      <div className="flex items-center gap-1.5">
        <IconComponent className={`w-3.5 h-3.5 ${iconClass} shrink-0`} />
        <span className="text-xs font-semibold text-foreground">{title}</span>
        {isMaintained && !isPatient && (
          <Badge variant="outline" className="text-[8px] h-3.5 px-1 text-muted-foreground">
            Monitoring
          </Badge>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground leading-tight pl-5">
        {reason}
      </p>
      {isClinician && card.exercises.length > 0 && (
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
      {/* Outcome linkage */}
      {card.linkedOutcomes.length > 0 && (
        <div className="pl-5">
          <OutcomeChips outcomes={card.linkedOutcomes} viewMode={viewMode} />
        </div>
      )}
      {/* Evidence tags (clinician only) */}
      {isClinician && <EvidenceTags tags={card.evidence} />}
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
  const isUncovered = card.classification === "uncovered";

  return (
    <div className={`rounded-md border bg-card p-2.5 space-y-1 ${isUncovered ? "border-amber-200/50" : ""}`}>
      {/* Row 1: Title + provenance */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Target className={`w-3.5 h-3.5 shrink-0 ${isUncovered ? "text-amber-500" : "text-primary"}`} />
          <span className="text-xs font-semibold text-foreground truncate">{title}</span>
          {isUncovered && !isPatient && (
            <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-amber-300 text-amber-600">
              Gap
            </Badge>
          )}
        </div>
        <ProvenanceIcon provenance={card.provenance} viewMode={viewMode} />
      </div>

      {/* Row 2: Why needed */}
      <p className="text-[11px] text-muted-foreground leading-tight pl-5">
        {why}
      </p>

      {/* Row 3: Clinician signal (clinician only, concrete) */}
      {isClinician && card.clinicianSignal && (
        <p className="text-[11px] text-foreground/80 leading-tight pl-5 italic">
          {card.clinicianSignal}
        </p>
      )}

      {/* Row 4: Exercises */}
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

      {/* Row 5: Adaptation (clinician only) */}
      {isClinician && card.activeAdaptation !== "Default settings" && (
        <p className="text-[11px] text-muted-foreground leading-tight pl-5">
          <span className="font-medium">Adaptation: </span>
          {card.activeAdaptation}
        </p>
      )}

      {/* Row 6: Expected gain + outcome chips */}
      <div className="flex items-center gap-1.5 pl-5 flex-wrap">
        <TrendingUp className="w-2.5 h-2.5 text-primary/60 shrink-0" />
        <span className="text-[11px] text-foreground/80">
          {isPatient ? "Goal: " : "Expected: "}
          {card.expectedGain}
        </span>
        <OutcomeChips outcomes={card.linkedOutcomes} viewMode={viewMode} />
      </div>

      {/* Uncovered warning */}
      {isUncovered && (
        <div className="flex items-center gap-1 pl-5">
          <AlertCircle className="w-3 h-3 text-amber-500" />
          <span className="text-[10px] text-amber-600">
            {isPatient ? "Not actively practiced yet" : "No active exercises cover this area"}
          </span>
        </div>
      )}

      {/* Evidence tags (clinician only) */}
      {isClinician && <EvidenceTags tags={card.evidence} />}
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
  const confirmedStrengths = strengths.filter(s => s.classification === "strength");
  const maintainedAreas = strengths.filter(s => s.classification === "maintained");
  const activeFocus = focusAreas.filter(f => f.classification === "focus");
  const uncoveredAreas = focusAreas.filter(f => f.classification === "uncovered");

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

      {/* Focus Areas — active treatment targets */}
      {activeFocus.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Target className="w-3 h-3" />
            {isPatient ? "Working On" : "Focus Areas"} ({activeFocus.length})
          </p>
          <div className="grid gap-1.5">
            {activeFocus.map(card => (
              <FocusCard key={card.id} card={card} viewMode={viewMode} />
            ))}
          </div>
        </div>
      )}

      {/* Strengths — evidence-backed positive areas */}
      {confirmedStrengths.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-success" />
            {isPatient ? "Doing Well" : "Strengths"} ({confirmedStrengths.length})
          </p>
          <div className="grid gap-1.5">
            {confirmedStrengths.map(card => (
              <StrengthCard key={card.id} card={card} viewMode={viewMode} />
            ))}
          </div>
        </div>
      )}

      {/* Maintained / Monitored — not a problem, not proven strong */}
      {maintainedAreas.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Eye className="w-3 h-3" />
            {isPatient ? "Practicing" : "Monitored"} ({maintainedAreas.length})
          </p>
          <div className="grid gap-1.5">
            {maintainedAreas.map(card => (
              <StrengthCard key={card.id} card={card} viewMode={viewMode} />
            ))}
          </div>
        </div>
      )}

      {/* Uncovered deficits — clinician/caregiver only */}
      {uncoveredAreas.length > 0 && viewMode !== "patient" && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3 text-amber-500" />
            Coverage Gaps ({uncoveredAreas.length})
          </p>
          <div className="grid gap-1.5">
            {uncoveredAreas.map(card => (
              <FocusCard key={card.id} card={card} viewMode={viewMode} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
