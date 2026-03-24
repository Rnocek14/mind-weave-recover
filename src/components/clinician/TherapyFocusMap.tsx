/**
 * Therapy Focus Map — explainability layer for the clinician review.
 * 
 * Shows per-exercise cards grouped by recovery domain, each answering:
 * 1. What does it target?
 * 2. Why was it selected for this patient?
 * 3. How is it currently adapted?
 * 4. What should improve?
 */

import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Volume2, User, Bot, Settings2, TrendingUp, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TherapyFocusCard, SessionRationale } from "@/hooks/useTherapyFocusData";

interface TherapyFocusMapProps {
  cardsByDomain: Record<string, TherapyFocusCard[]>;
  sessionRationale: SessionRationale;
}

const DOMAIN_LABELS: Record<string, string> = {
  speech_therapy: "Speech & Language",
  physical_therapy: "Physical & Visuospatial",
  cognitive_therapy: "Cognitive",
};

const OUTCOME_LABELS: Record<string, string> = {
  word_mastery: "Word Mastery",
  cue_independence: "Cue Independence",
  error_quality: "Error Quality",
};

const ProvenanceBadge = memo(function ProvenanceBadge({
  provenance,
  date,
}: {
  provenance: "clinician" | "system" | "default";
  date: string | null;
}) {
  if (provenance === "default") return null;

  const isClinician = provenance === "clinician";
  const Icon = isClinician ? User : Bot;
  const label = isClinician ? "Clinician" : "System";
  const classes = isClinician
    ? "border-primary/30 text-primary"
    : "border-muted-foreground/30 text-muted-foreground";

  return (
    <div className="flex items-center gap-1">
      <Badge variant="outline" className={`text-[8px] h-4 ${classes}`}>
        <Icon className="w-2.5 h-2.5 mr-0.5" />
        {label}
      </Badge>
      {date && (
        <span className="text-[9px] text-muted-foreground/60">
          {new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      )}
    </div>
  );
});

const ExerciseCard = memo(function ExerciseCard({ card }: { card: TherapyFocusCard }) {
  return (
    <div className="rounded-md border bg-card p-2 space-y-1">
      {/* Row 1: Name + badges */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-foreground truncate">{card.displayName}</span>
          {card.hasSpeechOutput && <Volume2 className="w-3 h-3 text-primary/50 shrink-0" />}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {card.currentDifficulty !== null && card.currentDifficulty !== 0 && (
            <Badge variant="outline" className="text-[8px] h-4">
              {card.currentDifficulty > 0 ? `+${card.currentDifficulty}` : card.currentDifficulty}
            </Badge>
          )}
          <ProvenanceBadge provenance={card.provenance} date={card.lastChangedAt} />
        </div>
      </div>

      {/* Row 2: Targets → Why (single line when possible) */}
      <p className="text-[11px] text-muted-foreground leading-tight">
        <span className="font-medium text-foreground">{card.clinicalTargets.join(", ") || "General"}</span>
        {" · "}
        {card.whySelected}
      </p>

      {/* Row 3: Adaptation + signal (compact) */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1 shrink-0">
          <Settings2 className="w-2.5 h-2.5" />
          {card.activeAdaptation}
        </span>
        {card.recentSignal && (
          <>
            <span className="text-muted-foreground/30">|</span>
            <span className="italic truncate">{card.recentSignal}</span>
          </>
        )}
      </div>

      {/* Row 4: Expected gain + outcome badges */}
      <div className="flex items-center gap-1.5 text-[11px]">
        <TrendingUp className="w-2.5 h-2.5 text-primary/60 shrink-0" />
        <span className="text-foreground/80">{card.expectedGain}</span>
        {card.outcomeMetrics.map((m) => (
          <Badge key={m} variant="secondary" className="text-[7px] h-3 px-1">
            {OUTCOME_LABELS[m] || m.replace(/_/g, " ")}
          </Badge>
        ))}
      </div>
    </div>
  );
});

export const TherapyFocusMap = memo(function TherapyFocusMap({
  cardsByDomain,
  sessionRationale,
}: TherapyFocusMapProps) {
  const domainEntries = Object.entries(cardsByDomain);

  if (domainEntries.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Session Selection Rationale */}
      {(sessionRationale.reasons.length > 0 || sessionRationale.systemActions.length > 0) && (
        <div className="rounded-md bg-muted/30 p-2.5 space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger className="flex items-center gap-1">
                  Session Focus
                  <Info className="w-3 h-3 text-muted-foreground/50" />
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs max-w-xs">
                  Why today's plan emphasizes these domains, based on the clinical
                  profile and recent performance signals.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </p>
          {sessionRationale.emphasis.length > 0 && (
            <p className="text-[11px] text-foreground">
              <span className="text-muted-foreground">Emphasizing: </span>
              {sessionRationale.emphasis.join(", ")}
            </p>
          )}
          {sessionRationale.reasons.map((r, i) => (
            <p key={i} className="text-[11px] text-muted-foreground">• {r}</p>
          ))}
          {sessionRationale.systemActions.map((a, i) => (
            <p key={i} className="text-[11px] text-muted-foreground">• {a}</p>
          ))}
        </div>
      )}

      {/* Exercise cards grouped by domain */}
      {domainEntries.map(([domain, cards]) => (
        <div key={domain} className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pl-0.5">
            {DOMAIN_LABELS[domain] || domain.replace(/_/g, " ")}
          </p>
          <div className="grid gap-1.5">
            {cards.map((card) => (
              <ExerciseCard key={card.slug} card={card} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});
