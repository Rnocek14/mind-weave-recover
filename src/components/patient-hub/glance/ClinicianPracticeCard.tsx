/**
 * Clinician Glance — Card 2: Practice / Dose
 * Answers: "Are they getting therapeutic dose?"
 *
 * Caregiver card showed 7 dots + streak.
 * Clinician card shows 7 dots + sessions/week + trials/week + minutes
 * vs prescribed dose target so under-dosing is obvious at a glance.
 */
import { Card } from "@/components/ui/card";
import { Flame } from "lucide-react";
import { useMemo } from "react";

interface DayCell {
  date: string;
  hasAnySignal: boolean;
  trialCount: number;
  sessionMinutes?: number;
}

interface ClinicianPracticeCardProps {
  timeline: DayCell[];
  trialCount: number;
  sessionCount: number;
  prescribedDaysPerWeek?: number; // default 5 if unknown
  streak: number;
}

export function ClinicianPracticeCard({
  timeline,
  trialCount,
  sessionCount,
  prescribedDaysPerWeek = 5,
  streak,
}: ClinicianPracticeCardProps) {
  const last7 = timeline.slice(-7);
  const activeDays = last7.filter((d) => d.hasAnySignal).length;
  const minutes = useMemo(
    () => last7.reduce((s, d) => s + (d.sessionMinutes || 0), 0),
    [last7]
  );

  const adherencePct = Math.min(100, Math.round((activeDays / prescribedDaysPerWeek) * 100));
  const adherenceColor =
    adherencePct >= 100
      ? "text-emerald-600"
      : adherencePct >= 60
      ? "text-amber-600"
      : "text-destructive";

  const dots = useMemo(() => {
    return last7.map((d, i) => {
      const date = new Date(d.date);
      const isToday = i === last7.length - 1;
      return {
        label: ["S", "M", "T", "W", "T", "F", "S"][date.getDay()],
        active: d.hasAnySignal,
        isToday,
      };
    });
  }, [last7]);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            Practice · Dose
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold text-foreground leading-tight">
              {activeDays}/{prescribedDaysPerWeek}
            </div>
            <span className={`text-sm font-semibold ${adherenceColor}`}>
              {adherencePct}% adherence
            </span>
          </div>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600">
            <Flame className="w-4 h-4" />
            <span className="text-sm font-semibold">{streak}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-1.5 mb-3">
        {dots.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
            <div
              className={`w-full max-w-[34px] aspect-square rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                d.active
                  ? "bg-primary text-primary-foreground"
                  : d.isToday
                  ? "bg-muted ring-2 ring-primary/40 text-muted-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {d.active ? "✓" : ""}
            </div>
            <span className={`text-[10px] ${d.isToday ? "font-bold text-foreground" : "text-muted-foreground"}`}>
              {d.label}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border text-center">
        <div>
          <div className="text-base font-bold text-foreground">{sessionCount}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Sessions</div>
        </div>
        <div>
          <div className="text-base font-bold text-foreground">{trialCount}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Trials</div>
        </div>
        <div>
          <div className="text-base font-bold text-foreground">{Math.round(minutes)}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Minutes</div>
        </div>
      </div>
    </Card>
  );
}
