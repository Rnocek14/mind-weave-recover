/**
 * Data Sufficiency Summary — shows patient/session/trial counts and warns when analytics
 * sections won't have meaningful data.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Database } from "lucide-react";

interface Props {
  patientCount: number;
  sessionCount: number;
  trialCount: number;
  retentionWordCount: number;
  functionalCheckinCount: number;
}

interface Threshold {
  label: string;
  current: number;
  min: number;
  ideal: number;
}

export function DataSufficiencyBar({ patientCount, sessionCount, trialCount, retentionWordCount, functionalCheckinCount }: Props) {
  const thresholds: Threshold[] = [
    { label: "Patients", current: patientCount, min: 2, ideal: 10 },
    { label: "Sessions", current: sessionCount, min: 10, ideal: 50 },
    { label: "Trials", current: trialCount, min: 50, ideal: 500 },
    { label: "Retention Words", current: retentionWordCount, min: 20, ideal: 100 },
    { label: "Functional Check-ins", current: functionalCheckinCount, min: 3, ideal: 15 },
  ];

  const insufficient = thresholds.filter((t) => t.current < t.min);
  const allGood = insufficient.length === 0;

  return (
    <Card className={allGood ? "border-border/30" : "border-amber-500/30 bg-amber-500/5"}>
      <CardContent className="py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          {allGood ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          )}
          <span className="text-xs font-medium">
            {allGood ? "Data sufficient for analysis" : "Limited data — some analytics may be unreliable"}
          </span>
          <div className="flex gap-1.5 ml-auto flex-wrap">
            {thresholds.map((t) => (
              <Badge
                key={t.label}
                variant={t.current >= t.ideal ? "default" : t.current >= t.min ? "secondary" : "outline"}
                className={`text-[10px] ${t.current < t.min ? "border-amber-500/40 text-amber-600" : ""}`}
              >
                {t.label}: {t.current}{t.current < t.min ? ` (need ${t.min}+)` : ""}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
