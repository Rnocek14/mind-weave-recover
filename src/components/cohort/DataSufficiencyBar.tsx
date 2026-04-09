/**
 * Data Sufficiency Summary — shows patient/session/trial counts, warns when analytics
 * sections won't have meaningful data, and provides a single Analytics Reliability score.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";

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

type ReliabilityLevel = "high" | "medium" | "low";

function computeReliability(thresholds: Threshold[]): { level: ReliabilityLevel; label: string; description: string } {
  const belowMin = thresholds.filter((t) => t.current < t.min).length;
  const atIdeal = thresholds.filter((t) => t.current >= t.ideal).length;

  if (belowMin >= 3 || thresholds[0].current < thresholds[0].min) {
    return { level: "low", label: "Low", description: "Not enough data for reliable cross-patient analysis. Fill profiles and run more sessions." };
  }
  if (atIdeal >= 4 && belowMin === 0) {
    return { level: "high", label: "High", description: "Strong data across all dimensions. Analytics are reliable." };
  }
  return { level: "medium", label: "Medium", description: "Some analytics are meaningful, but more data will improve reliability." };
}

const RELIABILITY_STYLES: Record<ReliabilityLevel, string> = {
  low: "bg-destructive text-destructive-foreground",
  medium: "bg-amber-500 text-white",
  high: "bg-primary text-primary-foreground",
};

export function DataSufficiencyBar({ patientCount, sessionCount, trialCount, retentionWordCount, functionalCheckinCount }: Props) {
  const thresholds: Threshold[] = [
    { label: "Patients", current: patientCount, min: 2, ideal: 10 },
    { label: "Sessions", current: sessionCount, min: 10, ideal: 50 },
    { label: "Trials", current: trialCount, min: 50, ideal: 500 },
    { label: "Retention Words", current: retentionWordCount, min: 20, ideal: 100 },
    { label: "Functional Check-ins", current: functionalCheckinCount, min: 3, ideal: 15 },
  ];

  const reliability = computeReliability(thresholds);
  const insufficient = thresholds.filter((t) => t.current < t.min);

  return (
    <Card className={reliability.level === "high" ? "border-border/30" : reliability.level === "low" ? "border-destructive/30 bg-destructive/5" : "border-amber-500/30 bg-amber-500/5"}>
      <CardContent className="py-2.5 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          {reliability.level === "high" ? (
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
          ) : reliability.level === "low" ? (
            <ShieldAlert className="w-4 h-4 text-destructive shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          )}
          <Badge className={`text-[10px] ${RELIABILITY_STYLES[reliability.level]}`}>
            Analytics Reliability: {reliability.label}
          </Badge>
          <span className="text-xs text-muted-foreground">{reliability.description}</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {thresholds.map((t) => (
            <Badge
              key={t.label}
              variant={t.current >= t.ideal ? "default" : t.current >= t.min ? "secondary" : "outline"}
              className={`text-[10px] ${t.current < t.min ? "border-destructive/30 text-destructive" : ""}`}
            >
              {t.label}: {t.current}{t.current < t.min ? ` (need ${t.min}+)` : ""}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
