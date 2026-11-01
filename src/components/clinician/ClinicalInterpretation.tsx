/**
 * A plain-language review of app observations. No automated claim of
 * neurological recovery, clinical stability or a prescribed therapy plan.
 */
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, ArrowRight } from "lucide-react";
import type { PeriodSummary } from "@/hooks/useWeekOverWeek";
import type { RecoveryAlert } from "@/hooks/useRecoveryAlerts";
import {
  generateStructuredInterpretation,
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

const stateLabels: Record<PatientWeekState, string> = {
  improving: "Higher app scores",
  stable: "No clear change in app scores",
  declining: "Lower app scores",
  low_engagement: "Limited recorded activity",
  high_fatigue_risk: "Higher reported fatigue",
  mixed: "Mixed app signals",
};

export function ClinicalInterpretation({
  current, prior, hasPriorData, alerts, accuracySlope, profileName,
}: ClinicalInterpretationProps) {
  const interpretation = useMemo(() => generateStructuredInterpretation({
    current, prior, hasPriorData, alerts, accuracySlope, profileName,
  }), [current, prior, hasPriorData, alerts, accuracySlope, profileName]);

  if (current.totalSessions === 0 && !hasPriorData) return null;

  return (
    <Card className="border-border">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Stethoscope aria-hidden="true" className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">
                App practice observations
              </h3>
              <Badge variant="outline" className="text-xs">
                {stateLabels[interpretation.state]}
              </Badge>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Based on {current.totalTrials} recorded attempts over {current.activeDays} active
              {current.activeDays === 1 ? " day" : " days"}.
              {" "}This is a sample-volume description, not model confidence.
            </p>
            <p className="text-sm font-medium leading-relaxed text-foreground">
              {interpretation.headline}
            </p>
            <p className="text-sm leading-relaxed text-foreground/80">
              {interpretation.evidence}
            </p>
            <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-3">
              <ArrowRight aria-hidden="true" className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">For clinician review</p>
                <p className="text-sm leading-relaxed text-foreground">{interpretation.recommendation}</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Different games, support levels and audio quality may affect comparisons. App data alone
              does not establish recovery, real-world transfer or who spoke.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
