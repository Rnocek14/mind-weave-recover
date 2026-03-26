/**
 * "What Changed This Week" — caregiver-facing weekly delta summary.
 * Shows improvement signals in plain, reassuring language.
 * Now includes domain-level improvement narrative.
 */

import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useCaregiverDomainGuidance } from "@/hooks/useCaregiverDomainGuidance";
import { useMemo } from "react";

interface WeeklyChangeCardProps {
  userId: string;
  patientName: string;
}

interface WeeklyDelta {
  label: string;
  thisWeek: number;
  lastWeek: number;
  unit: string;
  higherIsBetter: boolean;
}

function DeltaRow({ delta }: { delta: WeeklyDelta }) {
  const diff = delta.thisWeek - delta.lastWeek;
  const improving = delta.higherIsBetter ? diff > 0 : diff < 0;
  const declining = delta.higherIsBetter ? diff < 0 : diff > 0;
  const unchanged = diff === 0;

  const Icon = improving ? TrendingUp : declining ? TrendingDown : Minus;
  const color = improving
    ? "text-emerald-600"
    : declining
    ? "text-amber-600"
    : "text-muted-foreground";

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-foreground">{delta.label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">
          {delta.thisWeek}{delta.unit}
        </span>
        {!unchanged && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${color}`}>
            <Icon className="w-3 h-3" />
            {Math.abs(diff)}{delta.unit}
          </span>
        )}
        {unchanged && (
          <span className="text-xs text-muted-foreground">same</span>
        )}
      </div>
    </div>
  );
}

export function WeeklyChangeCard({ userId, patientName }: WeeklyChangeCardProps) {
  const { sessions } = useSessionHistory(userId);
  const { primaryStruggle } = useCaregiverDomainGuidance(userId);

  const deltas = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 86_400_000;
    const twoWeeksAgo = now - 14 * 86_400_000;

    const thisWeekSessions = sessions.filter(
      (s) => new Date(s.startedAt).getTime() > weekAgo
    );
    const lastWeekSessions = sessions.filter(
      (s) => {
        const t = new Date(s.startedAt).getTime();
        return t > twoWeeksAgo && t <= weekAgo;
      }
    );

    const thisWeekDays = new Set(
      thisWeekSessions.map(s => new Date(s.startedAt).toISOString().split("T")[0])
    ).size;
    const lastWeekDays = new Set(
      lastWeekSessions.map(s => new Date(s.startedAt).toISOString().split("T")[0])
    ).size;

    const thisWeekMinutes = Math.round(
      thisWeekSessions.reduce((sum, s) => sum + (s.durationSec || 0), 0) / 60
    );
    const lastWeekMinutes = Math.round(
      lastWeekSessions.reduce((sum, s) => sum + (s.durationSec || 0), 0) / 60
    );

    const result: WeeklyDelta[] = [
      {
        label: "Practice days",
        thisWeek: thisWeekDays,
        lastWeek: lastWeekDays,
        unit: "",
        higherIsBetter: true,
      },
      {
        label: "Total practice time",
        thisWeek: thisWeekMinutes,
        lastWeek: lastWeekMinutes,
        unit: "m",
        higherIsBetter: true,
      },
      {
        label: "Sessions completed",
        thisWeek: thisWeekSessions.length,
        lastWeek: lastWeekSessions.length,
        unit: "",
        higherIsBetter: true,
      },
    ];

    return result;
  }, [sessions]);

  // Generate a plain-language summary with domain awareness
  const summaryText = useMemo(() => {
    if (!deltas.length) return null;
    const daysDelta = deltas[0];
    const diff = daysDelta.thisWeek - daysDelta.lastWeek;
    const domainHint = primaryStruggle
      ? `, focusing on ${primaryStruggle.caregiverLabel}`
      : "";

    if (diff > 0) return `${patientName} practiced more this week than last${domainHint} — great progress!`;
    if (diff < 0) return `Practice was lower this week — a little encouragement may help.`;
    if (daysDelta.thisWeek >= 4) return `${patientName} is staying consistent${domainHint} — keep it up!`;
    if (daysDelta.thisWeek === 0) return `No practice this week yet — today is a good day to start.`;
    return `${patientName} has been practicing${domainHint} — every session counts.`;
  }, [deltas, patientName, primaryStruggle]);

  return (
    <Card className="p-5 border-2 space-y-3">
      <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
        <Calendar className="w-5 h-5 text-primary" />
        What Changed This Week
      </h3>

      {summaryText && (
        <p className="text-sm text-muted-foreground">{summaryText}</p>
      )}

      <div className="divide-y divide-border/50">
        {deltas.map((delta, i) => (
          <DeltaRow key={i} delta={delta} />
        ))}
      </div>
    </Card>
  );
}
