/**
 * Structured Clinical Interpretation — THE single narrative layer.
 * 
 * 3-part format:
 * 1. Headline (status line)
 * 2. Evidence paragraph (2–3 sentences)
 * 3. Recommendation (1 sentence, highlighted)
 * 
 * No other component on the page should "explain the story."
 */
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Stethoscope, HelpCircle, ArrowRight } from "lucide-react";
import type { PeriodSummary } from "@/hooks/useWeekOverWeek";
import type { RecoveryAlert } from "@/hooks/useRecoveryAlerts";
import {
  generateStructuredInterpretation,
  type StructuredInterpretation,
  type PatientWeekState,
} from "@/lib/clinicalInterpretationEngine";

interface ClinicalInterpretationProps {
  current: PeriodSummary;
  prior: PeriodSummary;
  hasPriorData: boolean;
  alerts: RecoveryAlert[];
  accuracySlope: number | null;
  profileName: string;
}

const stateColors: Record<PatientWeekState, string> = {
  improving: "border-green-500/30 bg-green-500/5",
  stable: "border-primary/20 bg-primary/5",
  declining: "border-red-500/20 bg-red-500/5",
  low_engagement: "border-amber-500/20 bg-amber-500/5",
  high_fatigue_risk: "border-orange-500/20 bg-orange-500/5",
  mixed: "border-violet-500/20 bg-violet-500/5",
};

const stateLabels: Record<PatientWeekState, string> = {
  improving: "Improving",
  stable: "Stable",
  declining: "Declining",
  low_engagement: "Low Engagement",
  high_fatigue_risk: "Fatigue Risk",
  mixed: "Mixed Signals",
};

const stateBadgeVariant: Record<PatientWeekState, "default" | "secondary" | "destructive" | "outline"> = {
  improving: "default",
  stable: "secondary",
  declining: "destructive",
  low_engagement: "outline",
  high_fatigue_risk: "destructive",
  mixed: "outline",
};

export function ClinicalInterpretation({
  current,
  prior,
  hasPriorData,
  alerts,
  accuracySlope,
  profileName,
}: ClinicalInterpretationProps) {
  const interpretation = useMemo(
    () =>
      generateStructuredInterpretation({
        current,
        prior,
        hasPriorData,
        alerts,
        accuracySlope,
        profileName,
      }),
    [current, prior, hasPriorData, alerts, accuracySlope, profileName]
  );

  if (current.totalSessions === 0 && !hasPriorData) return null;

  return (
    <Card className={stateColors[interpretation.state]}>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <Stethoscope className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            {/* Header row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                Clinical Interpretation
              </span>
              <Badge variant={stateBadgeVariant[interpretation.state]} className="text-[9px] h-4">
                {stateLabels[interpretation.state]}
              </Badge>
              <Badge
                variant={
                  interpretation.confidence === "high"
                    ? "default"
                    : interpretation.confidence === "moderate"
                    ? "secondary"
                    : "outline"
                }
                className="text-[9px] h-4"
              >
                {interpretation.confidence} confidence
              </Badge>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/50" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs text-xs">
                    <p>
                      Rule-based interpretation from telemetry data. Confidence: High (30+ trials,
                      3+ active days), Moderate (10–29 trials), Low (&lt;10 trials).
                      This is a decision-support tool — verify against clinical judgment.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Headline */}
            <p className="text-sm font-semibold leading-snug text-foreground">
              {interpretation.headline}
            </p>

            {/* Evidence */}
            <p className="text-sm leading-relaxed text-foreground/80">
              {interpretation.evidence}
            </p>

            {/* Recommendation — highlighted */}
            <div className="flex items-start gap-2 rounded-md bg-background/60 border border-border/50 px-3 py-2">
              <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-foreground">
                {interpretation.recommendation}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
