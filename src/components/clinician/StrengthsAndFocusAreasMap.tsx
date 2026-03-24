/**
 * Strengths & Focus Areas Map — role-aware explainability component.
 * 
 * Uses centralized roleVocabulary for all labels.
 * Shows confidence, global adjustments, and actionable gap suggestions.
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
  SlidersHorizontal,
  Lightbulb,
  Shield,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getSectionLabel,
  getConfidenceLabel,
  getProvenanceLabel,
  getOutcomeLabel,
  getGapActionText,
  type UiRole,
  type ConfidenceLevel,
} from "@/lib/roleVocabulary";
import type {
  StrengthAreaCard,
  FocusAreaCard,
  PlanSummaryStatement,
  EvidenceTag,
  GlobalAdjustment,
} from "@/hooks/useStrengthsAndFocusAreas";

interface StrengthsAndFocusAreasMapProps {
  strengths: StrengthAreaCard[];
  focusAreas: FocusAreaCard[];
  planSummary: PlanSummaryStatement;
  viewMode?: "patient" | "caregiver" | "clinician";
  globalAdjustments?: GlobalAdjustment[];
}

// ─── Sub-components ───

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

const ConfidenceBadge = memo(function ConfidenceBadge({
  level,
  role,
}: {
  level: ConfidenceLevel;
  role: UiRole;
}) {
  if (role === "patient") return null;

  const colorMap: Record<ConfidenceLevel, string> = {
    high: "border-success/40 text-success",
    moderate: "border-muted-foreground/30 text-muted-foreground",
    low: "border-amber-300/50 text-amber-600",
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className={`text-[7px] h-3.5 px-1 ${colorMap[level]}`}>
            <Shield className="w-2 h-2 mr-0.5" />
            {role === "clinician" ? level.charAt(0).toUpperCase() : getConfidenceLabel(level, role).split(" ")[0]}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {getConfidenceLabel(level, role)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

const ProvenanceIcon = memo(function ProvenanceIcon({
  provenance,
  role,
}: {
  provenance: "system" | "clinician" | "mixed" | "default";
  role: UiRole;
}) {
  if (provenance === "default") return null;
  const label = getProvenanceLabel(provenance, role);
  if (!label) return null;

  const config = {
    clinician: { Icon: User, cls: "text-primary" },
    system: { Icon: Bot, cls: "text-muted-foreground" },
    mixed: { Icon: Sparkles, cls: "text-primary" },
  };
  const c = config[provenance];
  if (!c) return null;
  const { Icon, cls } = c;
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
  role,
}: {
  outcomes: string[];
  role: UiRole;
}) {
  if (outcomes.length === 0) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {outcomes.map(o => {
        const labels = getOutcomeLabel(o, role);
        return (
          <TooltipProvider key={o} delayDuration={200}>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="secondary" className="text-[7px] h-3 px-1 cursor-help">
                  {role === "patient" ? labels.short : labels.full}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[200px]">
                {labels.tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
});

const GlobalAdjustmentsBar = memo(function GlobalAdjustmentsBar({
  adjustments,
  role,
}: {
  adjustments: GlobalAdjustment[];
  role: UiRole;
}) {
  if (adjustments.length === 0 || role === "patient") return null;

  return (
    <div className="rounded-md bg-muted/30 border border-border/50 p-2 flex items-center gap-3 flex-wrap">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
        <SlidersHorizontal className="w-3 h-3" />
        Global
      </span>
      {adjustments.map((adj, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[11px]">
          <span className="text-muted-foreground">{adj.label}:</span>
          <span className="font-medium text-foreground">{adj.value}</span>
          <ProvenanceIcon provenance={adj.provenance} role={role} />
          {role === "clinician" && adj.changedAt && (
            <span className="text-[9px] text-muted-foreground/60">
              {new Date(adj.changedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      ))}
    </div>
  );
});

// ─── Card components ───

const StrengthCard = memo(function StrengthCard({
  card,
  role,
}: {
  card: StrengthAreaCard;
  role: UiRole;
}) {
  const title = role === "patient" ? card.patientTitle : card.title;
  const reason = role === "patient" ? card.patientReason : card.reason;
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
        {isMaintained && role !== "patient" && (
          <Badge variant="outline" className="text-[8px] h-3.5 px-1 text-muted-foreground">
            {getSectionLabel("maintained", role)}
          </Badge>
        )}
        <ConfidenceBadge level={card.confidence} role={role} />
      </div>
      <p className="text-[11px] text-muted-foreground leading-tight pl-5">
        {reason}
      </p>
      {role === "clinician" && card.exercises.length > 0 && (
        <p className="text-[11px] text-foreground/70 leading-tight pl-5">
          <span className="text-muted-foreground font-medium">Plan: </span>
          {card.systemPlan}
        </p>
      )}
      {role !== "patient" && (
        <p className="text-[11px] text-foreground/70 leading-tight pl-5">
          <span className="text-muted-foreground font-medium">Supports: </span>
          {card.functionalMeaning}
        </p>
      )}
      {card.linkedOutcomes.length > 0 && (
        <div className="pl-5">
          <OutcomeChips outcomes={card.linkedOutcomes} role={role} />
        </div>
      )}
      {role === "clinician" && <EvidenceTags tags={card.evidence} />}
    </div>
  );
});

const FocusCard = memo(function FocusCard({
  card,
  role,
}: {
  card: FocusAreaCard;
  role: UiRole;
}) {
  const title = role === "patient" ? card.patientTitle : card.title;
  const why = role === "patient" ? card.patientWhyNeeded : card.whyNeeded;
  const isUncovered = card.classification === "uncovered";

  return (
    <div className={`rounded-md border bg-card p-2.5 space-y-1 ${isUncovered ? "border-amber-200/50" : ""}`}>
      {/* Row 1: Title + provenance + confidence */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Target className={`w-3.5 h-3.5 shrink-0 ${isUncovered ? "text-amber-500" : "text-primary"}`} />
          <span className="text-xs font-semibold text-foreground truncate">{title}</span>
          {isUncovered && role !== "patient" && (
            <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-amber-300 text-amber-600">
              {getSectionLabel("uncovered", role)}
            </Badge>
          )}
          <ConfidenceBadge level={card.confidence} role={role} />
        </div>
        <ProvenanceIcon provenance={card.provenance} role={role} />
      </div>

      {/* Row 2: Why needed */}
      <p className="text-[11px] text-muted-foreground leading-tight pl-5">{why}</p>

      {/* Row 3: Clinician signal (clinician only) */}
      {role === "clinician" && card.clinicianSignal && (
        <p className="text-[11px] text-foreground/80 leading-tight pl-5 italic">
          {card.clinicianSignal}
        </p>
      )}

      {/* Row 4: Exercises */}
      {card.exercises.length > 0 && (
        <div className="flex items-start gap-1 pl-5 flex-wrap">
          <span className="text-[11px] text-muted-foreground font-medium shrink-0">
            {role === "patient" ? "Games:" : "Exercises:"}
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

      {/* Row 5: Exercise-specific adaptation (clinician only) */}
      {role === "clinician" && card.activeAdaptation !== "Default settings" && (
        <p className="text-[11px] text-muted-foreground leading-tight pl-5">
          <span className="font-medium">Adaptation: </span>
          {card.activeAdaptation}
        </p>
      )}

      {/* Row 6: Expected gain + outcome chips */}
      <div className="flex items-center gap-1.5 pl-5 flex-wrap">
        <TrendingUp className="w-2.5 h-2.5 text-primary/60 shrink-0" />
        <span className="text-[11px] text-foreground/80">
          {role === "patient" ? "Goal: " : "Expected: "}
          {card.expectedGain}
        </span>
        <OutcomeChips outcomes={card.linkedOutcomes} role={role} />
      </div>

      {/* Uncovered: actionable suggestion */}
      {isUncovered && (
        <div className="flex items-start gap-1 pl-5">
          {role === "clinician" && card.suggestedExercises && card.suggestedExercises.length > 0 ? (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <Lightbulb className="w-3 h-3 text-amber-500 shrink-0" />
                <span className="text-[10px] text-amber-600 font-medium">
                  Suggested exercises:
                </span>
              </div>
              <div className="flex gap-1 flex-wrap pl-4">
                {card.suggestedExercises.map(name => (
                  <Badge key={name} variant="outline" className="text-[9px] h-4 px-1.5 border-amber-300/50">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
              <span className="text-[10px] text-amber-600">
                {getGapActionText(role)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Evidence tags (clinician only) */}
      {role === "clinician" && <EvidenceTags tags={card.evidence} />}
    </div>
  );
});

// ─── Main component ───

export const StrengthsAndFocusAreasMap = memo(function StrengthsAndFocusAreasMap({
  strengths,
  focusAreas,
  planSummary,
  viewMode = "clinician",
  globalAdjustments = [],
}: StrengthsAndFocusAreasMapProps) {
  const role = viewMode as UiRole;
  const confirmedStrengths = strengths.filter(s => s.classification === "strength");
  const maintainedAreas = strengths.filter(s => s.classification === "maintained");
  const activeFocus = focusAreas.filter(f => f.classification === "focus");
  const uncoveredAreas = focusAreas.filter(f => f.classification === "uncovered");

  if (strengths.length === 0 && focusAreas.length === 0) {
    return (
      <div className="rounded-md bg-muted/30 p-3 text-center">
        <p className="text-xs text-muted-foreground">
          {role === "patient"
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
          {role === "patient" ? planSummary.patientVersion : planSummary.emphasis}
        </p>
        {role === "clinician" && planSummary.reasoning && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {planSummary.reasoning}
          </p>
        )}
      </div>

      {/* Global Adjustments (caregiver + clinician only) */}
      <GlobalAdjustmentsBar adjustments={globalAdjustments} role={role} />

      {/* Focus Areas — active treatment targets */}
      {activeFocus.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Target className="w-3 h-3" />
            {getSectionLabel("focus", role)} ({activeFocus.length})
          </p>
          <div className="grid gap-1.5">
            {activeFocus.map(card => (
              <FocusCard key={card.id} card={card} role={role} />
            ))}
          </div>
        </div>
      )}

      {/* Strengths */}
      {confirmedStrengths.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-success" />
            {getSectionLabel("strength", role)} ({confirmedStrengths.length})
          </p>
          <div className="grid gap-1.5">
            {confirmedStrengths.map(card => (
              <StrengthCard key={card.id} card={card} role={role} />
            ))}
          </div>
        </div>
      )}

      {/* Maintained / Monitored */}
      {maintainedAreas.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Eye className="w-3 h-3" />
            {getSectionLabel("maintained", role)} ({maintainedAreas.length})
          </p>
          <div className="grid gap-1.5">
            {maintainedAreas.map(card => (
              <StrengthCard key={card.id} card={card} role={role} />
            ))}
          </div>
        </div>
      )}

      {/* Uncovered — clinician/caregiver only, patient hidden by default */}
      {uncoveredAreas.length > 0 && role !== "patient" && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3 text-amber-500" />
            {getSectionLabel("uncovered", role)} ({uncoveredAreas.length})
          </p>
          <div className="grid gap-1.5">
            {uncoveredAreas.map(card => (
              <FocusCard key={card.id} card={card} role={role} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
