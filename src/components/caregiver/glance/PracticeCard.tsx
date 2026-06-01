/**
 * Glance Card 2 — Practice
 * Answers: "Did they practice?"
 * Streak dots for the last 7 days + total.
 */
import { Card } from "@/components/ui/card";
import { Flame } from "lucide-react";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useMemo } from "react";

interface PracticeCardProps {
  userId: string;
  streak: number;
  profileId?: string | null;
}

export function PracticeCard({ userId, streak, profileId }: PracticeCardProps) {
  const { sessions } = useSessionHistory(userId, profileId);

  const dots = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: { label: string; active: boolean; isToday: boolean }[] = [];
    const sessionDates = new Set(
      sessions.map((s) => {
        const d = new Date(s.startedAt);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
    );
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push({
        label: ["S", "M", "T", "W", "T", "F", "S"][d.getDay()],
        active: sessionDates.has(d.getTime()),
        isToday: i === 0,
      });
    }
    return days;
  }, [sessions]);

  const weekCount = dots.filter((d) => d.active).length;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Practice</div>
          <div className="text-2xl font-bold text-foreground leading-tight">
            {weekCount} of 7 days
          </div>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600">
            <Flame className="w-4 h-4" />
            <span className="text-sm font-semibold">{streak}</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-1.5">
        {dots.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
            <div
              className={`w-full max-w-[36px] aspect-square rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
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
    </Card>
  );
}
