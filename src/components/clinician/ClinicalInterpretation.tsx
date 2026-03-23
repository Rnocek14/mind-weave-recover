/**
 * Auto-generated clinical interpretation block.
 * Answers: What happened? What changed? What to do next?
 */
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Stethoscope, HelpCircle } from "lucide-react";
import type { PeriodSummary } from "@/hooks/useWeekOverWeek";
import type { NextAction } from "@/lib/generateNextActions";

interface ClinicalInterpretationProps {
  current: PeriodSummary;
  prior: PeriodSummary;
  hasPriorData: boolean;
  nextActions: NextAction[];
  windowSize: number;
  profileName: string;
  speechLabel: string | null;
}

export function ClinicalInterpretation({
  current,
  prior,
  hasPriorData,
  nextActions,
  windowSize,
  profileName,
  speechLabel,
}: ClinicalInterpretationProps) {
  const interpretation = useMemo(() => {
    const lines: string[] = [];

    // WHAT HAPPENED
    if (current.totalSessions === 0) {
      lines.push(`${profileName} had no therapy sessions in the past ${windowSize} days.`);
    } else {
      lines.push(
        `${profileName} completed ${current.totalSessions} session${current.totalSessions > 1 ? "s" : ""} ` +
        `across ${current.activeDays} day${current.activeDays > 1 ? "s" : ""}, ` +
        `totaling ${current.totalTrials} trials in ${current.totalMinutes} minutes.`
      );
    }

    // WHAT CHANGED
    if (hasPriorData && current.totalSessions > 0) {
      const accDelta = current.avgAccuracy !== null && prior.avgAccuracy !== null
        ? current.avgAccuracy - prior.avgAccuracy
        : null;

      const volumeChange = prior.totalTrials > 0
        ? Math.round(((current.totalTrials - prior.totalTrials) / prior.totalTrials) * 100)
        : null;

      if (accDelta !== null) {
        if (accDelta > 5) {
          lines.push(
            `Accuracy improved by ${accDelta}% compared to the prior period (${prior.avgAccuracy}% → ${current.avgAccuracy}%).`
          );
        } else if (accDelta < -5) {
          lines.push(
            `Accuracy declined by ${Math.abs(accDelta)}% compared to the prior period (${prior.avgAccuracy}% → ${current.avgAccuracy}%). This may indicate exercises are too challenging or fatigue is impacting performance.`
          );
        } else {
          lines.push(
            `Accuracy is stable at ${current.avgAccuracy}% (prior: ${prior.avgAccuracy}%).`
          );
        }
      }

      if (volumeChange !== null && Math.abs(volumeChange) > 20) {
        if (volumeChange > 0) {
          lines.push(`Practice volume increased ${volumeChange}% vs prior period.`);
        } else {
          lines.push(`Practice volume decreased ${Math.abs(volumeChange)}% vs prior period.`);
        }
      }

      if (current.avgFatigue !== null && prior.avgFatigue !== null) {
        const fatigueDelta = current.avgFatigue - prior.avgFatigue;
        if (fatigueDelta > 0.5) {
          lines.push(`Fatigue is trending higher (${prior.avgFatigue} → ${current.avgFatigue}/5). Consider adjusting session length.`);
        } else if (fatigueDelta < -0.5) {
          lines.push(`Fatigue has improved (${prior.avgFatigue} → ${current.avgFatigue}/5).`);
        }
      }
    }

    // WHAT TO DO NEXT
    const highActions = nextActions.filter((a) => a.priority === "high");
    if (highActions.length > 0) {
      lines.push(`Priority actions: ${highActions.map((a) => a.title.toLowerCase()).join("; ")}.`);
    }

    return lines.join(" ");
  }, [current, prior, hasPriorData, nextActions, windowSize, profileName]);

  const confidence = current.totalTrials >= 30 ? "high" : current.totalTrials >= 10 ? "moderate" : "low";

  if (current.totalSessions === 0 && !hasPriorData) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="py-3">
        <div className="flex items-start gap-3">
          <Stethoscope className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                Clinical Interpretation
              </span>
              <Badge
                variant={confidence === "high" ? "default" : confidence === "moderate" ? "secondary" : "outline"}
                className="text-[9px] h-4"
              >
                {confidence} confidence
              </Badge>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/50" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs text-xs">
                    <p>
                      Auto-generated interpretation based on telemetry data. Confidence reflects trial count:
                      High (30+ trials), Moderate (10-29), Low (&lt;10). This is a decision-support tool —
                      always verify against clinical judgment and direct patient observation.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{interpretation}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
