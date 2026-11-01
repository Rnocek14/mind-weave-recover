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
  streak,
}: ClinicianPracticeCardProps) {
  const last7 = timeline.slice(-7);
  const activeDays = last7.filter((d) => d.hasAnySignal).length;
  const minutes = useMemo(
    () => last7.reduce((s, d) => s + (d.sessionMinutes || 0), 0),
    [last7]
  );

  const dots = useMemo(() => {
    return last7.map((d, i) => {
      const date = new Date(d.date.slice(0, 10) + "T12:00:00");
      const isToday = i === last7.length - 1;
      return {
        label: ["S", "M", "T", "W", "T", "F", "S"][date.getDay()],
        active: d.hasAnySignal,
        isToday,
      };
    });
  }, [last7]);

  return (
    <Card className="p-4 sm:p-5 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            Practice · Last 7 days
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <div className="text-2xl font-bold text-foreground leading-tight">
              {activeDays}/7
            </div>
            <span className="text-sm text-muted-foreground">
              days with recorded activity
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
          <div className="text-xs text-muted-foreground">Minutes (7d)</div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
        Recorded practice days are not a prescribed therapy-dose target. No adherence target is configured in this card.
      </p>
    </Card>
  );
}
